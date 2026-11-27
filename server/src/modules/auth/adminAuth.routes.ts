import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { isStaffRole } from '../../../../shared/rbac.ts';
import { computeSessionTtl } from '../../../../shared/security.ts';
import { env } from '../../config/env.ts';
import { getDatabaseStatus, requireDatabase } from '../../database/connection.ts';
import {
  clearAuthCookie,
  extractAuthToken,
  isCsrfSafeRequest,
  requireAuth,
  requireStaff,
  setAuthCookie,
  signAuthToken,
  type AuthJwtPayload,
  type AuthenticatedRequest,
} from '../../middleware/auth.middleware.ts';
import { asyncHandler } from '../../middleware/error.middleware.ts';
import { recordAuditLog } from '../../services/audit.service.ts';
import { getEffectivePermissionsForRole } from '../../services/rbac.service.ts';
import { StoreSettingsModel } from '../cms/cms.model.ts';
import { UserModel } from '../users/user.model.ts';
import { getUserAccountStats, sanitizeUser } from './auth.routes.ts';

const adminLoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(150),
  password: z.string().min(1, 'Password is required.').max(200),
});

export function createAdminAuthRouter(options?: { skipRateLimit?: boolean }) {
  const router = Router();

  const adminAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => Boolean(options?.skipRateLimit),
    message: {
      error: 'Too many administrator login attempts',
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    },
  });

  router.post(
    '/login',
    adminAuthLimiter,
    requireDatabase,
    asyncHandler(async (req, res) => {
      const parsed = adminLoginSchema.parse(req.body);
      const email = parsed.email.toLowerCase();

      const [user, settings] = await Promise.all([
        UserModel.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockoutUntil'),
        StoreSettingsModel.findOne({ key: 'primary' }).select('securitySettings').lean(),
      ]);

      // Reject missing users, OAuth-only users without passwordHash, and non-staff accounts
      // with an identical generic 401 so account existence and roles cannot be enumerated.
      if (!user || !user.passwordHash || !isStaffRole(user.role)) {
        res.status(401).json({
          error: 'Invalid credentials',
          message: 'Invalid administrator email or password.',
        });
        return;
      }

      if (!user.isActive) {
        await recordAuditLog({
          actorId: user._id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'ADMIN_LOGIN_BLOCKED_INACTIVE',
          resourceType: 'User',
          resourceId: String(user._id),
          ipAddress: req.ip,
        });
        res.status(403).json({
          error: 'Account disabled',
          message: 'This administrator account has been disabled.',
        });
        return;
      }

      if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
        const minutesLeft = Math.max(1, Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000));
        res.status(423).json({
          error: 'Account temporarily locked',
          code: 'ACCOUNT_LOCKED',
          message: `Too many failed administrator login attempts. Please try again in ${minutesLeft} minute(s).`,
        });
        return;
      }

      const sec = settings?.securitySettings;
      const maxAttempts = Math.min(50, Math.max(3, Number(sec?.maxLoginAttempts ?? 8)));
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

        await recordAuditLog({
          actorId: user._id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'ADMIN_LOGIN_FAILED',
          resourceType: 'User',
          resourceId: String(user._id),
          details: { locked: Boolean(user.lockoutUntil) },
          ipAddress: req.ip,
        });

        res.status(401).json({
          error: 'Invalid credentials',
          message: 'Invalid administrator email or password.',
        });
        return;
      }

      // Rotate tokenVersion on every admin sign-in to invalidate stale sessions
      const nextTokenVersion = (user.tokenVersion ?? 0) + 1;
      user.tokenVersion = nextTokenVersion;
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
      user.lastLoginAt = new Date();
      await user.save();

      const [stats, permissions] = await Promise.all([
        getUserAccountStats(user._id),
        getEffectivePermissionsForRole(user.role),
      ]);
      const ttl = computeSessionTtl(sec?.sessionTimeoutMinutes);
      const token = signAuthToken(String(user._id), user.role, nextTokenVersion, ttl.expiresInSeconds);
      setAuthCookie(res, token, ttl.maxAgeMs);

      await recordAuditLog({
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'ADMIN_LOGIN',
        resourceType: 'User',
        resourceId: String(user._id),
        ipAddress: req.ip,
      });

      res.json({
        token,
        user: sanitizeUser(user, stats, permissions),
      });
    })
  );

  router.get(
    '/me',
    requireDatabase,
    requireAuth,
    requireStaff,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const stats = await getUserAccountStats(req.user!._id);
      res.json({
        user: sanitizeUser(req.user!, stats, req.effectivePermissions),
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
            const user = await UserModel.findByIdAndUpdate(
              decoded.sub,
              { $inc: { tokenVersion: 1 } },
              { new: true }
            );
            if (user && isStaffRole(user.role)) {
              await recordAuditLog({
                actorId: user._id,
                actorEmail: user.email,
                actorRole: user.role,
                action: 'ADMIN_LOGOUT',
                resourceType: 'User',
                resourceId: String(user._id),
                ipAddress: req.ip,
              });
            }
          }
        } catch {
          // Expired or invalid tokens still clear client auth cookie cleanly
        }
      }
      clearAuthCookie(res);
      res.json({ ok: true });
    })
  );

  return router;
}

export default createAdminAuthRouter();
