import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.ts';
import type { Permission } from '../../../../shared/rbac.ts';
import { isStaffRole } from '../../../../shared/rbac.ts';
import {
  getBangladeshPhoneVariants,
  isValidBangladeshPhone,
  toCanonicalBangladeshPhone,
} from '../../../../shared/bangladeshLocations.ts';
import {
  computeSessionTtl,
  escapeHtml,
  validateFullName,
  validatePasswordAgainstPolicy,
} from '../../../../shared/security.ts';
import { computeMembershipTier } from '../../../../shared/wishlistHelpers.ts';
import { getDatabaseStatus, requireDatabase } from '../../database/connection.ts';
import {
  clearAuthCookie,
  extractAuthToken,
  isCsrfSafeRequest,
  optionalAuth,
  requireAuth,
  setAuthCookie,
  signAuthToken,
  type AuthJwtPayload,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { sendTransactionalEmail } from '../../services/email.service.ts';
import { getEffectivePermissionsForRole } from '../../services/rbac.service.ts';
import { sendTransactionalSms } from '../../services/sms.service.ts';
import { StoreSettingsModel } from '../cms/cms.model.ts';
import { ReviewModel } from '../marketing/marketing.model.ts';
import { OrderModel } from '../orders/order.model.ts';
import { UserModel } from '../users/user.model.ts';

const OAUTH_STATE_COOKIE = 'novara_oauth_state';

function signOAuthState(state: string, provider: string): string {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${provider}:${state}`).digest('hex');
}

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again shortly.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(100),
  email: z.string().trim().email('Please enter a valid email address.').max(150),
  phone: z
    .string()
    .trim()
    .min(1, 'Bangladesh mobile number is required.')
    .max(25)
    .refine(isValidBangladeshPhone, 'Please enter a valid Bangladesh mobile number (e.g. +880 17XXXXXXXX).'),
  password: z.string().min(6).max(100),
  confirmPassword: z.string().min(1, 'Please confirm your password.'),
  termsAccepted: z.literal(true, {
    error: 'You must accept the Terms & Conditions and Privacy Policy to create an account.',
  }),
});

const bootstrapSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  phone: z.string().trim().min(6).max(25).optional(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const resetRequestSchema = z.object({
  email: z.string().trim().email(),
});

const resetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(6).max(100),
});

function hashOtpCode(userId: string, canonicalPhone: string, otp: string): string {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${canonicalPhone}:${otp}`)
    .digest('hex');
}

export function sanitizeUser(
  user: InstanceType<typeof UserModel>,
  stats?: {
    deliveredOrdersCount?: number;
    totalDeliveredSpend?: number;
    ordersCount?: number;
    reviewsCount?: number;
  },
  permissions?: Permission[]
) {
  const membershipTier = computeMembershipTier({
    deliveredOrdersCount: stats?.deliveredOrdersCount ?? 0,
    totalDeliveredSpend: stats?.totalDeliveredSpend ?? 0,
    emailVerified: Boolean(user.emailVerified),
  });
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    gender: user.gender || undefined,
    role: user.role,
    permissions: permissions ?? undefined,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    pendingPhone: user.pendingPhone || '',
    termsAcceptedAt: user.termsAcceptedAt ? new Date(user.termsAcceptedAt).toISOString() : undefined,
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl || '',
    avatarPublicId: user.avatarPublicId || '',
    savedAddresses: user.savedAddresses || [],
    wishlist: (user.wishlist || []).map((id: unknown) => String(id)),
    notificationPreferences: user.notificationPreferences,
    membershipTier,
    ordersCount: stats?.ordersCount ?? 0,
    reviewsCount: stats?.reviewsCount ?? 0,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
  };
}

export async function getUserAccountStats(userId: unknown) {
  const [ordersCount, deliveredAgg, reviewsCount] = await Promise.all([
    OrderModel.countDocuments({ userId }),
    OrderModel.aggregate<{ count: number; totalSpend: number }>([
      { $match: { userId, orderStatus: 'delivered' } },
      { $group: { _id: null, count: { $sum: 1 }, totalSpend: { $sum: '$totalAmount' } } },
    ]),
    ReviewModel.countDocuments({ userId }),
  ]);

  return {
    ordersCount,
    deliveredOrdersCount: deliveredAgg[0]?.count ?? 0,
    totalDeliveredSpend: deliveredAgg[0]?.totalSpend ?? 0,
    reviewsCount,
  };
}

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    let needsSuperAdminBootstrap = false;
    let requireEmailVerification = false;
    if (getDatabaseStatus().connected) {
      try {
        const [superAdminCount, settings] = await Promise.all([
          UserModel.countDocuments({ role: 'super_admin' }),
          StoreSettingsModel.findOne({ key: 'primary' }).select('securitySettings').lean(),
        ]);
        needsSuperAdminBootstrap = superAdminCount === 0 && !env.adminEmail;
        requireEmailVerification = Boolean(settings?.securitySettings?.requireEmailVerification);
      } catch {
        needsSuperAdminBootstrap = false;
      }
    }

    res.json({
      googleConfigured: env.oauth.isGoogleConfigured,
      facebookConfigured: env.oauth.isFacebookConfigured,
      emailConfigured: env.resend.isConfigured,
      smsConfigured: env.sms.isConfigured,
      requireEmailVerification,
      needsSuperAdminBootstrap,
    });
  })
);

router.post(
  '/bootstrap-admin',
  requireDatabase,
  authLimiter,
  asyncHandler(async (req, res) => {
    const existingSuperAdmin = await UserModel.exists({ role: 'super_admin' });
    if (existingSuperAdmin || env.adminEmail) {
      res.status(409).json({
        error: 'Bootstrap locked',
        message: 'A Super Admin account is already configured.',
      });
      return;
    }

    const parsed = bootstrapSchema.parse(req.body);
    const settings = await StoreSettingsModel.findOne({ key: 'primary' })
      .select('securitySettings')
      .lean();
    const policyCheck = validatePasswordAgainstPolicy(parsed.password, settings?.securitySettings);
    if (!policyCheck.valid) {
      res.status(400).json({ error: policyCheck.message });
      return;
    }

    const email = parsed.email.toLowerCase();
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const admin = await UserModel.create({
      name: parsed.name,
      email,
      phone: parsed.phone,
      passwordHash,
      role: 'super_admin',
      emailVerified: true,
      authProvider: 'local',
      lastLoginAt: new Date(),
    });

    const ttl = computeSessionTtl(settings?.securitySettings?.sessionTimeoutMinutes);
    const token = signAuthToken(String(admin._id), admin.role, admin.tokenVersion ?? 0, ttl.expiresInSeconds);
    setAuthCookie(res, token, ttl.maxAgeMs);
    const permissions = await getEffectivePermissionsForRole(admin.role);

    await recordAuditLog({
      actorId: admin._id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'BOOTSTRAP_SUPER_ADMIN',
      resourceType: 'User',
      resourceId: String(admin._id),
      ipAddress: req.ip,
    });

    res.status(201).json({ token, user: sanitizeUser(admin, undefined, permissions) });
  })
);

router.post(
  '/register',
  requireDatabase,
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.parse(req.body);
    const nameCheck = validateFullName(parsed.name);
    if (!nameCheck.valid) {
      res.status(400).json({ error: nameCheck.message });
      return;
    }

    if (parsed.password !== parsed.confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const settings = await StoreSettingsModel.findOne({ key: 'primary' })
      .select('securitySettings')
      .lean();
    const policyCheck = validatePasswordAgainstPolicy(parsed.password, settings?.securitySettings);
    if (!policyCheck.valid) {
      res.status(400).json({ error: policyCheck.message });
      return;
    }

    const email = parsed.email.toLowerCase();
    const canonicalPhone = toCanonicalBangladeshPhone(parsed.phone);
    const phoneVariants = getBangladeshPhoneVariants(parsed.phone);

    const [existingEmail, existingPhone] = await Promise.all([
      UserModel.findOne({ email }).select('_id'),
      phoneVariants.length > 0
        ? UserModel.findOne({ phone: { $in: phoneVariants } }).select('_id')
        : Promise.resolve(null),
    ]);

    if (existingEmail) {
      res.status(409).json({
        error: 'Account already exists',
        message: 'An account with this email address already exists.',
      });
      return;
    }

    if (existingPhone) {
      res.status(409).json({
        error: 'Mobile number already registered',
        message: 'An account with this Bangladesh mobile number already exists.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const verifyToken = crypto.randomBytes(24).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const now = new Date();
    const verificationTokenExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const verificationResendAt = new Date(now.getTime() + 60 * 1000);

    const user = await UserModel.create({
      name: nameCheck.normalized,
      email,
      phone: canonicalPhone,
      passwordHash,
      role: 'customer',
      emailVerified: false,
      phoneVerified: false,
      authProvider: 'local',
      verificationTokenHash,
      verificationTokenExpiresAt,
      verificationResendAt,
      verificationAttempts: 0,
      termsAcceptedAt: now,
      lastLoginAt: now,
    });

    const emailResult = await sendTransactionalEmail({
      userId: String(user._id),
      email: user.email,
      type: 'verification',
      subject: 'Verify your NOVARA COMMERCE email',
      html: `<p>Welcome to NOVARA COMMERCE, ${escapeHtml(user.name)}.</p><p>Verify your account within 24 hours: <a href="${env.appUrl}/verify-email?token=${verifyToken}">Verify Email</a></p>`,
    });

    const requireEmailVerification = Boolean(settings?.securitySettings?.requireEmailVerification);
    if (requireEmailVerification) {
      res.status(201).json({
        requiresEmailVerification: true,
        verificationEmailSent: emailResult.delivered,
        emailStatus: emailResult.status,
        user: sanitizeUser(user, undefined, []),
        message: emailResult.delivered
          ? 'Account created! Please check your inbox and verify your email address before signing in.'
          : 'Account created! Email verification is required, and email delivery awaits RESEND_API_KEY configuration.',
      });
      return;
    }

    const ttl = computeSessionTtl(settings?.securitySettings?.sessionTimeoutMinutes);
    const token = signAuthToken(String(user._id), user.role, user.tokenVersion ?? 0, ttl.expiresInSeconds);
    setAuthCookie(res, token, ttl.maxAgeMs);

    res.status(201).json({
      token,
      requiresEmailVerification: false,
      verificationEmailSent: emailResult.delivered,
      emailStatus: emailResult.status,
      user: sanitizeUser(user, undefined, []),
    });
  })
);

router.post(
  '/login',
  requireDatabase,
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const email = parsed.email.toLowerCase();

    const [user, settings] = await Promise.all([
      UserModel.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockoutUntil'),
      StoreSettingsModel.findOne({ key: 'primary' }).select('securitySettings').lean(),
    ]);
    if (!user || !user.passwordHash) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Incorrect email or password.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'Account disabled',
        message: 'This account has been suspended. Please contact support.',
      });
      return;
    }

    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      const minutesLeft = Math.max(1, Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000));
      res.status(423).json({
        error: 'Account temporarily locked',
        code: 'ACCOUNT_LOCKED',
        message: `Too many failed sign-in attempts. Please try again in ${minutesLeft} minute(s).`,
      });
      return;
    }

    const sec = settings?.securitySettings;
    const maxAttempts = Math.min(50, Math.max(3, Number(sec?.maxLoginAttempts ?? 10)));
    const lockoutMinutes = Math.min(240, Math.max(1, Number(sec?.lockoutMinutes ?? 15)));

    const validPassword = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!validPassword) {
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      user.failedLoginAttempts = nextAttempts;
      if (nextAttempts >= maxAttempts) {
        user.lockoutUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Incorrect email or password.',
      });
      return;
    }

    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;

    if (sec?.requireEmailVerification && !user.emailVerified && !isStaffRole(user.role)) {
      res.status(403).json({
        error: 'Email verification required',
        code: 'EMAIL_UNVERIFIED',
        message:
          'Please verify your email address before signing in. You can request a fresh verification link below.',
      });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const [stats, permissions] = await Promise.all([
      getUserAccountStats(user._id),
      getEffectivePermissionsForRole(user.role),
    ]);
    const ttl = computeSessionTtl(sec?.sessionTimeoutMinutes);
    const token = signAuthToken(String(user._id), user.role, user.tokenVersion ?? 0, ttl.expiresInSeconds);
    setAuthCookie(res, token, ttl.maxAgeMs);

    res.json({
      token,
      user: sanitizeUser(user, stats, permissions),
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = extractAuthToken(req);
    if (token && getDatabaseStatus().connected && isCsrfSafeRequest(req)) {
      try {
        const decoded = jwt.verify(token, env.jwtSecret) as AuthJwtPayload;
        if (decoded?.sub) {
          await UserModel.findByIdAndUpdate(decoded.sub, { $inc: { tokenVersion: 1 } });
        }
      } catch {
        // Expired or invalid token still clears client cookie cleanly
      }
    }
    clearAuthCookie(res);
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireDatabase,
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await getUserAccountStats(req.user!._id);
    res.json({ user: sanitizeUser(req.user!, stats, req.effectivePermissions) });
  })
);

router.post(
  '/verify-email',
  requireDatabase,
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = z.string().min(10).parse(req.body?.token);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await UserModel.findOne({ verificationTokenHash: tokenHash }).select(
      '+verificationTokenHash +verificationTokenExpiresAt +verificationResendAt +verificationAttempts'
    );
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token.' });
      return;
    }
    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt.getTime() < Date.now()) {
      user.verificationTokenHash = undefined;
      user.verificationTokenExpiresAt = undefined;
      await user.save();
      res.status(400).json({
        error: 'This verification link has expired. Please request a fresh verification email.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    user.emailVerified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpiresAt = undefined;
    user.verificationResendAt = undefined;
    user.verificationAttempts = 0;
    await user.save();
    res.json({ ok: true, message: 'Email verified successfully.' });
  })
);

router.post(
  '/verify-email/resend',
  requireDatabase,
  authLimiter,
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    let targetUser = req.user
      ? await UserModel.findById(req.user._id).select('+verificationResendAt')
      : null;

    if (!targetUser) {
      const emailParsed = z.object({ email: z.string().trim().email() }).safeParse(req.body);
      if (!emailParsed.success) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      targetUser = await UserModel.findOne({ email: emailParsed.data.email.toLowerCase() }).select(
        '+verificationResendAt'
      );
      if (!targetUser || targetUser.emailVerified || targetUser.authProvider !== 'local') {
        res.json({
          ok: true,
          cooldownSeconds: 60,
          message:
            'If an unverified account matches that email, a fresh verification link has been sent.',
        });
        return;
      }
    } else if (targetUser.emailVerified) {
      res.status(400).json({ error: 'Your email address is already verified.' });
      return;
    }

    if (targetUser.verificationResendAt && targetUser.verificationResendAt.getTime() > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((targetUser.verificationResendAt.getTime() - Date.now()) / 1000)
      );
      if (req.user) {
        res.status(429).json({
          error: `Please wait ${retryAfterSeconds}s before requesting another verification email.`,
          retryAfterSeconds,
        });
        return;
      }
      res.json({
        ok: true,
        cooldownSeconds: retryAfterSeconds,
        message:
          'If an unverified account matches that email, a fresh verification link has been sent.',
      });
      return;
    }

    const verifyToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    targetUser.verificationTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    targetUser.verificationTokenExpiresAt = new Date(now + 24 * 60 * 60 * 1000);
    targetUser.verificationResendAt = new Date(now + 60 * 1000);
    await targetUser.save();

    const emailRes = await sendTransactionalEmail({
      userId: String(targetUser._id),
      email: targetUser.email,
      type: 'verification',
      subject: 'Verify your NOVARA COMMERCE email',
      html: `<p>Hi ${escapeHtml(targetUser.name)},</p><p>Verify your email address within 24 hours: <a href="${env.appUrl}/verify-email?token=${verifyToken}">Verify Email</a></p>`,
    });

    if (req.user) {
      res.json({
        ok: true,
        delivered: emailRes.delivered,
        emailStatus: emailRes.status,
        cooldownSeconds: 60,
        message: emailRes.delivered
          ? 'Verification email sent. Please check your inbox.'
          : 'Email provider (RESEND_API_KEY) is not configured yet in this environment.',
      });
      return;
    }

    res.json({
      ok: true,
      delivered: emailRes.delivered,
      emailStatus: emailRes.status,
      cooldownSeconds: 60,
      message:
        'If an unverified account matches that email, a fresh verification link has been sent.',
    });
  })
);

router.post(
  '/phone/send-otp',
  requireDatabase,
  authLimiter,
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      phone: z
        .string()
        .trim()
        .min(8)
        .max(25)
        .refine(
          isValidBangladeshPhone,
          'Please enter a valid Bangladesh mobile number (e.g. +880 17XXXXXXXX).'
        ),
    });
    const parsed = schema.parse(req.body);
    const canonicalPhone = toCanonicalBangladeshPhone(parsed.phone);
    const variants = getBangladeshPhoneVariants(parsed.phone);

    const user = await UserModel.findById(req.user!._id).select(
      '+phoneOtpHash +phoneOtpExpiresAt +phoneOtpAttempts +phoneOtpResendAt'
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (variants.length > 0) {
      const duplicate = await UserModel.exists({
        _id: { $ne: user._id },
        phone: { $in: variants },
        phoneVerified: true,
      });
      if (duplicate) {
        res.status(409).json({
          error: 'This mobile number is already verified on another account.',
        });
        return;
      }
    }

    if (user.phoneOtpResendAt && user.phoneOtpResendAt.getTime() > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((user.phoneOtpResendAt.getTime() - Date.now()) / 1000)
      );
      res.status(429).json({
        error: `Please wait ${retryAfterSeconds}s before requesting another OTP code.`,
        retryAfterSeconds,
      });
      return;
    }

    if (!env.sms.isConfigured) {
      await sendTransactionalSms({
        userId: String(user._id),
        phone: canonicalPhone,
        purpose: 'phone_verification',
        message: '',
      });
      res.status(503).json({
        error: 'SMS verification service not configured',
        code: 'SMS_UNCONFIGURED',
        message:
          'SMS OTP delivery requires SMS_API_URL and SMS_API_KEY configuration in the server environment.',
      });
      return;
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const now = Date.now();
    user.pendingPhone = canonicalPhone;
    user.phoneOtpHash = hashOtpCode(String(user._id), canonicalPhone, otp);
    user.phoneOtpExpiresAt = new Date(now + 5 * 60 * 1000);
    user.phoneOtpAttempts = 0;
    user.phoneOtpResendAt = new Date(now + 60 * 1000);
    await user.save();

    const smsResult = await sendTransactionalSms({
      userId: String(user._id),
      phone: canonicalPhone,
      purpose: 'phone_verification',
      message: `Your NOVARA COMMERCE verification code is ${otp}. Valid for 5 minutes.`,
    });

    if (!smsResult.delivered) {
      res.status(502).json({
        error: smsResult.errorMessage || 'Unable to deliver verification SMS at this time.',
      });
      return;
    }

    res.json({
      ok: true,
      pendingPhone: canonicalPhone,
      expiresInSeconds: 300,
      cooldownSeconds: 60,
      message: 'A 6-digit verification code has been sent to your mobile number.',
    });
  })
);

router.post(
  '/phone/verify-otp',
  requireDatabase,
  authLimiter,
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({
        otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code.'),
      })
      .parse(req.body);

    const user = await UserModel.findById(req.user!._id).select(
      '+phoneOtpHash +phoneOtpExpiresAt +phoneOtpAttempts +phoneOtpResendAt'
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.pendingPhone || !user.phoneOtpHash || !user.phoneOtpExpiresAt) {
      res.status(400).json({
        error: 'No pending mobile OTP found. Please request a new verification code.',
      });
      return;
    }

    if (user.phoneOtpExpiresAt.getTime() < Date.now()) {
      user.pendingPhone = undefined;
      user.phoneOtpHash = undefined;
      user.phoneOtpExpiresAt = undefined;
      user.phoneOtpAttempts = 0;
      await user.save();
      res.status(400).json({
        error: 'Your verification code has expired. Please request a new OTP.',
        code: 'OTP_EXPIRED',
      });
      return;
    }

    const currentAttempts = user.phoneOtpAttempts ?? 0;
    if (currentAttempts >= 5) {
      user.pendingPhone = undefined;
      user.phoneOtpHash = undefined;
      user.phoneOtpExpiresAt = undefined;
      user.phoneOtpAttempts = 0;
      await user.save();
      res.status(429).json({
        error: 'Too many incorrect OTP attempts. Please request a fresh verification code.',
      });
      return;
    }

    const expectedHash = hashOtpCode(String(user._id), user.pendingPhone, parsed.otp);
    const hashMatches =
      expectedHash.length === user.phoneOtpHash.length &&
      crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(user.phoneOtpHash));

    if (!hashMatches) {
      user.phoneOtpAttempts = currentAttempts + 1;
      await user.save();
      const remainingAttempts = Math.max(0, 5 - user.phoneOtpAttempts);
      res.status(400).json({
        error: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts,
      });
      return;
    }

    const variants = getBangladeshPhoneVariants(user.pendingPhone);
    if (variants.length > 0) {
      const duplicate = await UserModel.exists({
        _id: { $ne: user._id },
        phone: { $in: variants },
        phoneVerified: true,
      });
      if (duplicate) {
        res.status(409).json({
          error: 'This mobile number is already verified on another account.',
        });
        return;
      }
    }

    user.phone = user.pendingPhone;
    user.phoneVerified = true;
    user.pendingPhone = undefined;
    user.phoneOtpHash = undefined;
    user.phoneOtpExpiresAt = undefined;
    user.phoneOtpAttempts = 0;
    user.phoneOtpResendAt = undefined;
    await user.save();

    const stats = await getUserAccountStats(user._id);
    res.json({
      ok: true,
      user: sanitizeUser(user, stats, req.effectivePermissions),
      message: 'Mobile number verified successfully.',
    });
  })
);

router.post(
  '/password-reset/request',
  requireDatabase,
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = resetRequestSchema.parse(req.body);
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (user && user.authProvider === 'local') {
      const resetToken = crypto.randomBytes(24).toString('hex');
      user.resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      await sendTransactionalEmail({
        userId: String(user._id),
        email: user.email,
        type: 'password_reset',
        subject: 'Reset your NOVARA COMMERCE password',
        html: `<p>Use this link within 60 minutes to reset your password:</p><p><a href="${env.appUrl}/reset-password?token=${resetToken}">Reset Password</a></p>`,
      });
    }

    res.json({
      ok: true,
      message: 'If an eligible account exists for that email, a password reset link has been sent.',
    });
  })
);

router.post(
  '/password-reset/confirm',
  requireDatabase,
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resetConfirmSchema.parse(req.body);
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

    const tokenHash = crypto.createHash('sha256').update(parsed.token).digest('hex');
    const user = await UserModel.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpiresAt');

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  })
);

// Real OAuth Popup Flow (Google & Facebook) using APP_URL callback
router.get(
  '/oauth/:provider/url',
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    const redirectUri = `${env.appUrl}/api/auth/oauth/${provider}/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    const stateCookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      partitioned: true,
      maxAge: 10 * 60 * 1000,
      path: '/',
    };

    if (provider === 'google') {
      if (!env.oauth.isGoogleConfigured) {
        res.status(503).json({
          error: 'Google OAuth not configured',
          code: 'OAUTH_UNCONFIGURED',
          message: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.',
          callbackUrl: redirectUri,
        });
        return;
      }
      res.cookie(OAUTH_STATE_COOKIE, `${state}.${signOAuthState(state, provider)}`, stateCookieOptions);
      const params = new URLSearchParams({
        client_id: env.oauth.googleClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      });
      res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
      return;
    }

    if (provider === 'facebook') {
      if (!env.oauth.isFacebookConfigured) {
        res.status(503).json({
          error: 'Facebook OAuth not configured',
          code: 'OAUTH_UNCONFIGURED',
          message: 'Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to enable Facebook sign-in.',
          callbackUrl: redirectUri,
        });
        return;
      }
      res.cookie(OAUTH_STATE_COOKIE, `${state}.${signOAuthState(state, provider)}`, stateCookieOptions);
      const params = new URLSearchParams({
        client_id: env.oauth.facebookAppId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email,public_profile',
        state,
      });
      res.json({ url: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}` });
      return;
    }

    res.status(400).json({ error: 'Unsupported OAuth provider' });
  })
);

router.get(
  ['/oauth/:provider/callback', '/oauth/:provider/callback/'],
  requireDatabase,
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
    const cookieRaw = typeof req.cookies?.[OAUTH_STATE_COOKIE] === 'string' ? req.cookies[OAUTH_STATE_COOKIE] : '';
    const [cookieState, cookieSig] = cookieRaw.split('.');
    res.clearCookie(OAUTH_STATE_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    });

    const expectedSig = cookieState ? signOAuthState(cookieState, provider) : '';
    const sigMatches =
      Boolean(cookieSig && expectedSig) &&
      cookieSig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(cookieSig), Buffer.from(expectedSig));
    const stateValid =
      Boolean(stateParam && cookieState && sigMatches) &&
      stateParam.length === cookieState.length &&
      crypto.timingSafeEqual(Buffer.from(stateParam), Buffer.from(cookieState));

    if (!stateValid) {
      res.status(403).send('<p>Invalid or expired OAuth state. Please retry sign-in.</p>');
      return;
    }

    const redirectUri = `${env.appUrl}/api/auth/oauth/${provider}/callback`;

    if (!code) {
      res.status(400).send('<p>Authorization code missing.</p>');
      return;
    }

    let profile: { id: string; email: string; name: string; avatarUrl?: string } | null = null;

    if (provider === 'google' && env.oauth.isGoogleConfigured) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.oauth.googleClientId,
          client_secret: env.oauth.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      if (tokenData.access_token) {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const info = (await userInfoRes.json()) as {
          id?: string;
          email?: string;
          verified_email?: boolean;
          name?: string;
          picture?: string;
        };
        if (info.id && info.email && info.verified_email !== false) {
          profile = {
            id: info.id,
            email: info.email.toLowerCase(),
            name: info.name || info.email.split('@')[0],
            avatarUrl: info.picture,
          };
        }
      }
    } else if (provider === 'facebook' && env.oauth.isFacebookConfigured) {
      const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', env.oauth.facebookAppId);
      tokenUrl.searchParams.set('redirect_uri', redirectUri);
      tokenUrl.searchParams.set('client_secret', env.oauth.facebookAppSecret);
      tokenUrl.searchParams.set('code', code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      if (tokenData.access_token) {
        const infoUrl = new URL('https://graph.facebook.com/me');
        infoUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
        infoUrl.searchParams.set('access_token', tokenData.access_token);
        const infoRes = await fetch(infoUrl.toString());
        const info = (await infoRes.json()) as {
          id?: string;
          name?: string;
          email?: string;
          picture?: { data?: { url?: string } };
        };
        if (info.id && info.email) {
          profile = {
            id: info.id,
            email: info.email.toLowerCase(),
            name: info.name || 'Facebook User',
            avatarUrl: info.picture?.data?.url,
          };
        }
      }
    }

    if (!profile) {
      res.status(400).send('<p>Unable to verify OAuth profile with provider.</p>');
      return;
    }

    let user = await UserModel.findOne({ email: profile.email });
    if (!user) {
      user = await UserModel.create({
        name: profile.name,
        email: profile.email,
        role: 'customer',
        emailVerified: true,
        authProvider: provider === 'google' ? 'google' : 'facebook',
        providerId: profile.id,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      });
    } else {
      if (!user.isActive) {
        res.status(403).send('<p>This account has been suspended. Please contact support.</p>');
        return;
      }
      user.lastLoginAt = new Date();
      if (!user.avatarUrl && profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
      await user.save();
    }

    const settings = await StoreSettingsModel.findOne({ key: 'primary' })
      .select('securitySettings')
      .lean();
    const ttl = computeSessionTtl(settings?.securitySettings?.sessionTimeoutMinutes);
    const token = signAuthToken(String(user._id), user.role, user.tokenVersion ?? 0, ttl.expiresInSeconds);
    setAuthCookie(res, token, ttl.maxAgeMs);
    const targetOrigin = new URL(env.appUrl).origin;

    res.send(`
      <!doctype html>
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'NOVARA_OAUTH_SUCCESS', token: ${JSON.stringify(token)} }, ${JSON.stringify(targetOrigin)});
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window will close automatically.</p>
        </body>
      </html>
    `);
  })
);

export default router;
