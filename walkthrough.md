# Security Summary

This audit reviewed the full NOVARA COMMERCE codebase (frontend storefront, admin dashboard, Express API modules, authentication/OAuth flows, inventory reservation, payment webhooks, CMS settings, and CSV import/export) to verify end-to-end production readiness and close security and transactional integrity defects without changing the visual design or removing features.

## Key Security & Integrity Fixes Implemented

1. **OAuth Login Request Binding, Active-Account Enforcement & Target Origin Restriction** (`server/src/modules/auth/auth.routes.ts`, `src/components/auth/AuthModal.tsx`)
   - Bound the generated `state` value in `/api/auth/oauth/:provider/url` to a signed `HttpOnly`, `Secure`, `SameSite=None` cookie (`novara_oauth_state`) and verified it using constant-time comparison in `/api/auth/oauth/:provider/callback`.
   - Enforced `user.isActive` and Google `verified_email !== false` during OAuth login so disabled accounts cannot re-authenticate via social login.
   - Restricted `window.opener.postMessage` on the server to `new URL(env.appUrl).origin` and restricted the client listener strictly to `event.origin === window.location.origin`.

2. **Authenticated SSLCommerz IPN Verification & Double-Release Prevention** (`server/src/services/payment.service.ts`, `server/src/modules/payments/payments.routes.ts`, `server/src/modules/orders/orders.routes.ts`)
   - Added `verifySslCommerzIpnSignature` (MD5 canonical signature check over `verify_key` + `store_passwd` hash) and required valid gateway signature (matching `store_id` and `verify_sign`) or `x-webhook-secret` before processing `FAILED` / `CANCELLED` IPNs, preventing anonymous callers from cancelling pending orders or releasing stock.
   - Added `shouldReleaseInventoryOnCancel(order.orderStatus)` to prevent cancelling a `payment_failed` order from releasing reserved stock a second time.
   - Updated `/api/payments/admin/refunds` so partial refunds transition the order to `refund_pending` until cumulative refunds reach `order.totalAmount`, allowing subsequent partial refunds to succeed.

3. **Atomic Variant Stock Locking & Negative Stock Guards** (`server/src/modules/inventory/inventory.routes.ts`)
   - Replaced the non-standard `$expr` inside `$elemMatch` and unsafe fallback query with a single `$elemMatch` predicate matching `_id`, `isActive: true`, `stockOnHand`, and `reservedStock` on the same variant array element.
   - Added lower-bound `$gte: item.quantity` checks to `releaseReservedInventory` and `fulfillReservedInventory` so stock and reserved counters cannot go negative.

4. **Draft/Inactive Catalog Access Control** (`server/src/modules/catalog/catalog.routes.ts`)
   - Protected `?includeAll=true`, `?all=true` on categories/brands, and draft product access by slug behind `optionalAuth` + `hasPermission(req.user?.role, 'catalog:read')`, and filtered collection population strictly to `status: 'published'`.

5. **Input Validation, Output Escaping & Origin Hardening** (`shared/security.ts`, `server.ts`, `server/src/middleware/auth.middleware.ts`, `server/src/modules/cms/cms.routes.ts`, `server/src/modules/users/users.routes.ts`, `server/src/modules/support/support.routes.ts`)
   - Escaped dynamic user/product values interpolated into HTML emails (`escapeHtml`), `/sitemap.xml` (`escapeXml`), and Mongo `$regex` search queries (`escapeRegex`).
   - Enforced safe HTTP/HTTPS/relative URL checks (`isSafeDestinationUrl` / `sanitizeHref`) on CMS hero links, dual banner links, and social links both in API validation and frontend components.
   - Neutralized spreadsheet formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) in CSV exports and added quoted-comma parsing plus initial `InventoryMovementModel` ledger entries on bulk CSV import.
   - Tightened CORS origin matching against regex patterns for localhost and AI Studio preview hosts, wrapped CSRF `Origin` parsing safely to return `403 CSRF_BLOCKED`, rate-limited `/api/orders/track` with digit-normalized phone matching, prevented deactivating/demoting the last active Super Admin, and deduplicated review abuse reports per user.

6. **Session Token Revocation, Coupon/CMS Hardening & Active-Variant Parity** (`server/src/modules/users/user.model.ts`, `server/src/middleware/auth.middleware.ts`, `server/src/modules/auth/auth.routes.ts`, `server/src/modules/users/users.routes.ts`, `server/src/modules/cms/cms.routes.ts`, `server/src/modules/catalog/catalog.routes.ts`, `server/src/modules/cart/cart.routes.ts`, `server/src/modules/marketing/marketing.routes.ts`, `src/components/account/CustomerCouponsView.tsx`, `src/pages/AccountPage.tsx`)
   - Added persistent `tokenVersion` (`tv` JWT claim) checked on every authenticated request; signing out (with valid CSRF/Origin check), changing passwords, confirming password resets, or deactivating/changing staff roles immediately invalidates prior issued tokens. Changing password rotates and returns a fresh session token so the active session continues uninterrupted.
   - Added explicit `ObjectId` parameter validation and chronological `startsAt <= endsAt` schedule checks across Wishlist Hero Slides, Promotional Placements, and Coupons, plus a one-time `wishlistDefaultsSeeded` flag so deleted default slides/promos do not silently re-seed.
   - Filtered `/api/marketing/my-coupons` against both global `usageLimit` and per-customer `perCustomerLimit`, and fixed `CustomerCouponsView` to read `discountAmount` from coupon redemption records so redemption savings render accurately instead of `৳NaN`.
   - Aligned `catalog.routes.ts`, `cart.routes.ts`, `ProductCard.tsx`, and `ProductDetailPage.tsx` on active-variant stock calculation (`calculateAvailableProductStock` / `v.isActive !== false`), expanded `POST /api/catalog/products/by-ids` to match the 100-item wishlist cap, cleared user-scoped client state on sign-out, and added explicit error/retry states in Customer Dashboard, Orders, Reviews, and Coupons views.

7. **Database-Backed RBAC Overrides & Dynamic Security Policy Enforcement** (`shared/rbac.ts`, `shared/security.ts`, `server/src/services/rbac.service.ts`, `server/src/middleware/auth.middleware.ts`, `server/src/modules/users/user.model.ts`, `server/src/modules/auth/auth.routes.ts`, `server/src/modules/users/users.routes.ts`, `server/src/modules/orders/orders.routes.ts`)
   - Connected persisted `RoleDefinition` overrides into every authorization boundary (`requirePermission` and `userHasEffectivePermission` across catalog, inventory, orders, payments, marketing, reviews, support, CMS, and users) and returned `effectivePermissions` from `/api/auth/me` so sidebar visibility and backend checks stay aligned.
   - Enforced `StoreSettings.securitySettings` dynamically on authentication flows: `passwordMinLength`, `requireStrongPasswords`, `sessionTimeoutMinutes` JWT TTL, `maxLoginAttempts` + timed lockout (`lockoutUntil` persisted on `User`), and `requireEmailVerification` checkout enforcement.
   - Protected `/api/users/admin/roles/:roleKey` against privilege escalation (`super_admin` permissions remain locked and custom role assignments validate permission identifiers strictly).

8. **Server-Authoritative Pricing, Discount Rules, Customer Groups, Tax & Payment Channel Gating** (`shared/pricing.ts`, `server/src/modules/cart/cart.service.ts`, `server/src/modules/orders/orders.routes.ts`, `server/src/modules/cms/cms.routes.ts`, `server/src/services/email.service.ts`)
   - Enforced active `DiscountRule` rules (sitewide, category, product, and customer group targeting with priority ordering, stackability, and max cap) plus `CustomerGroup.discountPercent` VIP tiers and `Coupon.eligibleCustomerGroupIds` server-side across cart totals and order creation.
   - Replaced hardcoded 0% tax with `StoreSettings.taxSettings` computation (`computeTaxBreakdown`) and enforced `StoreSettings.paymentMethods` (`codEnabled`, `sslCommerzEnabled`, `bkashEnabled`, `nagadEnabled`, `cardEnabled`) via `validateCheckoutPaymentChannel` on order creation.
   - Wired `StoreSettings.emailSettings` and `notificationSettings` into transactional email dispatch and order notification triggers.

9. **Input ObjectId Validation, Safe Delete Guards, Inventory Ledger Parity & Media Cleanup** (`server/src/modules/catalog/catalog.routes.ts`, `server/src/modules/inventory/inventory.routes.ts`, `server/src/modules/payments/payments.routes.ts`, `server/src/modules/reviews/reviews.routes.ts`, `server/src/modules/support/support.routes.ts`, `server/src/services/cloudinary.service.ts`)
   - Added explicit `mongoose.Types.ObjectId.isValid` guards returning clean `400` errors on catalog, inventory adjustment, payment refund, review, and support enquiry routes instead of unhandled Mongoose cast errors.
   - Enforced reservation-floor integrity (`stockOnHand >= reservedStock`), preserved `reservedStock` during product/variant updates, and logged `InventoryMovementModel` adjustment/initial ledger records on product edits.
   - Added reference-checked `DELETE` endpoints for products, categories, and brands (`409 Conflict` when dependent subcategories, products, or historical orders exist) and expanded `destroyCloudinaryAssetIfUnused` across advertisements, campaigns, promo popups, blog posts, store logo, and mobile hero/checkout banners.

---

## PoC Verification

Because `MONGODB_URI` and third-party gateway/OAuth credentials (`PAYMENT_STORE_*`, `GOOGLE_CLIENT_*`, `FACEBOOK_APP_*`, `RESEND_API_KEY`, `CLOUDINARY_*`) are not configured in this sandbox environment, database-backed and external-provider verification used unit tests, dependency vulnerability scanning, and static type/build checks alongside live HTTP and headless browser verification against port 3000:

1. **Automated Unit Tests (`npm test` across 5 test suites)** — 46 / 46 passing:
   - Verified dynamic RBAC permission resolution (`resolveRolePermissions`, `hasEffectivePermission`), password complexity (`validatePasswordAgainstPolicy`), and dynamic session TTL bounds (`computeSessionTtl`).
   - Verified tax calculations (`calculateTaxAmount`, `computeTaxBreakdown`), automatic discount rules (`calculateAutomaticDiscount`), group-scoped coupon eligibility (`calculateCouponDiscount`), and active payment channel validation (`validateCheckoutPaymentChannel`).
   - Verified `verifySslCommerzIpnSignature` accepts valid MD5-signed SSLCommerz IPN payloads and rejects tampered amounts or missing signatures.
   - Verified `isSafeDestinationUrl` and `sanitizeHref` block `javascript:` and protocol-relative `//` URLs while permitting valid relative and `https://` links.
   - Verified `sanitizeCsvCell` prefixes `=`/`+` formula strings and `parseCsvLine` parses quoted commas accurately.
   - Verified `shouldReleaseInventoryOnCancel` returns `false` for `payment_failed`, `cancelled`, and `refunded` statuses, and verified order state transitions, Bangladesh hierarchy validation, cart calculations, product detail helpers, and wishlist/analytics helpers.

2. **Dependency Audit (`bun audit`)**:
   - Checked 326 locked packages with 0 reported vulnerabilities.

3. **Live HTTP & Browser Checks (`http://localhost:3000`)**:
   - Confirmed Helmet security headers (`Cross-Origin-Opener-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`), CORS rejection of untrusted origins (`https://evil-localhost.com`), JSON `404` on unknown `/api/*` routes, and fail-closed `503 DB_UNAVAILABLE` responses on database-backed endpoints when `MONGODB_URI` is unset.
   - Verified storefront, catalog, unauthenticated `/admin` staff guard (desktop `1440x900` and mobile `390x844`), and authenticated Admin dashboard, RBAC Roles matrix, Products, and Marketing Discount Rules views via headless Chromium with zero uncaught JavaScript runtime exceptions.


