import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const EPHEMERAL_JWT_SECRET = crypto.randomBytes(32).toString('hex');

const WEAK_PLACEHOLDER_SECRETS = new Set([
  'secret',
  'changeme',
  'change-me',
  'change_me',
  'jwt-secret',
  'your-secret-key',
  'supersecret',
  'novara-secret',
  'test-secret',
  'dev-secret',
]);

export function resolveAdminBootstrapCredentials(
  source: Record<string, string | undefined> = process.env
): { email: string; password: string; isConfigured: boolean; isPartial: boolean } {
  const email = (source.ADMIN_EMAIL || source.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = (source.ADMIN_PASSWORD || source.SUPER_ADMIN_PASSWORD || '').trim();
  const isConfigured = Boolean(email && password);
  const isPartial = Boolean((email && !password) || (!email && password));
  return { email, password, isConfigured, isPartial };
}

export function resolvePaymentEnvironment(source: Record<string, string | undefined> = process.env) {
  const isLiveExplicit = source.SSLCOMMERZ_IS_LIVE === 'true';
  const isSandboxExplicitFalse = source.PAYMENT_SANDBOX === 'false';
  const isSandboxExplicitTrue = source.PAYMENT_SANDBOX === 'true';
  const conflictingModeFlags = isLiveExplicit && isSandboxExplicitTrue;

  const sandbox = isLiveExplicit ? false : !isSandboxExplicitFalse;

  const legacyStoreId = source.PAYMENT_STORE_ID?.trim() || source.SSLCOMMERZ_STORE_ID?.trim() || '';
  const legacyStorePassword =
    source.PAYMENT_STORE_PASSWORD?.trim() || source.SSLCOMMERZ_STORE_PASSWORD?.trim() || '';

  const sandboxStoreId = source.SSLCOMMERZ_SANDBOX_STORE_ID?.trim() || (sandbox ? legacyStoreId : '');
  const sandboxStorePassword =
    source.SSLCOMMERZ_SANDBOX_STORE_PASSWORD?.trim() || (sandbox ? legacyStorePassword : '');

  const liveStoreId = source.SSLCOMMERZ_LIVE_STORE_ID?.trim() || (!sandbox ? legacyStoreId : '');
  const liveStorePassword =
    source.SSLCOMMERZ_LIVE_STORE_PASSWORD?.trim() || (!sandbox ? legacyStorePassword : '');

  const storeId = sandbox ? sandboxStoreId : liveStoreId;
  const storePassword = sandbox ? sandboxStorePassword : liveStorePassword;
  const parsedTtl = Number(source.PAYMENT_RESERVATION_TTL_MINUTES || 30);
  const reservationTtlMinutes = Number.isFinite(parsedTtl)
    ? Math.max(5, Math.min(240, Math.round(parsedTtl)))
    : 30;

  return {
    provider: source.PAYMENT_PROVIDER?.trim() || 'sslcommerz',
    sandbox,
    isLiveExplicit,
    conflictingModeFlags,
    storeId,
    storePassword,
    sandboxStoreId,
    sandboxStorePassword,
    liveStoreId,
    liveStorePassword,
    webhookSecret: source.PAYMENT_WEBHOOK_SECRET?.trim() || '',
    reservationTtlMinutes,
    isGatewayConfigured: Boolean(storeId && storePassword),
  };
}

export interface StartupSecurityValidationInput {
  isProd: boolean;
  hasConfiguredJwtSecret: boolean;
  jwtSecret: string;
  payment: {
    sandbox: boolean;
    isLiveExplicit: boolean;
    conflictingModeFlags: boolean;
    storeId: string;
    storePassword: string;
    sandboxStoreId: string;
    liveStoreId: string;
    isGatewayConfigured: boolean;
  };
}

export function validateStartupSecurityConfig(config: StartupSecurityValidationInput): string[] {
  const errors: string[] = [];

  if (config.payment.conflictingModeFlags) {
    errors.push(
      'Conflicting SSLCommerz mode configuration: SSLCOMMERZ_IS_LIVE=true cannot be combined with PAYMENT_SANDBOX=true.'
    );
  }

  if (config.payment.isLiveExplicit && !config.payment.isGatewayConfigured) {
    errors.push(
      'SSLCOMMERZ_IS_LIVE=true requires live gateway credentials (SSLCOMMERZ_LIVE_STORE_ID and SSLCOMMERZ_LIVE_STORE_PASSWORD).'
    );
  }

  if (
    !config.payment.sandbox &&
    config.payment.sandboxStoreId &&
    config.payment.liveStoreId &&
    config.payment.sandboxStoreId === config.payment.liveStoreId
  ) {
    errors.push(
      'Live payment mode cannot reuse sandbox store credentials (SSLCOMMERZ_LIVE_STORE_ID must differ from SSLCOMMERZ_SANDBOX_STORE_ID).'
    );
  }

  if (config.isProd) {
    const trimmedSecret = config.jwtSecret.trim();
    if (!config.hasConfiguredJwtSecret || trimmedSecret.length < 32) {
      errors.push(
        'Production startup requires a strong JWT_SECRET environment variable (at least 32 characters).'
      );
    } else if (WEAK_PLACEHOLDER_SECRETS.has(trimmedSecret.toLowerCase())) {
      errors.push('Production JWT_SECRET cannot use a weak placeholder value.');
    }
  }

  return errors;
}

export function assertProductionStartupConfig(config: StartupSecurityValidationInput = env): void {
  const errors = validateStartupSecurityConfig(config);
  if (errors.length > 0) {
    throw new Error(`[Startup Security Error] ${errors.join(' ')}`);
  }
}

const resolvedAdmin = resolveAdminBootstrapCredentials(process.env);
if (resolvedAdmin.isPartial) {
  console.warn(
    '[Env Warning] Both ADMIN_EMAIL and ADMIN_PASSWORD (or SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD) must be set together to provision an admin user.'
  );
}

function parseCorsOrigins(
  source: Record<string, string | undefined> = process.env
): string[] {
  const raw = [
    source.APP_URL,
    source.CLIENT_URL,
    source.RENDER_EXTERNAL_URL,
    ...(source.CORS_ORIGINS ? source.CORS_ORIGINS.split(',') : []),
  ];
  const normalized = new Set<string>();
  for (const item of raw) {
    const trimmed = item?.trim().replace(/\/$/, '');
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      normalized.add(trimmed);
    }
  }
  return [...normalized];
}

const isProdEnv = process.env.NODE_ENV === 'production';
const configuredJwtSecret = process.env.JWT_SECRET?.trim() || '';
const paymentEnv = resolvePaymentEnvironment(process.env);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: isProdEnv,
  port: Number(process.env.PORT || 3000),
  appUrl: (
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.CLIENT_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, ''),
  allowedCorsOrigins: parseCorsOrigins(process.env),
  mongodbUri: process.env.MONGODB_URI?.trim() || '',
  jwtSecret: isProdEnv ? configuredJwtSecret : configuredJwtSecret || EPHEMERAL_JWT_SECRET,
  hasConfiguredJwtSecret: Boolean(configuredJwtSecret),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminEmail: resolvedAdmin.email,
  adminPassword: resolvedAdmin.password,
  superAdminEmail: resolvedAdmin.email,
  superAdminPassword: resolvedAdmin.password,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || '',
    get isConfigured() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY?.trim() || '',
    emailFrom:
      process.env.EMAIL_FROM?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim() ||
      'NOVARA COMMERCE <no-reply@novaracommerce.com>',
    get isConfigured() {
      return Boolean(this.apiKey);
    },
  },
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
    facebookAppId: process.env.FACEBOOK_APP_ID?.trim() || '',
    facebookAppSecret: process.env.FACEBOOK_APP_SECRET?.trim() || '',
    get isGoogleConfigured() {
      return Boolean(this.googleClientId && this.googleClientSecret);
    },
    get isFacebookConfigured() {
      return Boolean(this.facebookAppId && this.facebookAppSecret);
    },
  },
  payment: paymentEnv,
  sms: {
    provider: process.env.SMS_PROVIDER?.trim() || '',
    apiUrl: process.env.SMS_API_URL?.trim() || '',
    apiKey: process.env.SMS_API_KEY?.trim() || '',
    senderId: process.env.SMS_SENDER_ID?.trim() || 'NOVARA',
    get isConfigured() {
      return Boolean(this.apiUrl && this.apiKey);
    },
  },
};
