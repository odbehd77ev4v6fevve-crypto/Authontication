import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks.ts';
import { AdminLoginModal } from './components/auth/AdminLoginModal.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { CartDrawer } from './components/layout/CartDrawer.tsx';
import { StorefrontFooter } from './components/layout/StorefrontFooter.tsx';
import { StorefrontHeader } from './components/layout/StorefrontHeader.tsx';
import { AdvertisementBanner } from './components/marketing/AdvertisementBanner.tsx';
import { BannerRenderer } from './components/marketing/BannerRenderer.tsx';
import { PromoPopupManager } from './components/marketing/PromoPopupManager.tsx';
import { ToastContainer } from './components/toast/ToastContainer.tsx';
import { clearAuthSession, fetchCurrentUser } from './features/auth/authSlice.ts';
import { syncServerCart } from './features/cart/cartSlice.ts';
import { apiRequest, ApiError, setUnauthorizedHandler } from './lib/api.ts';
import { AccountPage } from './pages/AccountPage.tsx';
import { AuthActionPage } from './pages/AuthActionPage.tsx';
import { BlogPage } from './pages/BlogPage.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { CustomStaticPage } from './pages/CustomStaticPage.tsx';
import { FaqPage } from './pages/FaqPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { OrderDetailPage } from './pages/OrderDetailPage.tsx';
import { OrderSuccessPage } from './pages/OrderSuccessPage.tsx';
import { PolicyPage } from './pages/PolicyPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import { TrackOrderPage } from './pages/TrackOrderPage.tsx';
import { AdminAttributesPage } from './pages/admin/AdminAttributesPage.tsx';
import { AdminCategoriesBrandsPage } from './pages/admin/AdminCategoriesBrandsPage.tsx';
import { AdminCmsPage } from './pages/admin/AdminCmsPage.tsx';
import { AdminContentPage } from './pages/admin/AdminContentPage.tsx';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage.tsx';
import { AdminFooterManagerPage } from './pages/admin/AdminFooterManagerPage.tsx';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage.tsx';
import { AdminLayout } from './pages/admin/AdminLayout.tsx';
import { AdminMarketingHubPage } from './pages/admin/AdminMarketingHubPage.tsx';
import { AdminMarketingPage } from './pages/admin/AdminMarketingPage.tsx';
import { AdminNavigationManagerPage } from './pages/admin/AdminNavigationManagerPage.tsx';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage.tsx';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.tsx';
import { AdminPaymentMethodsPage } from './pages/admin/AdminPaymentMethodsPage.tsx';
import { AdminPaymentsReportsPage } from './pages/admin/AdminPaymentsReportsPage.tsx';
import { AdminProductsPage } from './pages/admin/AdminProductsPage.tsx';
import { AdminQaPage } from './pages/admin/AdminQaPage.tsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.tsx';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage.tsx';
import { AdminRolesPage } from './pages/admin/AdminRolesPage.tsx';
import { AdminSearchSettingsPage } from './pages/admin/AdminSearchSettingsPage.tsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.tsx';
import { AdminSlideshowManagementPage } from './pages/admin/AdminSlideshowManagementPage.tsx';
import { AdminStaffCustomersPage } from './pages/admin/AdminStaffCustomersPage.tsx';
import { AdminSystemToolsPage } from './pages/admin/AdminSystemToolsPage.tsx';
import { AdminWebsiteSettingsPage } from './pages/admin/AdminWebsiteSettingsPage.tsx';
import type {
  Category,
  HomepageConfig,
  PromotionalPlacement,
  StoreSettings,
} from './types/domain.ts';

export default function App() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);

  const [categories, setCategories] = useState<Category[]>([]);
  const [homepage, setHomepage] = useState<HomepageConfig | null>(null);
  const [activePromotions, setActivePromotions] = useState<PromotionalPlacement[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [dbUnavailable, setDbUnavailable] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      dispatch(clearAuthSession());
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [dispatch]);

  const prevIsAdminRef = useRef(location.pathname.startsWith('/admin'));

  const loadStorefrontShell = useCallback(() => {
    Promise.all([
      apiRequest<{
        homepage: HomepageConfig | null;
        activePromotions: PromotionalPlacement[];
        storeSettings: StoreSettings;
      }>('/api/cms/public/homepage'),
      apiRequest<{ categories: Category[] }>('/api/catalog/categories'),
    ])
      .then(([cmsRes, catRes]) => {
        setHomepage(cmsRes.homepage);
        setActivePromotions(cmsRes.activePromotions || []);
        setStoreSettings(cmsRes.storeSettings || null);
        setCategories(catRes.categories || []);
        setDbUnavailable(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 503) {
          setDbUnavailable(true);
        }
      });
  }, []);

  useEffect(() => {
    void dispatch(fetchCurrentUser());
    loadStorefrontShell();
  }, [dispatch, loadStorefrontShell]);

  useEffect(() => {
    const onCmsUpdated = () => loadStorefrontShell();
    window.addEventListener('novara:cms-updated', onCmsUpdated);
    return () => window.removeEventListener('novara:cms-updated', onCmsUpdated);
  }, [loadStorefrontShell]);

  useEffect(() => {
    if (user) {
      void dispatch(syncServerCart());
    }
  }, [user, dispatch]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const nowAdmin = location.pathname.startsWith('/admin');
    if (prevIsAdminRef.current && !nowAdmin) {
      loadStorefrontShell();
    }
    prevIsAdminRef.current = nowAdmin;
  }, [location.pathname, loadStorefrontShell]);

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <>
      {isAdminRoute ? (
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />

            {/* Catalog & Inventory */}
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="products/new" element={<AdminProductsPage />} />
            <Route path="taxonomy" element={<AdminCategoriesBrandsPage />} />
            <Route path="brands" element={<AdminCategoriesBrandsPage />} />
            <Route path="attributes" element={<AdminAttributesPage />} />
            <Route path="inventory" element={<AdminInventoryPage />} />

            {/* Orders & Fulfilment */}
            <Route path="orders" element={<AdminOrdersPage initialMode="all" />} />
            <Route path="orders/pending" element={<AdminOrdersPage initialMode="pending" />} />
            <Route path="orders/processing" element={<AdminOrdersPage initialMode="processing" />} />
            <Route path="orders/shipped" element={<AdminOrdersPage initialMode="shipped" />} />
            <Route path="orders/delivered" element={<AdminOrdersPage initialMode="delivered" />} />
            <Route path="orders/cancelled" element={<AdminOrdersPage initialMode="cancelled" />} />
            <Route path="orders/cancellations" element={<AdminOrdersPage initialMode="cancellations" />} />
            <Route path="orders/returns" element={<AdminOrdersPage initialMode="returns" />} />
            <Route path="orders/create" element={<AdminOrdersPage initialMode="create" />} />

            {/* Customers, Reviews & Q&A */}
            <Route path="customers" element={<AdminCustomersPage mode="list" />} />
            <Route path="customer-groups" element={<AdminCustomersPage mode="groups" />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="qa" element={<AdminQaPage />} />

            {/* Marketing & Discounts */}
            <Route path="marketing" element={<AdminMarketingPage />} />
            <Route path="marketing/coupons" element={<AdminMarketingPage />} />
            <Route path="marketing/rules" element={<AdminMarketingHubPage initialTab="rules" />} />
            <Route path="marketing/offers" element={<AdminMarketingHubPage initialTab="offers" />} />
            <Route path="marketing/campaigns" element={<AdminMarketingHubPage initialTab="campaigns" />} />
            <Route path="marketing/ads" element={<AdminMarketingHubPage initialTab="ads" />} />
            <Route path="marketing/popups" element={<AdminMarketingHubPage initialTab="popups" />} />

            {/* CMS & Content Manager */}
            <Route path="cms" element={<AdminCmsPage initialTab="wishlist_slides" />} />
            <Route path="cms/hero" element={<AdminCmsPage initialTab="homepage" />} />
            <Route path="cms/homepage" element={<AdminCmsPage initialTab="homepage" />} />
            <Route path="cms/cart-banners" element={<AdminCmsPage initialTab="cart_banner" />} />
            <Route path="cms/checkout-banner" element={<AdminCmsPage initialTab="checkout_banner" />} />
            <Route path="cms/wishlist-slides" element={<AdminCmsPage initialTab="wishlist_slides" />} />
            <Route path="cms/banners" element={<AdminCmsPage initialTab="banners" />} />
            <Route path="cms/banner-creator" element={<AdminCmsPage initialTab="banners" />} />
            <Route
              path="cms/slideshows"
              element={<AdminSlideshowManagementPage initialPlacement="all" />}
            />
            <Route
              path="cms/slideshows/homepage"
              element={<AdminSlideshowManagementPage initialPlacement="homepage" />}
            />
            <Route
              path="cms/slideshows/cart"
              element={<AdminSlideshowManagementPage initialPlacement="cart" />}
            />
            <Route
              path="cms/slideshows/wishlist"
              element={<AdminSlideshowManagementPage initialPlacement="wishlist" />}
            />
            <Route
              path="cms/slideshows/checkout"
              element={<AdminSlideshowManagementPage initialPlacement="checkout" />}
            />
            <Route path="cms/promotions" element={<AdminCmsPage initialTab="promotions" />} />
            <Route path="cms/pages" element={<AdminContentPage initialTab="pages" />} />
            <Route path="cms/faqs" element={<AdminContentPage initialTab="faqs" />} />
            <Route path="cms/blog" element={<AdminContentPage initialTab="blog" />} />
            <Route path="cms/navigation" element={<AdminNavigationManagerPage initialTab="dashboard" />} />
            <Route path="cms/navigation/menus" element={<AdminNavigationManagerPage initialTab="menus" />} />
            <Route path="cms/navigation/slides" element={<AdminNavigationManagerPage initialTab="slides" />} />
            <Route path="cms/navigation/placements" element={<AdminNavigationManagerPage initialTab="placements" />} />
            <Route path="cms/footer" element={<AdminFooterManagerPage />} />

            {/* Analytics & Reports */}
            <Route path="reports/sales" element={<AdminReportsPage initialTab="sales" />} />
            <Route path="reports/revenue" element={<AdminReportsPage initialTab="revenue" />} />
            <Route path="reports/products" element={<AdminReportsPage initialTab="products" />} />
            <Route path="reports/customers" element={<AdminReportsPage initialTab="customers" />} />
            <Route path="reports/inventory" element={<AdminReportsPage initialTab="inventory" />} />

            {/* Website & Store Settings */}
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="settings/search" element={<AdminSearchSettingsPage />} />
            <Route path="website/header" element={<AdminWebsiteSettingsPage initialTab="header" />} />
            <Route path="website/footer" element={<AdminWebsiteSettingsPage initialTab="footer" />} />
            <Route path="settings/shipping-tax" element={<AdminWebsiteSettingsPage initialTab="shipping-tax" />} />
            <Route path="settings/email" element={<AdminWebsiteSettingsPage initialTab="email" />} />
            <Route path="settings/seo" element={<AdminWebsiteSettingsPage initialTab="seo" />} />
            <Route path="settings/security" element={<AdminWebsiteSettingsPage initialTab="security" />} />

            {/* Payments, Staff, Tools & Support */}
            <Route path="payments" element={<AdminPaymentsReportsPage />} />
            <Route path="payments/methods" element={<AdminPaymentMethodsPage />} />
            <Route path="staff" element={<AdminStaffCustomersPage />} />
            <Route path="roles" element={<AdminRolesPage />} />
            <Route path="tools/health" element={<AdminSystemToolsPage initialTab="health" />} />
            <Route path="tools/audit-logs" element={<AdminSystemToolsPage initialTab="audit-logs" />} />
            <Route path="support" element={<AdminSystemToolsPage initialTab="support" />} />
            <Route path="support/messages" element={<AdminSystemToolsPage initialTab="messages" />} />

            {/* Fallback inside /admin */}
            <Route
              path="*"
              element={
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <p className="text-3xl font-extrabold text-emerald-700 font-mono">404</p>
                  <h2 className="text-xl font-bold text-slate-900">Admin Module Not Found</h2>
                  <p className="text-sm text-slate-500">
                    The requested admin screen does not exist.
                  </p>
                  <Link
                    to="/admin"
                    className="inline-block px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold"
                  >
                    Return to Dashboard
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      ) : (
        <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
          <StorefrontHeader
            categories={categories}
            homepage={homepage}
            storeSettings={storeSettings}
          />
          <AdvertisementBanner
            placement="global_banner"
            className="max-w-7xl mx-auto w-full px-4 pt-3"
          />
          <BannerRenderer
            position="global_top_strip"
            className="max-w-7xl mx-auto w-full px-4 pt-3"
          />
          <main className="flex-1">
            <Routes>
              <Route
                path="/"
                element={
                  <HomePage
                    categories={categories}
                    homepage={homepage}
                    activePromotions={activePromotions}
                    dbUnavailable={dbUnavailable}
                  />
                }
              />
              <Route path="/shop" element={<CatalogPage categories={categories} />} />
              <Route path="/deals" element={<CatalogPage categories={categories} defaultOnSale />} />
              <Route path="/brand/:brandSlug" element={<CatalogPage categories={categories} />} />
              <Route path="/category/:slug" element={<CatalogPage categories={categories} />} />
              <Route path="/search" element={<CatalogPage categories={categories} />} />
              <Route
                path="/product/:slug"
                element={
                  <ProductDetailPage
                    homepage={homepage}
                    activePromotions={activePromotions}
                    storeSettings={storeSettings}
                  />
                }
              />
              <Route
                path="/cart"
                element={<CartPage homepage={homepage} storeSettings={storeSettings} />}
              />
              <Route path="/checkout" element={<CheckoutPage storeSettings={storeSettings} />} />
              <Route path="/order-success/:orderNumber" element={<OrderSuccessPage />} />
              <Route path="/checkout/success/:orderNumber" element={<OrderSuccessPage />} />
              <Route path="/track-order" element={<TrackOrderPage />} />
              <Route path="/contact" element={<ContactPage storeSettings={storeSettings} />} />
              <Route path="/blog" element={<BlogPage storeSettings={storeSettings} />} />
              <Route path="/blog/:slug" element={<BlogPage storeSettings={storeSettings} />} />
              <Route path="/faq" element={<FaqPage storeSettings={storeSettings} />} />
              <Route path="/page/:slug" element={<CustomStaticPage storeSettings={storeSettings} />} />
              <Route
                path="/about"
                element={<PolicyPage type="about" storeSettings={storeSettings} />}
              />
              <Route
                path="/policies/about"
                element={<PolicyPage type="about" storeSettings={storeSettings} />}
              />
              <Route
                path="/policies/return"
                element={<PolicyPage type="return" storeSettings={storeSettings} />}
              />
              <Route
                path="/policies/shipping"
                element={<PolicyPage type="shipping" storeSettings={storeSettings} />}
              />
              <Route
                path="/policies/privacy"
                element={<PolicyPage type="privacy" storeSettings={storeSettings} />}
              />
              <Route
                path="/policies/terms"
                element={<PolicyPage type="terms" storeSettings={storeSettings} />}
              />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/settings" element={<AccountPage />} />
              <Route path="/account/orders" element={<AccountPage />} />
              <Route path="/account/orders/:orderNumber" element={<OrderDetailPage />} />
              <Route path="/account/addresses" element={<AccountPage />} />
              <Route path="/account/wishlist" element={<AccountPage />} />
              <Route path="/account/reviews" element={<AccountPage />} />
              <Route path="/account/coupons" element={<AccountPage />} />
              <Route path="/wishlist" element={<AccountPage />} />
              <Route path="/verify-email" element={<AuthActionPage mode="verify-email" />} />
              <Route path="/reset-password" element={<AuthActionPage mode="reset-password" />} />
              <Route
                path="*"
                element={
                  <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
                    <p className="text-4xl font-extrabold text-emerald-700 font-mono">404</p>
                    <h1 className="text-2xl font-extrabold text-slate-900">Page Not Found</h1>
                    <p className="text-sm text-slate-600">
                      The requested page does not exist on NOVARA COMMERCE.
                    </p>
                    <Link
                      to="/"
                      className="inline-block px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold"
                    >
                      Back to Storefront
                    </Link>
                  </div>
                }
              />
            </Routes>
          </main>
          <StorefrontFooter storeSettings={storeSettings} />
          <PromoPopupManager />
        </div>
      )}

      <CartDrawer />
      <AuthModal />
      <AdminLoginModal />
      <ToastContainer />
    </>
  );
}
