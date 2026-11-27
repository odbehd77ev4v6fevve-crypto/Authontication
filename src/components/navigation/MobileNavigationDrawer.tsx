import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  Search,
  ShoppingBag,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { isStaffRole } from '../../../shared/rbac.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { openAuthModal } from '../../features/auth/authSlice.ts';
import { setCartDrawerOpen } from '../../features/cart/cartSlice.ts';
import type {
  NavigationItemRecord,
  NavigationMenuRecord,
  PublicSearchConfig,
  ResolvedNavCategory,
} from '../../types/domain.ts';
import { AnimatedSearchInput } from '../search/AnimatedSearchInput.tsx';
import { MegaMenuPromoSlider } from './MegaMenuPromoSlider.tsx';
import { NavIconRenderer } from './NavIconRenderer.tsx';

interface MobileNavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  storeName: string;
  allCategoriesMenu?: NavigationMenuRecord | null;
  mainNavItems: NavigationItemRecord[];
  mobileMenuConfig?: NavigationMenuRecord | null;
  searchConfig?: PublicSearchConfig | null;
  categoriesTree: ResolvedNavCategory[];
  previewMode?: boolean;
}

export function MobileNavigationDrawer({
  open,
  onClose,
  storeName,
  allCategoriesMenu,
  mainNavItems,
  mobileMenuConfig,
  searchConfig,
  categoriesTree,
  previewMode = false,
}: MobileNavigationDrawerProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const cartCount = useAppSelector((s) => s.cart.items.length);
  const wishlistCount = useAppSelector((s) =>
    s.auth.user ? s.auth.user.wishlist?.length || 0 : s.wishlist.guestIds.length
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [expandedNavId, setExpandedNavId] = useState<string | null>(null);
  const [drilldownCategory, setDrilldownCategory] = useState<ResolvedNavCategory | null>(null);

  const drawerMode = mobileMenuConfig?.responsiveConfig?.mobileDrawerMode || 'accordion';
  const showSlides =
    (mobileMenuConfig?.responsiveConfig?.showPromoSliderOnMobile ?? true) &&
    ((mobileMenuConfig?.slides && mobileMenuConfig.slides.length > 0) ||
      (allCategoriesMenu?.slides && allCategoriesMenu.slides.length > 0));
  const activeSlides =
    mobileMenuConfig?.slides && mobileMenuConfig.slides.length > 0
      ? mobileMenuConfig.slides
      : allCategoriesMenu?.slides || [];

  useEffect(() => {
    if (!open || previewMode) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, previewMode]);

  useEffect(() => {
    if (!open) {
      setDrilldownCategory(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!previewMode) {
      onClose();
      navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/shop');
    }
  };

  const renderLink = (url: string, label: string, openInNewTab?: boolean) => {
    const safe = sanitizeHref(url) || '/shop';
    const isExt = /^https?:\/\//i.test(safe);
    if (openInNewTab || isExt) {
      return (
        <a
          href={safe}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          onClick={() => !previewMode && onClose()}
          className="flex-1 text-left truncate"
        >
          {label}
        </a>
      );
    }
    return (
      <Link
        to={safe}
        onClick={() => !previewMode && onClose()}
        className="flex-1 text-left truncate"
      >
        {label}
      </Link>
    );
  };

  const drawerContent = (
    <div
      className={`${
        previewMode ? 'w-full h-[640px]' : 'w-full max-w-[350px] h-full'
      } bg-white flex flex-col shadow-2xl overflow-hidden`}
      role="dialog"
      aria-modal={!previewMode}
      aria-label="Mobile navigation menu"
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#0B1A2B] text-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center text-white shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm truncate">{storeName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close mobile menu"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Search */}
      <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
        <form
          onSubmit={handleSearch}
          className="flex items-center rounded-full border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-emerald-500/30 overflow-hidden"
        >
          <AnimatedSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            device="mobile"
            config={searchConfig}
            ariaLabel="Mobile drawer search"
            inputClassName="w-full h-9 pl-3 pr-7 bg-transparent text-xs text-slate-900 focus:outline-none"
            placeholderClassName="text-xs text-slate-400 pl-3"
          />
          <button
            type="submit"
            aria-label="Search"
            className="h-9 px-3.5 rounded-r-full bg-[#16A34A] text-white flex items-center justify-center shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden mega-menu-scroll p-3.5 space-y-4">
        {/* Drilldown Subcategory View */}
        {drilldownCategory ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setDrilldownCategory(null)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-[#15803D] text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Categories</span>
            </button>
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-extrabold text-slate-900">{drilldownCategory.name}</h3>
              <Link
                to={`/category/${drilldownCategory.slug}`}
                onClick={() => !previewMode && onClose()}
                className="text-xs font-bold text-[#16A34A]"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-1">
              {drilldownCategory.subcategories.map((sub) => (
                <Link
                  key={sub._id}
                  to={`/category/${sub.slug}`}
                  onClick={() => !previewMode && onClose()}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <span>{sub.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Categories Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Shop Categories
                </p>
                <Link
                  to="/shop"
                  onClick={() => !previewMode && onClose()}
                  className="text-[11px] font-bold text-[#16A34A]"
                >
                  Browse All
                </Link>
              </div>

              {categoriesTree.length === 0 ? (
                <Link
                  to="/shop"
                  onClick={() => !previewMode && onClose()}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 text-[#15803D] text-xs font-bold"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Explore Catalog</span>
                </Link>
              ) : (
                <div className="space-y-1">
                  {categoriesTree.map((cat) => {
                    const hasSubs = cat.subcategories.length > 0;
                    const isExpanded = expandedCatId === cat._id;
                    return (
                      <div key={cat._id} className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-white">
                          <Link
                            to={`/category/${cat.slug}`}
                            onClick={() => !previewMode && onClose()}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-xs font-bold text-slate-800 hover:text-[#16A34A]"
                          >
                            <span
                              style={{
                                backgroundColor: cat.iconBgColor || '#DCFCE7',
                                color: cat.iconColor || '#16A34A',
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            >
                              <NavIconRenderer
                                iconType="lucide"
                                iconName={cat.iconName || 'LayoutGrid'}
                                iconColor={cat.iconColor}
                                sizePx={15}
                              />
                            </span>
                            <span className="truncate">{cat.name}</span>
                          </Link>

                          {hasSubs && (
                            <button
                              type="button"
                              aria-label={`Expand ${cat.name}`}
                              aria-expanded={isExpanded}
                              onClick={() => {
                                if (drawerMode === 'drilldown') {
                                  setDrilldownCategory(cat);
                                } else {
                                  setExpandedCatId(isExpanded ? null : cat._id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              {drawerMode === 'drilldown' ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isExpanded ? 'rotate-180 text-[#16A34A]' : ''
                                  }`}
                                />
                              )}
                            </button>
                          )}
                        </div>

                        {drawerMode === 'accordion' && hasSubs && isExpanded && (
                          <div className="bg-slate-50/70 px-3 py-2 border-t border-slate-100 space-y-1">
                            {cat.subcategories.map((sub) => (
                              <Link
                                key={sub._id}
                                to={`/category/${sub.slug}`}
                                onClick={() => !previewMode && onClose()}
                                className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-xs text-slate-700 hover:bg-emerald-50 hover:text-[#16A34A]"
                              >
                                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Primary Navigation Links */}
            {mainNavItems.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <p className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Navigation
                </p>
                {mainNavItems.map((item) => {
                  const hasChildren = Boolean(item.children && item.children.length > 0);
                  const isExp = expandedNavId === item._id;
                  return (
                    <div key={item._id} className="rounded-xl border border-slate-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          {item.iconType !== 'none' && (
                            <NavIconRenderer
                              iconType={item.iconType}
                              iconName={item.iconName}
                              iconSvg={item.iconSvg}
                              iconImageUrl={item.iconImageUrl}
                              iconColor={item.iconColor}
                              sizePx={15}
                            />
                          )}
                          {renderLink(item.url, item.label, item.openInNewTab)}
                        </span>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setExpandedNavId(isExp ? null : item._id)}
                            aria-label={`Toggle ${item.label} submenu`}
                            className="p-1 text-slate-500"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {hasChildren && isExp && (
                        <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100 space-y-1">
                          {item.children!.map((child) => (
                            <div key={child._id} className="py-1.5 px-2 text-xs text-slate-700 flex items-center gap-1.5">
                              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                              {renderLink(child.url, child.label, child.openInNewTab)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Responsive Promotional Slider */}
            {showSlides && (
              <div className="pt-2 border-t border-slate-100">
                <MegaMenuPromoSlider
                  slides={activeSlides}
                  sliderSettings={mobileMenuConfig?.sliderSettings || allCategoriesMenu?.sliderSettings}
                  compact
                  onNavigate={() => !previewMode && onClose()}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Quick Account Bar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-2 shrink-0 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => {
            if (previewMode) return;
            onClose();
            if (user) navigate('/account');
            else dispatch(openAuthModal({ mode: 'login' }));
          }}
          className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#16A34A]"
        >
          <User className="w-4 h-4" />
          <span className="truncate max-w-full px-1">{user ? 'Account' : 'Sign In'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (previewMode) return;
            onClose();
            navigate('/account/wishlist');
          }}
          className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#16A34A]"
        >
          <Heart className="w-4 h-4" />
          <span>Wishlist ({wishlistCount})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (previewMode) return;
            onClose();
            dispatch(setCartDrawerOpen(false));
            navigate('/cart');
          }}
          className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#16A34A]"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Cart ({cartCount})</span>
        </button>

        {user && isStaffRole(user.role) && (
          <Link
            to="/admin"
            onClick={() => !previewMode && onClose()}
            className="col-span-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#16A34A] text-white"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Admin Operations Panel</span>
          </Link>
        )}
      </div>
    </div>
  );

  if (previewMode) {
    return (
      <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-lg mx-auto max-w-[360px]">
        {drawerContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] lg:hidden flex">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 h-full w-full max-w-[350px]">{drawerContent}</div>
    </div>
  );
}
