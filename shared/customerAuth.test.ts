import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBangladeshPhoneVariants,
  isValidBangladeshPhone,
  toCanonicalBangladeshPhone,
} from './bangladeshLocations.ts';
import { selectLatestApprovedReviews } from './homepageHelpers.ts';
import {
  getUserInitials,
  validateCustomerRegistrationInput,
  validateFullName,
} from './security.ts';

test('getUserInitials produces accurate two-letter and single-word initials', () => {
  assert.equal(getUserInitials('Mahim Hasan'), 'MH');
  assert.equal(getUserInitials('  mahim   ul  hasan  '), 'MU');
  assert.equal(getUserInitials('Novara'), 'N');
  assert.equal(getUserInitials(''), 'NC');
  assert.equal(getUserInitials(null), 'NC');
});

test('validateFullName preserves exact full name while collapsing outer/extra whitespace', () => {
  const valid = validateFullName('  Md. Mahim Bin Hasan  ');
  assert.equal(valid.valid, true);
  assert.equal(valid.normalized, 'Md. Mahim Bin Hasan');

  assert.equal(validateFullName('A').valid, false);
  assert.equal(validateFullName('<script>alert(1)</script>').valid, false);
});

test('Bangladesh phone canonicalization unifies local and international variants', () => {
  assert.equal(toCanonicalBangladeshPhone('01712345678'), '+8801712345678');
  assert.equal(toCanonicalBangladeshPhone('+880 1712-345678'), '+8801712345678');
  assert.equal(toCanonicalBangladeshPhone('8801712345678'), '+8801712345678');
  assert.equal(toCanonicalBangladeshPhone('1712345678'), '+8801712345678');

  const variants = getBangladeshPhoneVariants('01712345678');
  assert.deepEqual(variants, ['+8801712345678', '01712345678', '8801712345678']);
});

test('validateCustomerRegistrationInput enforces full name, phone, confirm password, and terms acceptance', () => {
  const invalid = validateCustomerRegistrationInput(
    {
      name: 'M',
      email: 'bad-email',
      phone: '12345',
      password: 'short',
      confirmPassword: 'different',
      termsAccepted: false,
    },
    isValidBangladeshPhone
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.password);
  assert.ok(invalid.errors.confirmPassword);
  assert.ok(invalid.errors.termsAccepted);

  const valid = validateCustomerRegistrationInput(
    {
      name: 'Mahim Hasan',
      email: 'mahim@example.com',
      phone: '+880 1712-345678',
      password: 'StrongPassword1!',
      confirmPassword: 'StrongPassword1!',
      termsAccepted: true,
    },
    isValidBangladeshPhone
  );
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('selectLatestApprovedReviews prioritizes live user name and avatar over stale review copy', () => {
  const result = selectLatestApprovedReviews(
    [
      {
        _id: 'rev-1',
        status: 'approved',
        userName: 'Old Customer Name',
        rating: 5,
        comment: 'Excellent product quality and fast delivery in Dhaka.',
        verifiedPurchase: true,
        userId: {
          _id: 'user-1',
          name: 'Updated Customer Name',
          avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/avatar.jpg',
        },
        productId: {
          _id: 'prod-1',
          name: 'Sony WH-1000XM5',
          slug: 'sony-wh-1000xm5',
        },
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ],
    4
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].userName, 'Updated Customer Name');
  assert.equal(result[0].userAvatar, 'https://res.cloudinary.com/demo/image/upload/v1/avatar.jpg');
});
