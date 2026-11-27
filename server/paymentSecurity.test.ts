import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import {
  assertProductionStartupConfig,
  resolvePaymentEnvironment,
  validateStartupSecurityConfig,
} from '../server/src/config/env.ts';
import { signAuthToken } from '../server/src/middleware/auth.middleware.ts';
import { errorHandler } from '../server/src/middleware/error.middleware.ts';
import { StoreSettingsModel } from '../server/src/modules/cms/cms.model.ts';
import cmsRoutes from '../server/src/modules/cms/cms.routes.ts';
import paymentsRoutes, { isAuthorizedSslCommerzIpn } from '../server/src/modules/payments/payments.routes.ts';
import { AuditLogModel } from '../server/src/modules/support/support.model.ts';
import { RoleDefinitionModel, UserModel } from '../server/src/modules/users/user.model.ts';
import {
  getPaymentGatewayStatus,
  verifySslCommerzIpnSignature,
} from '../server/src/services/payment.service.ts';

function buildSignedSslCommerzPayload(
  fields: Record<string, string>,
  storePassword: string
): Record<string, unknown> {
  const verifyKeys = Object.keys(fields);
  const storePasswdMd5 = crypto.createHash('md5').update(storePassword).digest('hex');
  const map: Record<string, string> = {
    store_passwd: storePasswdMd5,
    ...fields,
  };
  const sortedQuery = Object.keys(map)
    .sort()
    .map((k) => `${k}=${map[k]}`)
    .join('&');
  const verifySign = crypto.createHash('md5').update(sortedQuery).digest('hex');
  return {
    ...fields,
    verify_key: verifyKeys.join(','),
    verify_sign: verifySign,
  };
}

const MARKETING_ID = '507f1f77bcf86cd799439021';
const CUSTOMER_ID = '507f1f77bcf86cd799439022';

let server: ReturnType<express.Express['listen']>;
let baseUrl = '';
const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const originals = {
  userFindById: UserModel.findById,
  roleFindOne: RoleDefinitionModel.findOne,
  settingsFindOne: StoreSettingsModel.findOne,
  auditCreate: AuditLogModel.create,
};

before(async () => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });

  (UserModel as unknown as Record<string, unknown>).findById = async (id: string) => {
    if (String(id) === MARKETING_ID) {
      return {
        _id: MARKETING_ID,
        name: 'Marketing User',
        email: 'marketing@novara.test',
        role: 'marketing_manager',
        isActive: true,
        tokenVersion: 1,
      };
    }
    if (String(id) === CUSTOMER_ID) {
      return {
        _id: CUSTOMER_ID,
        name: 'Customer User',
        email: 'customer@novara.test',
        role: 'customer',
        isActive: true,
        tokenVersion: 1,
      };
    }
    return null;
  };

  (RoleDefinitionModel as unknown as Record<string, unknown>).findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });

  (StoreSettingsModel as unknown as Record<string, unknown>).findOne = () => ({
    select: () => ({
      lean: async () => ({
        paymentMethods: [{ key: 'cod', name: 'Cash on Delivery', enabled: true }],
      }),
    }),
  });

  (AuditLogModel as unknown as Record<string, unknown>).create = async () => ({});

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/cms', cmsRoutes);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  UserModel.findById = originals.userFindById;
  RoleDefinitionModel.findOne = originals.roleFindOne;
  StoreSettingsModel.findOne = originals.settingsFindOne;
  AuditLogModel.create = originals.auditCreate;

  if (originalReadyStateDescriptor) {
    Object.defineProperty(mongoose.connection, 'readyState', originalReadyStateDescriptor);
  } else {
    delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('resolvePaymentEnvironment prefers mode-specific SSLCommerz credentials and clamps TTL', () => {
  const sandboxEnv = resolvePaymentEnvironment({
    PAYMENT_SANDBOX: 'true',
    SSLCOMMERZ_SANDBOX_STORE_ID: 'sbx_store_01',
    SSLCOMMERZ_SANDBOX_STORE_PASSWORD: 'sbx_pass_01',
    SSLCOMMERZ_LIVE_STORE_ID: 'live_store_01',
    SSLCOMMERZ_LIVE_STORE_PASSWORD: 'live_pass_01',
    PAYMENT_RESERVATION_TTL_MINUTES: '999',
  });
  assert.equal(sandboxEnv.sandbox, true);
  assert.equal(sandboxEnv.storeId, 'sbx_store_01');
  assert.equal(sandboxEnv.storePassword, 'sbx_pass_01');
  assert.equal(sandboxEnv.reservationTtlMinutes, 240);
  assert.equal(sandboxEnv.isGatewayConfigured, true);

  const liveEnv = resolvePaymentEnvironment({
    SSLCOMMERZ_IS_LIVE: 'true',
    SSLCOMMERZ_SANDBOX_STORE_ID: 'sbx_store_01',
    SSLCOMMERZ_SANDBOX_STORE_PASSWORD: 'sbx_pass_01',
    SSLCOMMERZ_LIVE_STORE_ID: 'live_store_01',
    SSLCOMMERZ_LIVE_STORE_PASSWORD: 'live_pass_01',
    PAYMENT_RESERVATION_TTL_MINUTES: '2',
  });
  assert.equal(liveEnv.sandbox, false);
  assert.equal(liveEnv.isLiveExplicit, true);
  assert.equal(liveEnv.storeId, 'live_store_01');
  assert.equal(liveEnv.storePassword, 'live_pass_01');
  assert.equal(liveEnv.reservationTtlMinutes, 5);
});

test('validateStartupSecurityConfig & assertProductionStartupConfig enforce fail-closed startup guards', () => {
  const shortJwtErrors = validateStartupSecurityConfig({
    isProd: true,
    hasConfiguredJwtSecret: true,
    jwtSecret: 'short-secret',
    payment: resolvePaymentEnvironment({}),
  });
  assert.ok(shortJwtErrors.some((msg) => msg.includes('at least 32 characters')));

  const placeholderJwtErrors = validateStartupSecurityConfig({
    isProd: true,
    hasConfiguredJwtSecret: true,
    jwtSecret: 'secret',
    payment: resolvePaymentEnvironment({}),
  });
  assert.ok(placeholderJwtErrors.length > 0);

  const conflictErrors = validateStartupSecurityConfig({
    isProd: false,
    hasConfiguredJwtSecret: true,
    jwtSecret: 'a'.repeat(40),
    payment: resolvePaymentEnvironment({
      SSLCOMMERZ_IS_LIVE: 'true',
      PAYMENT_SANDBOX: 'true',
    }),
  });
  assert.ok(conflictErrors.some((msg) => msg.includes('Conflicting SSLCommerz mode')));

  const missingLiveCredsErrors = validateStartupSecurityConfig({
    isProd: true,
    hasConfiguredJwtSecret: true,
    jwtSecret: 'a'.repeat(40),
    payment: resolvePaymentEnvironment({
      SSLCOMMERZ_IS_LIVE: 'true',
    }),
  });
  assert.ok(missingLiveCredsErrors.some((msg) => msg.includes('SSLCOMMERZ_LIVE_STORE_ID')));

  assert.throws(() =>
    assertProductionStartupConfig({
      isProd: true,
      hasConfiguredJwtSecret: true,
      jwtSecret: 'a'.repeat(40),
      payment: resolvePaymentEnvironment({
        SSLCOMMERZ_IS_LIVE: 'true',
        SSLCOMMERZ_SANDBOX_STORE_ID: 'same_store',
        SSLCOMMERZ_LIVE_STORE_ID: 'same_store',
        SSLCOMMERZ_LIVE_STORE_PASSWORD: 'live_password',
      }),
    })
  );

  // Valid production setup should pass cleanly
  assert.doesNotThrow(() =>
    assertProductionStartupConfig({
      isProd: true,
      hasConfiguredJwtSecret: true,
      jwtSecret: 'x'.repeat(48),
      payment: resolvePaymentEnvironment({
        SSLCOMMERZ_IS_LIVE: 'true',
        SSLCOMMERZ_SANDBOX_STORE_ID: 'sbx_id',
        SSLCOMMERZ_LIVE_STORE_ID: 'live_id',
        SSLCOMMERZ_LIVE_STORE_PASSWORD: 'live_password',
      }),
    })
  );
});

test('verifySslCommerzIpnSignature validates MD5 verify_sign and rejects tampered payloads', () => {
  const storePassword = 'novara_store_secret_123';
  const signed = buildSignedSslCommerzPayload(
    {
      tran_id: 'NVX-ORD-1001-AAA111',
      val_id: 'VAL-999',
      amount: '1500.00',
      currency: 'BDT',
      status: 'VALID',
    },
    storePassword
  );

  assert.equal(verifySslCommerzIpnSignature(signed, storePassword), true);
  assert.equal(verifySslCommerzIpnSignature({ ...signed, amount: '1.00' }, storePassword), false);
  assert.equal(verifySslCommerzIpnSignature(signed, 'wrong_password'), false);
  assert.equal(verifySslCommerzIpnSignature({ tran_id: 'x' }, storePassword), false);
});

test('isAuthorizedSslCommerzIpn accepts timing-safe webhook secret or valid signed store payload and rejects forgeries', () => {
  const config = {
    webhookSecret: 'whsec_test_secret_98765',
    isGatewayConfigured: true,
    storeId: 'novara_live_store',
    storePassword: 'novara_live_password',
  };

  const validSignedBody = {
    store_id: 'novara_live_store',
    ...buildSignedSslCommerzPayload(
      {
        tran_id: 'NVX-ORD-2001-BBB222',
        val_id: 'VAL-111',
        amount: '2400.00',
        status: 'VALID',
      },
      'novara_live_password'
    ),
  };

  assert.equal(isAuthorizedSslCommerzIpn(validSignedBody, {}, config), true);
  assert.equal(
    isAuthorizedSslCommerzIpn(
      { status: 'VALID', tran_id: 'NVX-ORD-2001-BBB222' },
      { 'x-webhook-secret': 'whsec_test_secret_98765' },
      config
    ),
    true
  );

  // Forged payload without secret and invalid signature must fail
  assert.equal(
    isAuthorizedSslCommerzIpn(
      { ...validSignedBody, store_id: 'wrong_store' },
      {},
      config
    ),
    false
  );
  assert.equal(
    isAuthorizedSslCommerzIpn(
      { status: 'VALID', tran_id: 'NVX-FORGED' },
      { 'x-webhook-secret': 'whsec_wrong' },
      config
    ),
    false
  );
  assert.equal(
    isAuthorizedSslCommerzIpn(
      { status: 'VALID', tran_id: 'NVX-UNCONFIGURED' },
      {},
      { webhookSecret: '', isGatewayConfigured: false, storeId: '', storePassword: '' }
    ),
    false
  );
});

test('getPaymentGatewayStatus and GET /api/payments/status expose normalized mode and COD settings', async () => {
  const statusSnapshot = getPaymentGatewayStatus(false);
  assert.equal(statusSnapshot.codAvailable, false);
  assert.equal(statusSnapshot.codEnabled, false);
  assert.ok(['sandbox', 'live'].includes(statusSnapshot.mode));
  assert.equal(typeof statusSnapshot.reservationTtlMinutes, 'number');

  const res = await fetch(`${baseUrl}/api/payments/status`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    provider: string;
    mode: string;
    codEnabled: boolean;
    supportedMethods: string[];
  };
  assert.equal(body.codEnabled, true);
  assert.ok(body.supportedMethods.includes('Cash on Delivery (COD)'));
});

test('POST /api/payments/sslcommerz/ipn rejects forged unsigned VALID payloads with 403 IPN_VERIFICATION_FAILED', async () => {
  const res = await fetch(`${baseUrl}/api/payments/sslcommerz/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tran_id: 'NVX-ORD-FAKE-0001',
      val_id: 'FAKE_VAL',
      status: 'VALID',
      amount: '5000',
    }),
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as { code?: string };
  assert.equal(body.code, 'IPN_VERIFICATION_FAILED');
});

test('POST /api/cms/admin/upload permits marketing_manager (ads:write) and denies customer with 403', async () => {
  const marketingToken = signAuthToken(MARKETING_ID, 'marketing_manager', 1, 3600);
  const customerToken = signAuthToken(CUSTOMER_ID, 'customer', 1, 3600);

  const deniedRes = await fetch(`${baseUrl}/api/cms/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(deniedRes.status, 403);
  const deniedBody = (await deniedRes.json()) as { code?: string };
  assert.equal(deniedBody.code, 'PERMISSION_DENIED');

  // Marketing manager passes permission gate (400 because no multipart file uploaded, not 403)
  const permittedRes = await fetch(`${baseUrl}/api/cms/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${marketingToken}` },
  });
  assert.equal(permittedRes.status, 400);
});
