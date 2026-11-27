import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaffRole } from './rbac.ts';
import { validateAdminLoginInput } from './security.ts';
import { resolveAdminBootstrapCredentials } from '../server/src/config/env.ts';

test('resolveAdminBootstrapCredentials prefers ADMIN_EMAIL and ADMIN_PASSWORD and falls back to SUPER_ADMIN_*', () => {
  const primary = resolveAdminBootstrapCredentials({
    ADMIN_EMAIL: ' Admin@Novara.COM ',
    ADMIN_PASSWORD: '  StrongPass!123  ',
    SUPER_ADMIN_EMAIL: 'legacy@novara.com',
    SUPER_ADMIN_PASSWORD: 'LegacyPass!123',
  });
  assert.equal(primary.email, 'admin@novara.com');
  assert.equal(primary.password, 'StrongPass!123');
  assert.equal(primary.isConfigured, true);
  assert.equal(primary.isPartial, false);

  const fallback = resolveAdminBootstrapCredentials({
    SUPER_ADMIN_EMAIL: 'Root@Novara.com',
    SUPER_ADMIN_PASSWORD: 'RootPassword!1',
  });
  assert.equal(fallback.email, 'root@novara.com');
  assert.equal(fallback.password, 'RootPassword!1');
  assert.equal(fallback.isConfigured, true);

  const partial = resolveAdminBootstrapCredentials({
    ADMIN_EMAIL: 'only-email@novara.com',
  });
  assert.equal(partial.isConfigured, false);
  assert.equal(partial.isPartial, true);
});

test('validateAdminLoginInput validates email format and required fields', () => {
  const empty = validateAdminLoginInput({ email: '   ', password: '' });
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.email);
  assert.ok(empty.errors.password);

  const badEmail = validateAdminLoginInput({ email: 'not-an-email', password: 'secret' });
  assert.equal(badEmail.valid, false);
  assert.ok(badEmail.errors.email);
  assert.equal(badEmail.errors.password, undefined);

  const valid = validateAdminLoginInput({ email: ' OPS@Novara.com ', password: 'Password!1' });
  assert.equal(valid.valid, true);
  assert.equal(valid.email, 'ops@novara.com');
  assert.deepEqual(valid.errors, {});
});

test('isStaffRole restricts admin access exclusively to non-customer staff roles', () => {
  assert.equal(isStaffRole('customer'), false);
  assert.equal(isStaffRole('super_admin'), true);
  assert.equal(isStaffRole('admin'), true);
  assert.equal(isStaffRole('order_manager'), true);
  assert.equal(isStaffRole('inventory_manager'), true);
  assert.equal(isStaffRole('catalog_manager'), true);
  assert.equal(isStaffRole('marketing_manager'), true);
  assert.equal(isStaffRole('customer_support'), true);
  assert.equal(isStaffRole('finance_accounts'), true);
  assert.equal(isStaffRole('read_only_analyst'), true);
});
