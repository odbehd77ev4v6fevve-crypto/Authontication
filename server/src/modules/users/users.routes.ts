import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import {
  getBangladeshPhoneVariants,
  isValidBangladeshPhone,
  normalizeBangladeshPhone,
  toCanonicalBangladeshPhone,
  validateBangladeshHierarchy,
} from '../../../../shared/bangladeshLocations.ts';
import {
  ALL_PERMISSIONS,
  ROLE_METADATA,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  type Permission,
  type StaffRole,
} from '../../../../shared/rbac.ts';
import {
  computeSessionTtl,
  escapeHtml,
  escapeRegex,
  isSafeDestinationUrl,
  validateFullName,
  validatePasswordAgainstPolicy,
} from '../../../../shared/security.ts';
import { mergeWishlistIds, validateImageUploadMeta } from '../../../../shared/wishlistHelpers.ts';
import { env } from '../../config/env.ts';
import { requireDatabase } from '../../database/connection.ts';
import {
  requireAuth,
  requirePermission,
  setAuthCookie,
  signAuthToken,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { toPatchSchema } from '../../utils/zodPartial.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import {
  destroyCloudinaryAssetIfUnused,
  uploadBufferToCloudinary,
} from '../../services/cloudinary.service.ts';
import { sendTransactionalEmail } from '../../services/email.service.ts';
import {
  invalidateRolePermissionCache,
  userHasEffectivePermission,
} from '../../services/rbac.service.ts';
import { getUserAccountStats, sanitizeUser } from '../auth/auth.routes.ts';
import { ProductModel } from '../catalog/catalog.model.ts';
import { formatProductForStorefront } from '../catalog/catalog.routes.ts';
import { StoreSettingsModel } from '../cms/cms.model.ts';
import { ReviewModel } from '../marketing/marketing.model.ts';
import { OrderModel } from '../orders/order.model.ts';
import { CustomerGroupModel, RoleDefinitionModel, UserModel } from './user.model.ts';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

async function fetchFormattedWishlistItems(wishlistIds: unknown[]) {
  const stringIds = wishlistIds
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (stringIds.length === 0) return [];

  const rawProducts = await ProductModel.find({
    _id: { $in: stringIds },
    status: 'published',
  })
    .populate('brandId', 'name slug')
    .populate('categoryId', 'name slug nameBn')
    .lean();

  const byId = new Map(
    rawProducts.map((p) => [
      String(p._id),
      formatProductForStorefront(p as unknown as Record<string, unknown>),
    ])
  );

  return stringIds
    .map((id) => byId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

const router = Router();
router.use(requireDatabase, requireAuth);

const addressInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  recipientName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(25)
    .refine(isValidBangladeshPhone, 'Please enter a valid Bangladesh mobile number (01XXXXXXXXX).'),
  divisionCode: z.string().min(1),
  districtCode: z.string().min(1),
  upazilaCode: z.string().min(1),
  areaCode: z.string().min(1),
  houseAddress: z.string().trim().min(3).max(200),
  roadStreet: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(120).optional(),
  deliveryInstructions: z.string().trim().max(240).optional(),
  isDefault: z.boolean().optional(),
});

router.get(
  '/profile',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const stats = await getUserAccountStats(user._id);
    res.json({ user: sanitizeUser(user, stats, req.effectivePermissions), stats });
  })
);

router.get(
  '/dashboard',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const [stats, recentOrders] = await Promise.all([
      getUserAccountStats(user._id),
      OrderModel.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(4)
        .select('orderNumber orderStatus paymentStatus totalAmount items createdAt')
        .lean(),
    ]);

    res.json({
      summary: {
        ordersCount: stats.ordersCount,
        deliveredOrdersCount: stats.deliveredOrdersCount,
        totalSpent: stats.totalDeliveredSpend,
        wishlistCount: user.wishlist.length,
        addressesCount: user.savedAddresses.length,
        reviewsCount: stats.reviewsCount,
        membershipTier: sanitizeUser(user, stats).membershipTier,
      },
      recentOrders,
    });
  })
);

router.patch(
  '/profile',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(100).optional(),
      phone: z.string().trim().max(25).optional(),
      gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
      email: z.string().trim().email().max(150).optional(),
      avatarUrl: z
        .string()
        .trim()
        .refine((v) => v === '' || isSafeDestinationUrl(v, { allowRelative: true, allowEmpty: true }), 'Invalid avatar URL')
        .nullable()
        .optional(),
      avatarPublicId: z.string().trim().max(200).nullable().optional(),
      notificationPreferences: z
        .object({
          orderUpdates: z.boolean(),
          promotions: z.boolean(),
          backInStock: z.boolean(),
        })
        .optional(),
    });
    const parsed = schema.parse(req.body);
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const previousName = user.name;
    let nameChanged = false;
    if (parsed.name !== undefined) {
      const nameCheck = validateFullName(parsed.name);
      if (!nameCheck.valid) {
        res.status(400).json({ error: nameCheck.message });
        return;
      }
      if (nameCheck.normalized !== previousName) {
        user.name = nameCheck.normalized;
        nameChanged = true;
      }
    }

    if (parsed.phone !== undefined) {
      const rawPhone = parsed.phone.trim();
      if (!rawPhone) {
        user.phone = '';
        user.phoneVerified = false;
        user.pendingPhone = undefined;
        user.phoneOtpHash = undefined;
        user.phoneOtpExpiresAt = undefined;
        user.phoneOtpAttempts = 0;
      } else {
        if (!isValidBangladeshPhone(rawPhone)) {
          res.status(400).json({
            error: 'Please enter a valid Bangladesh mobile number (e.g. +880 17XXXXXXXX).',
          });
          return;
        }
        const canonicalPhone = toCanonicalBangladeshPhone(rawPhone);
        const variants = getBangladeshPhoneVariants(rawPhone);
        if (variants.length > 0) {
          const duplicatePhone = await UserModel.exists({
            _id: { $ne: user._id },
            phone: { $in: variants },
          });
          if (duplicatePhone) {
            res.status(409).json({ error: 'Another account already uses this mobile number.' });
            return;
          }
        }
        const currentCanonical = user.phone ? toCanonicalBangladeshPhone(user.phone) : '';
        if (canonicalPhone !== currentCanonical) {
          user.phone = canonicalPhone;
          user.phoneVerified = false;
          user.pendingPhone = undefined;
          user.phoneOtpHash = undefined;
          user.phoneOtpExpiresAt = undefined;
          user.phoneOtpAttempts = 0;
        }
      }
    }

    if (parsed.gender !== undefined) user.gender = parsed.gender || undefined;
    if (parsed.notificationPreferences) {
      user.notificationPreferences = parsed.notificationPreferences;
    }

    let emailReverificationRequired = false;
    let verificationEmailSent = false;
    if (parsed.email !== undefined) {
      const normalizedEmail = parsed.email.toLowerCase();
      if (normalizedEmail !== user.email) {
        if (user.authProvider !== 'local') {
          res.status(400).json({
            error: `Email cannot be changed for ${user.authProvider} OAuth accounts.`,
          });
          return;
        }
        const duplicate = await UserModel.exists({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });
        if (duplicate) {
          res.status(409).json({ error: 'Another account already uses this email address.' });
          return;
        }

        const verifyToken = crypto.randomBytes(24).toString('hex');
        const now = Date.now();
        user.email = normalizedEmail;
        user.emailVerified = false;
        user.verificationTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
        user.verificationTokenExpiresAt = new Date(now + 24 * 60 * 60 * 1000);
        user.verificationResendAt = new Date(now + 60 * 1000);
        emailReverificationRequired = true;

        const emailRes = await sendTransactionalEmail({
          userId: String(user._id),
          email: user.email,
          type: 'verification',
          subject: 'Verify your updated NOVARA COMMERCE email',
          html: `<p>Hi ${escapeHtml(user.name)},</p><p>Please verify your updated email address within 24 hours: <a href="${env.appUrl}/verify-email?token=${verifyToken}">Verify Email</a></p>`,
        });
        verificationEmailSent = emailRes.delivered;
      }
    }

    const oldAvatarPublicId = user.avatarPublicId;
    if (parsed.avatarUrl !== undefined) {
      user.avatarUrl = parsed.avatarUrl || '';
      if (!parsed.avatarUrl) {
        user.avatarPublicId = undefined;
      } else if (parsed.avatarPublicId !== undefined) {
        user.avatarPublicId = parsed.avatarPublicId || undefined;
      }
    }

    await user.save();

    if (nameChanged) {
      void ReviewModel.updateMany({ userId: user._id }, { $set: { userName: user.name } }).catch(
        () => {}
      );
    }

    if (oldAvatarPublicId && oldAvatarPublicId !== user.avatarPublicId) {
      void destroyCloudinaryAssetIfUnused(oldAvatarPublicId);
    }

    const stats = await getUserAccountStats(user._id);
    res.json({
      user: sanitizeUser(user, stats, req.effectivePermissions),
      emailReverificationRequired,
      verificationEmailSent,
    });
  })
);

router.post(
  '/profile/avatar',
  avatarUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }

    const metaCheck = validateImageUploadMeta({
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      maxBytes: 4 * 1024 * 1024,
    });
    if (!metaCheck.valid) {
      res.status(400).json({ error: metaCheck.error });
      return;
    }

    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const asset = await uploadBufferToCloudinary(req.file.buffer, 'avatars', `${user.name} avatar`);
    const oldAvatarPublicId = user.avatarPublicId;
    user.avatarUrl = asset.url;
    user.avatarPublicId = asset.publicId;
    await user.save();

    if (oldAvatarPublicId && oldAvatarPublicId !== asset.publicId) {
      void destroyCloudinaryAssetIfUnused(oldAvatarPublicId);
    }

    const stats = await getUserAccountStats(user._id);
    res.status(201).json({
      asset,
      user: sanitizeUser(user, stats, req.effectivePermissions),
    });
  })
);

router.post(
  '/change-password',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6).max(100),
      confirmPassword: z.string().min(1).optional(),
    });
    const parsed = schema.parse(req.body);
    if (parsed.confirmPassword !== undefined && parsed.newPassword !== parsed.confirmPassword) {
      res.status(400).json({ error: 'New password and confirmation do not match.' });
      return;
    }
    const settings = await StoreSettingsModel.findOne({ key: 'primary' })
      .select('securitySettings')
      .lean();
    const policyCheck = validatePasswordAgainstPolicy(
      parsed.newPassword,
      settings?.securitySettings
    );
    if (!policyCheck.valid) {
      res.status(400).json({ error: policyCheck.message });
      return;
    }

    const user = await UserModel.findById(req.user!._id).select('+passwordHash');
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: 'Password change unavailable for OAuth-only account.' });
      return;
    }
    const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    const ttl = computeSessionTtl(settings?.securitySettings?.sessionTimeoutMinutes);
    const freshToken = signAuthToken(String(user._id), user.role, user.tokenVersion, ttl.expiresInSeconds);
    setAuthCookie(res, freshToken, ttl.maxAgeMs);
    res.json({ ok: true, token: freshToken, message: 'Password updated successfully.' });
  })
);

// Saved Addresses with Bangladesh hierarchical validation
router.get(
  '/addresses',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await UserModel.findById(req.user!._id);
    res.json({ addresses: user?.savedAddresses || [] });
  })
);

router.post(
  '/addresses',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = addressInputSchema.parse(req.body);
    const hierarchy = validateBangladeshHierarchy(parsed);
    if (!hierarchy.valid || !hierarchy.zone) {
      res.status(400).json({ error: 'Invalid Bangladesh Division/District/Upazila/Area combination.' });
      return;
    }

    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const shouldBeDefault = parsed.isDefault || user.savedAddresses.length === 0;
    if (shouldBeDefault) {
      for (const addr of user.savedAddresses) {
        addr.isDefault = false;
      }
    }

    user.savedAddresses.push({
      label: parsed.label,
      recipientName: parsed.recipientName,
      phone: normalizeBangladeshPhone(parsed.phone),
      divisionCode: parsed.divisionCode,
      divisionName: hierarchy.divisionName!,
      districtCode: parsed.districtCode,
      districtName: hierarchy.districtName!,
      upazilaCode: parsed.upazilaCode,
      upazilaName: hierarchy.upazilaName!,
      areaCode: parsed.areaCode,
      areaName: hierarchy.areaName!,
      zone: hierarchy.zone,
      houseAddress: parsed.houseAddress,
      roadStreet: parsed.roadStreet,
      landmark: parsed.landmark,
      deliveryInstructions: parsed.deliveryInstructions,
      isDefault: shouldBeDefault,
    } as never);

    await user.save();
    res.status(201).json({ addresses: user.savedAddresses });
  })
);

router.patch(
  '/addresses/:addressId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = toPatchSchema(addressInputSchema).parse(req.body);
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const addr = user.savedAddresses.find(
      (a: { _id?: unknown }) => String(a._id) === req.params.addressId
    );
    if (!addr) {
      res.status(404).json({ error: 'Saved address not found' });
      return;
    }

    const nextCodes = {
      divisionCode: parsed.divisionCode ?? addr.divisionCode,
      districtCode: parsed.districtCode ?? addr.districtCode,
      upazilaCode: parsed.upazilaCode ?? addr.upazilaCode,
      areaCode: parsed.areaCode ?? addr.areaCode,
    };
    const hierarchy = validateBangladeshHierarchy(nextCodes);
    if (!hierarchy.valid || !hierarchy.zone) {
      res.status(400).json({ error: 'Invalid Bangladesh administrative area hierarchy.' });
      return;
    }

    if (parsed.isDefault) {
      for (const item of user.savedAddresses) {
        item.isDefault = false;
      }
    }

    Object.assign(addr, {
      ...parsed,
      ...(parsed.phone ? { phone: normalizeBangladeshPhone(parsed.phone) } : {}),
      divisionName: hierarchy.divisionName,
      districtName: hierarchy.districtName,
      upazilaName: hierarchy.upazilaName,
      areaName: hierarchy.areaName,
      zone: hierarchy.zone,
    });

    await user.save();
    res.json({ addresses: user.savedAddresses });
  })
);

router.delete(
  '/addresses/:addressId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const beforeLen = user.savedAddresses.length;
    user.savedAddresses = user.savedAddresses.filter(
      (a: { _id?: unknown }) => String(a._id) !== req.params.addressId
    ) as typeof user.savedAddresses;

    if (user.savedAddresses.length === beforeLen) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    if (
      user.savedAddresses.length > 0 &&
      !user.savedAddresses.some((a: { isDefault?: boolean }) => a.isDefault)
    ) {
      user.savedAddresses[0].isDefault = true;
    }

    await user.save();
    res.json({ addresses: user.savedAddresses });
  })
);

// Wishlist
router.get(
  '/wishlist',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const items = await fetchFormattedWishlistItems(user.wishlist);
    const activeIds = items.map((item) => String((item as unknown as { _id?: unknown })._id));
    if (activeIds.length !== user.wishlist.length) {
      user.wishlist = activeIds.map((id) => new mongoose.Types.ObjectId(id));
      await user.save();
    }

    res.json({
      items,
      wishlist: activeIds,
    });
  })
);

router.post(
  '/wishlist',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const productId = z.string().trim().min(1).parse(req.body?.productId);
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const productExists = await ProductModel.exists({ _id: productId, status: 'published' });
    if (!productExists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingIds = user.wishlist.map((id: unknown) => String(id));
    const alreadyExists = existingIds.includes(productId);
    const merged = mergeWishlistIds(existingIds, [productId]);
    user.wishlist = merged.map((id) => new mongoose.Types.ObjectId(id));
    await user.save();

    const items = await fetchFormattedWishlistItems(user.wishlist);
    res.status(alreadyExists ? 200 : 201).json({
      added: !alreadyExists,
      wishlist: merged,
      items,
    });
  })
);

router.post(
  '/wishlist/toggle',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const productId = z.string().trim().min(1).parse(req.body?.productId);
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const productExists = await ProductModel.exists({ _id: productId, status: 'published' });
    if (!productExists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const idx = user.wishlist.findIndex((id: unknown) => String(id) === productId);
    let added = false;
    if (idx >= 0) {
      user.wishlist.splice(idx, 1);
    } else {
      user.wishlist.push(new mongoose.Types.ObjectId(productId));
      added = true;
    }
    await user.save();

    res.json({
      added,
      wishlist: user.wishlist.map((id: unknown) => String(id)),
    });
  })
);

router.post(
  '/wishlist/merge',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      productIds: z.array(z.string().trim().min(1)).max(100),
    });
    const parsed = schema.parse(req.body);
    const candidateIds = parsed.productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const published = candidateIds.length
      ? await ProductModel.find({ _id: { $in: candidateIds }, status: 'published' })
          .select('_id')
          .lean()
      : [];
    const validPublishedIds = published.map((p) => String(p._id));

    const merged = mergeWishlistIds(
      user.wishlist.map((id: unknown) => String(id)),
      validPublishedIds
    );
    user.wishlist = merged.map((id) => new mongoose.Types.ObjectId(id));
    await user.save();

    const items = await fetchFormattedWishlistItems(user.wishlist);
    res.json({
      wishlist: merged,
      items,
    });
  })
);

router.delete(
  '/wishlist/:productId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }

    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const before = user.wishlist.length;
    user.wishlist = user.wishlist.filter(
      (id: unknown) => String(id) !== productId
    ) as typeof user.wishlist;

    if (user.wishlist.length !== before) {
      await user.save();
    }

    res.json({
      removed: true,
      wishlist: user.wishlist.map((id: unknown) => String(id)),
    });
  })
);

router.delete(
  '/wishlist',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await UserModel.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.wishlist = [];
    await user.save();

    res.json({
      cleared: true,
      wishlist: [],
    });
  })
);

// Admin: Customer list with aggregated order count & spend + customer group
router.get(
  '/admin/customers',
  requirePermission('customers:read'),
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    const filter: Record<string, unknown> = { role: 'customer' };
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      filter.customerGroupId = groupId;
    }
    if (status === 'active') filter.isActive = true;
    else if (status === 'inactive') filter.isActive = false;

    if (search) {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [customersRaw, total] = await Promise.all([
      UserModel.find(filter)
        .select('name email phone isActive emailVerified authProvider customerGroupId avatarUrl createdAt lastLoginAt')
        .populate('customerGroupId', 'name slug badgeColor discountPercent')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const customerIds = customersRaw.map((c) => c._id);
    const orderStats = customerIds.length
      ? await OrderModel.aggregate<{
          _id: mongoose.Types.ObjectId;
          ordersCount: number;
          totalSpent: number;
        }>([
          {
            $match: {
              userId: { $in: customerIds },
              orderStatus: { $nin: ['cancelled', 'payment_failed', 'refunded'] },
            },
          },
          {
            $group: {
              _id: '$userId',
              ordersCount: { $sum: 1 },
              totalSpent: { $sum: '$totalAmount' },
            },
          },
        ])
      : [];

    const statsMap = new Map(
      orderStats.map((s) => [String(s._id), { ordersCount: s.ordersCount, totalSpent: s.totalSpent }])
    );

    const customers = customersRaw.map((c) => {
      const st = statsMap.get(String(c._id)) || { ordersCount: 0, totalSpent: 0 };
      return {
        ...c,
        ordersCount: st.ordersCount,
        totalSpent: st.totalSpent,
      };
    });

    res.json({ customers, total, page, totalPages: Math.ceil(total / limit) });
  })
);

router.get(
  '/admin/customers/:id',
  requirePermission('customers:read'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid customer ID.' });
      return;
    }
    const customer = await UserModel.findOne({ _id: req.params.id, role: 'customer' })
      .select('-passwordHash -resetTokenHash -resetTokenExpiresAt -verificationTokenHash')
      .populate('customerGroupId', 'name slug badgeColor discountPercent')
      .lean();
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const orders = await OrderModel.find({ userId: customer._id })
      .sort({ createdAt: -1 })
      .limit(25)
      .select('orderNumber orderStatus paymentStatus totalAmount items createdAt shippingAddress')
      .lean();

    const validOrders = orders.filter(
      (o) => !['cancelled', 'payment_failed', 'refunded'].includes(o.orderStatus)
    );
    const totalSpent = validOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

    res.json({
      customer,
      orders,
      stats: {
        ordersCount: orders.length,
        totalSpent,
      },
    });
  })
);

router.patch(
  '/admin/customers/:id',
  requirePermission('customers:read'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const canModify =
      (await userHasEffectivePermission(req.user, 'support:manage', req.effectivePermissions)) ||
      (await userHasEffectivePermission(req.user, 'settings:write', req.effectivePermissions));
    if (!canModify) {
      res.status(403).json({ error: 'You do not have permission to modify customer accounts.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid customer ID.' });
      return;
    }

    const schema = z.object({
      isActive: z.boolean().optional(),
      customerGroupId: z.string().nullable().optional(),
      name: z.string().trim().min(2).max(100).optional(),
      phone: z.string().trim().max(25).optional(),
      emailVerified: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const customer = await UserModel.findOne({ _id: req.params.id, role: 'customer' });
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    if (parsed.isActive !== undefined) {
      customer.isActive = parsed.isActive;
      if (!parsed.isActive) customer.tokenVersion = (customer.tokenVersion ?? 0) + 1;
    }
    if (parsed.customerGroupId !== undefined) {
      if (parsed.customerGroupId && !mongoose.Types.ObjectId.isValid(parsed.customerGroupId)) {
        res.status(400).json({ error: 'Invalid customer group ID.' });
        return;
      }
      customer.customerGroupId = parsed.customerGroupId
        ? new mongoose.Types.ObjectId(parsed.customerGroupId)
        : null;
    }
    if (parsed.name !== undefined) customer.name = parsed.name;
    if (parsed.phone !== undefined) customer.phone = parsed.phone;
    if (parsed.emailVerified !== undefined) customer.emailVerified = parsed.emailVerified;

    await customer.save();
    await customer.populate('customerGroupId', 'name slug badgeColor discountPercent');

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_CUSTOMER',
      resourceType: 'User',
      resourceId: String(customer._id),
      details: parsed,
      ipAddress: req.ip,
    });

    res.json({ customer });
  })
);

// Admin: Customer Groups CRUD
const customerGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(90).toLowerCase(),
  description: z.string().trim().max(300).optional().default(''),
  discountPercent: z.number().min(0).max(50).default(0),
  badgeColor: z.string().trim().max(20).default('#16A34A'),
  isActive: z.boolean().default(true),
});

router.get(
  '/admin/customer-groups',
  requirePermission('customers:read'),
  asyncHandler(async (_req, res) => {
    const [groups, memberCounts] = await Promise.all([
      CustomerGroupModel.find().sort({ name: 1 }).lean(),
      UserModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { role: 'customer', customerGroupId: { $ne: null } } },
        { $group: { _id: '$customerGroupId', count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map(memberCounts.map((m) => [String(m._id), m.count]));
    res.json({
      groups: groups.map((g) => ({
        ...g,
        memberCount: countMap.get(String(g._id)) || 0,
      })),
    });
  })
);

router.post(
  '/admin/customer-groups',
  requirePermission('customers:read'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const canCreate =
      (await userHasEffectivePermission(req.user, 'support:manage', req.effectivePermissions)) ||
      (await userHasEffectivePermission(req.user, 'settings:write', req.effectivePermissions)) ||
      (await userHasEffectivePermission(req.user, 'coupons:write', req.effectivePermissions));
    if (!canCreate) {
      res.status(403).json({ error: 'Insufficient permission to create customer groups.' });
      return;
    }
    const parsed = customerGroupSchema.parse(req.body);
    const group = await CustomerGroupModel.create(parsed);
    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_CUSTOMER_GROUP',
      resourceType: 'CustomerGroup',
      resourceId: String(group._id),
      details: { name: group.name, discountPercent: group.discountPercent },
      ipAddress: req.ip,
    });
    res.status(201).json({ group });
  })
);

router.patch(
  '/admin/customer-groups/:id',
  requirePermission('customers:read'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const canUpdate =
      (await userHasEffectivePermission(req.user, 'support:manage', req.effectivePermissions)) ||
      (await userHasEffectivePermission(req.user, 'settings:write', req.effectivePermissions)) ||
      (await userHasEffectivePermission(req.user, 'coupons:write', req.effectivePermissions));
    if (!canUpdate) {
      res.status(403).json({ error: 'Insufficient permission to update customer groups.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid customer group ID.' });
      return;
    }
    const parsed = toPatchSchema(customerGroupSchema).parse(req.body);
    const group = await CustomerGroupModel.findByIdAndUpdate(req.params.id, parsed, {
      new: true,
      runValidators: true,
    });
    if (!group) {
      res.status(404).json({ error: 'Customer group not found' });
      return;
    }
    res.json({ group });
  })
);

router.delete(
  '/admin/customer-groups/:id',
  requirePermission('customers:read'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const canDelete =
      (await userHasEffectivePermission(req.user, 'support:manage', req.effectivePermissions)) ||
      (await userHasEffectivePermission(req.user, 'settings:write', req.effectivePermissions));
    if (!canDelete) {
      res.status(403).json({ error: 'Insufficient permission to delete customer groups.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid customer group ID.' });
      return;
    }
    const deleted = await CustomerGroupModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Customer group not found' });
      return;
    }
    await UserModel.updateMany({ customerGroupId: deleted._id }, { $set: { customerGroupId: null } });
    res.json({ ok: true });
  })
);

// Admin: Staff RBAC management
router.get(
  '/admin/staff',
  requirePermission('staff:manage'),
  asyncHandler(async (_req, res) => {
    const staff = await UserModel.find({ role: { $ne: 'customer' } })
      .select('name email phone role isActive createdAt lastLoginAt')
      .sort({ createdAt: -1 });
    res.json({ staff });
  })
);

router.post(
  '/admin/staff',
  requirePermission('staff:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email(),
      phone: z.string().trim().max(25).optional(),
      password: z.string().min(6).max(100),
      role: z.enum(STAFF_ROLES as [StaffRole, ...StaffRole[]]),
    });
    const parsed = schema.parse(req.body);
    const settings = await StoreSettingsModel.findOne({ key: 'primary' })
      .select('securitySettings')
      .lean();
    const policyCheck = validatePasswordAgainstPolicy(parsed.password, settings?.securitySettings);
    if (!policyCheck.valid) {
      res.status(400).json({ error: policyCheck.message });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.password, 12);

    const staffUser = await UserModel.create({
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone,
      passwordHash,
      role: parsed.role,
      emailVerified: true,
      isActive: true,
    });

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_STAFF',
      resourceType: 'User',
      resourceId: String(staffUser._id),
      details: { role: staffUser.role, email: staffUser.email },
      ipAddress: req.ip,
    });

    res.status(201).json({
      staff: {
        id: String(staffUser._id),
        name: staffUser.name,
        email: staffUser.email,
        role: staffUser.role,
        isActive: staffUser.isActive,
      },
    });
  })
);

router.patch(
  '/admin/staff/:staffId',
  requirePermission('staff:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.staffId)) {
      res.status(400).json({ error: 'Invalid staff ID.' });
      return;
    }
    const schema = z.object({
      role: z.enum(STAFF_ROLES as [StaffRole, ...StaffRole[]]).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const target = await UserModel.findById(req.params.staffId);
    if (!target) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    if (String(target._id) === String(req.user!._id) && parsed.isActive === false) {
      res.status(400).json({ error: 'You cannot deactivate your own Super Admin account.' });
      return;
    }

    const losingSuperAdmin =
      target.role === 'super_admin' &&
      target.isActive &&
      ((parsed.role && parsed.role !== 'super_admin') || parsed.isActive === false);
    if (losingSuperAdmin) {
      const otherActiveSuperAdmin = await UserModel.exists({
        _id: { $ne: target._id },
        role: 'super_admin',
        isActive: true,
      });
      if (!otherActiveSuperAdmin) {
        res.status(409).json({
          error: 'At least one active Super Admin account must remain.',
        });
        return;
      }
    }

    const revokingAccess =
      parsed.isActive === false || (parsed.role && parsed.role !== target.role);
    if (parsed.role) target.role = parsed.role;
    if (parsed.isActive !== undefined) target.isActive = parsed.isActive;
    if (revokingAccess) {
      target.tokenVersion = (target.tokenVersion ?? 0) + 1;
    }
    await target.save();

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_STAFF_PERMISSIONS',
      resourceType: 'User',
      resourceId: String(target._id),
      details: parsed,
      ipAddress: req.ip,
    });

    res.json({
      staff: {
        id: String(target._id),
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
      },
    });
  })
);

// Admin: Roles & Permission Matrix
router.get(
  '/admin/roles',
  requirePermission('staff:manage'),
  asyncHandler(async (_req, res) => {
    const [storedDefs, staffCounts] = await Promise.all([
      RoleDefinitionModel.find().lean(),
      UserModel.aggregate<{ _id: string; count: number }>([
        { $match: { role: { $ne: 'customer' } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);
    const storedMap = new Map(storedDefs.map((d) => [d.roleKey, d]));
    const countMap = new Map(staffCounts.map((s) => [s._id, s.count]));

    const roles = STAFF_ROLES.map((roleKey) => {
      const stored = storedMap.get(roleKey);
      const meta = ROLE_METADATA[roleKey];
      return {
        roleKey,
        label: stored?.label || meta.label,
        description: stored?.description || meta.description,
        permissions: stored?.permissions?.length
          ? stored.permissions
          : ROLE_PERMISSIONS[roleKey] || [],
        isSystem: true,
        staffCount: countMap.get(roleKey) || 0,
        updatedAt: stored?.updatedAt || null,
      };
    });

    res.json({ roles, allPermissions: ALL_PERMISSIONS });
  })
);

router.put(
  '/admin/roles/:roleKey',
  requirePermission('staff:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const roleKey = req.params.roleKey as StaffRole;
    if (!STAFF_ROLES.includes(roleKey)) {
      res.status(400).json({ error: 'Unknown staff role key.' });
      return;
    }

    const schema = z.object({
      label: z.string().trim().min(2).max(80).optional(),
      description: z.string().trim().max(240).optional(),
      permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).min(1),
    });
    const parsed = schema.parse(req.body);

    let nextPermissions = Array.from(new Set(parsed.permissions));
    if (roleKey === 'super_admin') {
      nextPermissions = Array.from(new Set([...ALL_PERMISSIONS]));
    }

    const meta = ROLE_METADATA[roleKey];
    const updated = await RoleDefinitionModel.findOneAndUpdate(
      { roleKey },
      {
        $set: {
          roleKey,
          label: parsed.label || meta.label,
          description: parsed.description ?? meta.description,
          permissions: nextPermissions,
          isSystem: true,
        },
      },
      { upsert: true, new: true }
    );
    invalidateRolePermissionCache(roleKey);

    await recordAuditLog({
      actorId: req.user!._id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE_ROLE_DEFINITION',
      resourceType: 'RoleDefinition',
      resourceId: roleKey,
      details: { permissionsCount: nextPermissions.length },
      ipAddress: req.ip,
    });

    res.json({ role: updated });
  })
);

export default router;
