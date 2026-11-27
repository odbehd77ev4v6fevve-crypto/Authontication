import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Phone,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
  User,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  DEFAULT_RESPONSIVE_CONFIG,
  DEFAULT_SLIDER_SETTINGS,
  resolveDynamicCategoryHierarchy,
} from '../../../shared/megaMenuHelpers.ts';
import { isStaffRole } from '../../../shared/rbac.ts';
import { getUserInitials, sanitizeHref } from '../../../shared/security.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { openAuthModal, logoutUser } from '../../features/auth/authSlice.ts';
import { restoreGuestCartOnLogout, setCartDrawerOpen } from '../../features/cart/cartSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import {
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SEED_PLACEHOLDERS,
  DEFAULT_SUGGESTIONS_UI_CONFIG,
} from '../../../shared/searchHelpers.ts';
import { apiRequest } from '../../lib/api.ts';
import type {
  Category,
  HomepageConfig,
  NavigationItemRecord,
  NavigationMenuItem,
  NavigationMenuRecord,
  NavigationPlacementKey,
  PublicSearchConfig,
  SearchSuggestionItem,
  StoreSettings,
} from '../../types/domain.ts';
import { MegaMenuOverlay } from '../navigation/MegaMenuOverlay.tsx';
import { MobileNavigationDrawer } from '../navigation/MobileNavigationDrawer.tsx';
import { NavIconRenderer } from '../navigation/NavIconRenderer.tsx';
import { AnimatedSearchInput } from '../search/AnimatedSearchInput.tsx';
import { SearchSuggestionDropdown } from '../search/SearchSuggestionDropdown.tsx';
import { SafeImage } from '../ui/SafeImage.tsx';

const FALLBACK_SEARCH_CONFIG: PublicSearchConfig = {
  engine: DEFAULT_SEARCH_ENGINE_CONFIG,
  placeholderAnimation: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  suggestionsUi: DEFAULT_SUGGESTIONS_UI_CONFIG,
  placeholders: DEFAULT_SEED_PLACEHOLDERS,
};

interface StorefrontHeaderProps {
  categories: Category[];
  homepage?: HomepageConfig | null;
  storeSettings?: StoreSettings | null;
}

const DEFAULT_MAIN_ITEMS: NavigationItemRecord[] = [
  {
    _id: 'def-home',
    menuId: 'default-header',
    label: 'Home',
    itemType: 'internal_route',
    url: '/',
    openInNewTab: false,
    iconType: 'lucide',
    iconName: 'Home',
    iconColor: '#16A34A',
    displayOrder: 0,
    isVisible: true,
    children: [],
  },
  {
    _id: 'def-shop',
    menuId: 'default-header',
    label: 'Shop',
    itemType: 'internal_route',
    url: '/shop',
    openInNewTab: false,
    iconType: 'none',
    iconName: 'ShoppingBag',
    displayOrder: 1,
    isVisible: true,
    children: [],
  },
  {
    _id: 'def-deals',
    menuId: 'default-header',
    label: 'Deals',
    itemType: 'flash_sale',
    url: '/deals',
    openInNewTab: false,
    iconType: 'none',
    iconName: 'Percent',
    displayOrder: 2,
    isVisible: true,
    children: [],
  },
  {
    _id: 'def-about',
    menuId: 'default-header',
    label: 'About Us',
    itemType: 'internal_route',
    url: '/policies/about',
    openInNewTab: false,
    iconType: 'none',
    iconName: 'Info',
    displayOrder: 3,
    isVisible: true,
    children: [],
  },
  {
    _id: 'def-blog',
    menuId: 'default-header',
    label: 'Blog',
    itemType: 'internal_route',
    url: '/blog',
    openInNewTab: false,
    iconType: 'none',
    iconName: 'BookOpen',
    displayOrder: 4,
    isVisible: true,
    children: [],
  },
  {
    _id: 'def-contact',
    menuId: 'default-header',
    label: 'Contact Us',
    itemType: 'internal_route',
    url: '/contact',
    openInNewTab: false,
    iconType: 'none',
    iconName: 'Phone',
    displayOrder: 5,
    isVisible: true,
    children: [],
  },
];

function isExternalHref(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function StorefrontHeader({ categories, homepage, storeSettings }: StorefrontHeaderProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const authModalMode = useAppSelector((s) => s.auth.modalMode);
  const cartItems = useAppSelector((s) => s.cart.items);
  const guestWishlistIds = useAppSelector((s) => s.wishlist.guestIds);
  const uniqueCartLines = cartItems.length;
  const wishlistCount = user ? user.wishlist?.length || 0 : guestWishlistIds.length;

  const [query, setQuery] = useState('');
  const [searchConfig, setSearchConfig] = useState<PublicSearchConfig>(FALLBACK_SEARCH_CONFIG);
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchError, setSearchError] = useState(false);

  const [accountPopupOpen, setAccountPopupOpen] = useState(false);
  const [unauthPopupMode, setUnauthPopupMode] = useState<'login' | 'register'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Unified active Mega Menu / Dropdown state
  const [activeOverlayKey, setActiveOverlayKey] = useState<'all_categories' | string | null>(null);
  const [navByPlacement, setNavByPlacement] = useState<Partial<Record<NavigationPlacementKey, NavigationMenuRecord[]>>>({});
  const [legacyHeaderItems, setLegacyHeaderItems] = useState<NavigationMenuItem[]>([]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const navBarWrapperRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const hoverOpenedAtRef = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  const searchRequestSeqRef = useRef(0);

  const loadSearchConfig = useCallback(() => {
    apiRequest<PublicSearchConfig>('/api/search/config')
      .then((res) => {
        if (res?.engine && res?.placeholderAnimation) {
          setSearchConfig(res);
        }
      })
      .catch(() => {
        // Keep resilient default fallback when offline
      });
  }, []);

  const loadNavigation = useCallback(() => {
    apiRequest<{
      menus?: NavigationMenuRecord[];
      byPlacement?: Partial<Record<NavigationPlacementKey, NavigationMenuRecord[]>>;
    }>(`/api/navigation/public?path=${encodeURIComponent(location.pathname)}`)
      .then((res) => {
        if (res?.byPlacement) {
          setNavByPlacement(res.byPlacement);
        }
      })
      .catch(() => {
        // Fallback smoothly to legacy header nav endpoint if new route/DB unavailable
        apiRequest<{ items: NavigationMenuItem[] }>('/api/cms/public/navigation?location=header')
          .then((res) => {
            if (Array.isArray(res.items)) {
              setLegacyHeaderItems(res.items);
            }
          })
          .catch(() => {});
      });
  }, [location.pathname]);

  useEffect(() => {
    loadNavigation();
    loadSearchConfig();
    const onUpdated = () => {
      loadNavigation();
      loadSearchConfig();
    };
    window.addEventListener('novara:cms-updated', onUpdated);
    window.addEventListener('novara:search-config-updated', loadSearchConfig);
    return () => {
      window.removeEventListener('novara:cms-updated', onUpdated);
      window.removeEventListener('novara:search-config-updated', loadSearchConfig);
    };
  }, [loadNavigation, loadSearchConfig]);

  useEffect(() => {
    setAccountPopupOpen(false);
    setActiveOverlayKey(null);
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    setMobileDropdownOpen(false);
    if (location.pathname === '/search') {
      const urlQ = new URLSearchParams(location.search).get('q') || '';
      setQuery(urlQ);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (authModalMode === 'login' || authModalMode === 'register') {
      setUnauthPopupMode(authModalMode);
    }
  }, [authModalMode]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (mobileSearchContainerRef.current && !mobileSearchContainerRef.current.contains(target)) {
        setMobileDropdownOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountPopupOpen(false);
      }
      if (navBarWrapperRef.current && !navBarWrapperRef.current.contains(target)) {
        setActiveOverlayKey(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountPopupOpen(false);
        setDropdownOpen(false);
        setMobileDropdownOpen(false);
        setActiveOverlayKey(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Debounced bounded cross-language autocomplete search with AbortController & sequence guard
  const anySearchDropdownOpen = dropdownOpen || mobileDropdownOpen;
  useEffect(() => {
    if (!anySearchDropdownOpen) return;
    const trimmed = query.trim();
    const minLen = searchConfig.engine.minQueryLength || 1;
    const debounceMs = searchConfig.engine.debounceMs || 220;
    const maxSug = searchConfig.engine.maxSuggestions || 8;

    if (trimmed.length > 0 && trimmed.length < minLen) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const reqSeq = ++searchRequestSeqRef.current;

    if (trimmed.length > 0) {
      setSuggestionsLoading(true);
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchError(false);
        const res = await apiRequest<{
          suggestions: SearchSuggestionItem[];
          popularSearches?: string[];
          queryMeta?: { expandedTerms?: string[] };
        }>(
          `/api/search/suggestions?q=${encodeURIComponent(trimmed)}&limit=${maxSug}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted || reqSeq !== searchRequestSeqRef.current) return;
        setSuggestions(res.suggestions || []);
        if (res.popularSearches) setPopularSearches(res.popularSearches);
        setExpandedTerms(res.queryMeta?.expandedTerms || []);
        setActiveIndex(-1);
      } catch (err) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        setSearchError(true);
      } finally {
        if (!controller.signal.aborted && reqSeq === searchRequestSeqRef.current) {
          setSuggestionsLoading(false);
        }
      }
    }, trimmed.length === 0 ? 40 : debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    anySearchDropdownOpen,
    searchConfig.engine.debounceMs,
    searchConfig.engine.minQueryLength,
    searchConfig.engine.maxSuggestions,
  ]);

  const recordSearchInteraction = (searchTerm: string, productId?: string) => {
    const clean = searchTerm.trim();
    if (!clean) return;
    try {
      sessionStorage.setItem(
        'novara_last_search',
        JSON.stringify({ query: clean, productId: productId || null, at: Date.now() })
      );
    } catch {
      // Ignore storage quota errors
    }
    if (productId) {
      void apiRequest('/api/search/track-click', {
        method: 'POST',
        body: JSON.stringify({ query: clean, productId }),
      }).catch(() => {});
    }
  };

  const handleSelectSuggestion = (item: SearchSuggestionItem) => {
    recordSearchInteraction(query, item.id);
    setDropdownOpen(false);
    setMobileDropdownOpen(false);
    navigate(`/product/${item.slug}`);
  };

  const handleSelectPopular = (term: string) => {
    setQuery(term);
    recordSearchInteraction(term);
    setDropdownOpen(false);
    setMobileDropdownOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setDropdownOpen(false);
      setMobileDropdownOpen(false);
      navigate('/shop');
      return;
    }
    recordSearchInteraction(trimmed);
    setDropdownOpen(false);
    setMobileDropdownOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      setMobileDropdownOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropdownOpen && !mobileDropdownOpen) setDropdownOpen(true);
      setActiveIndex((prev) => Math.min(suggestions.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(-1, prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
    }
  };

  const handleProtectedAccountNav = (dest: string) => {
    setAccountPopupOpen(false);
    if (!user) {
      dispatch(openAuthModal({ mode: 'login', returnTo: dest }));
      return;
    }
    navigate(dest);
  };

  const handleLogout = async () => {
    setAccountPopupOpen(false);
    await dispatch(logoutUser());
    dispatch(restoreGuestCartOnLogout());
    dispatch(pushToast({ variant: 'info', message: 'You have been signed out.' }));
    navigate('/');
  };

  const headerSettings = storeSettings?.headerSettings;
  const stickyHeader = headerSettings?.stickyHeader ?? true;
  const showSearch = headerSettings?.showSearch ?? true;
  const showWishlist = headerSettings?.showWishlist ?? true;
  const showCart = headerSettings?.showCart ?? true;
  const showAccount = headerSettings?.showAccount ?? true;
  const customLogoUrl = sanitizeHref(headerSettings?.logoUrl);

  const announcementBar = headerSettings?.announcementBar;
  const isAnnouncementActive = useMemo(() => {
    if (!announcementBar?.enabled || !announcementBar.text?.trim()) return false;
    const now = Date.now();
    if (announcementBar.startsAt) {
      const startMs = new Date(announcementBar.startsAt).getTime();
      if (!Number.isNaN(startMs) && now < startMs) return false;
    }
    if (announcementBar.endsAt) {
      const endMs = new Date(announcementBar.endsAt).getTime();
      if (!Number.isNaN(endMs) && now > endMs) return false;
    }
    return true;
  }, [announcementBar]);

  const announcementLink = sanitizeHref(announcementBar?.linkUrl);

  const announcementItems = homepage?.announcementItems?.length
    ? homepage.announcementItems
    : [
        { icon: 'truck', text: 'Free Shipping On Orders Over ৳999' },
        { icon: 'rotate', text: '7 Days Easy Return' },
        { icon: 'shield', text: 'Secure Payment' },
      ];

  const announcementPhone =
    homepage?.announcementPhone || storeSettings?.supportPhone || '+880 1234 567890';

  const fallbackCategoriesTree = useMemo(
    () =>
      resolveDynamicCategoryHierarchy(
        categories.map((c) => ({
          _id: c._id,
          name: c.name,
          nameBn: c.nameBn,
          slug: c.slug,
          parentId: c.parentId,
          image: c.image,
          displayOrder: c.displayOrder,
          isActive: c.isActive,
        })),
        { mode: 'auto' }
      ),
    [categories]
  );

  // Active resolved DB menus by placement
  const allCategoriesMenu: NavigationMenuRecord = useMemo(() => {
    const dbMenu = navByPlacement.all_categories?.[0];
    if (dbMenu) return dbMenu;
    return {
      _id: 'fallback-all-categories',
      name: 'All Categories Menu',
      slug: 'all-categories-mega-menu',
      menuType: 'category_mega_menu',
      placement: 'all_categories',
      status: 'published',
      visibility: 'public',
      displayOrder: 0,
      targetPaths: [],
      categoryMode: 'auto',
      includedCategoryIds: [],
      excludedCategoryIds: [],
      maxDepth: 3,
      megaMenuConfig: {
        ...DEFAULT_MEGA_MENU_LAYOUT,
        helpCardPhone: announcementPhone,
        showSlider: false,
      },
      appearanceConfig: DEFAULT_MEGA_MENU_APPEARANCE,
      responsiveConfig: DEFAULT_RESPONSIVE_CONFIG,
      sliderSettings: DEFAULT_SLIDER_SETTINGS,
      items: [],
      categoriesTree: fallbackCategoriesTree,
      slides: [],
    };
  }, [navByPlacement.all_categories, announcementPhone, fallbackCategoriesTree]);

  const headerMainMenu = navByPlacement.header_main?.[0] || null;
  const shopNavMenu = navByPlacement.shop_nav?.[0] || null;
  const dealsNavMenu = navByPlacement.deals_nav?.[0] || null;
  const mobileNavMenu = navByPlacement.mobile_nav?.[0] || null;

  const mainNavItems: NavigationItemRecord[] = useMemo(() => {
    if (headerMainMenu?.items && headerMainMenu.items.length > 0) {
      return headerMainMenu.items;
    }
    if (legacyHeaderItems.length > 0) {
      return legacyHeaderItems
        .filter((i) => i.isVisible && !i.parentId)
        .map((i) => ({
          _id: i._id,
          menuId: 'legacy',
          label: i.label,
          itemType: 'internal_route' as const,
          url: i.url,
          openInNewTab: i.openInNewTab,
          iconType: 'none' as const,
          iconName: 'LayoutGrid',
          displayOrder: i.displayOrder,
          isVisible: i.isVisible,
          children: legacyHeaderItems
            .filter((c) => c.isVisible && String(c.parentId || '') === String(i._id))
            .map((c) => ({
              _id: c._id,
              menuId: 'legacy',
              parentId: i._id,
              label: c.label,
              itemType: 'internal_route' as const,
              url: c.url,
              openInNewTab: c.openInNewTab,
              iconType: 'none' as const,
              iconName: 'ChevronRight',
              displayOrder: c.displayOrder,
              isVisible: c.isVisible,
              children: [],
            })),
        }));
    }
    return DEFAULT_MAIN_ITEMS;
  }, [headerMainMenu, legacyHeaderItems]);

  const cancelHoverClose = () => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleHoverClose = () => {
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setActiveOverlayKey(null);
    }, 180);
  };

  const activeOverlayKeyRef = useRef<'all_categories' | string | null>(null);
  activeOverlayKeyRef.current = activeOverlayKey;

  const openOverlayByHover = (key: string) => {
    cancelHoverClose();
    if (activeOverlayKeyRef.current !== key) {
      hoverOpenedAtRef.current = { key, at: Date.now() };
      setActiveOverlayKey(key);
    }
  };

  const toggleOverlayByClick = (key: string) => {
    cancelHoverClose();
    const current = activeOverlayKeyRef.current;
    if (
      current === key &&
      hoverOpenedAtRef.current.key === key &&
      Date.now() - hoverOpenedAtRef.current.at < 450
    ) {
      hoverOpenedAtRef.current = { key: null, at: 0 };
      return;
    }
    hoverOpenedAtRef.current = { key: null, at: 0 };
    setActiveOverlayKey(current === key ? null : key);
  };

  const resolveMenuForNavItem = (item: NavigationItemRecord): NavigationMenuRecord | null => {
    const slugHint = (item.targetSlug || item.url || '').toLowerCase();
    const labelHint = item.label.toLowerCase();
    if (shopNavMenu && (slugHint === '/shop' || labelHint === 'shop')) {
      return shopNavMenu;
    }
    if (dealsNavMenu && (slugHint.includes('/deals') || slugHint.includes('onsale=true') || labelHint === 'deals')) {
      return dealsNavMenu;
    }
    if (item.children && item.children.length > 0) {
      return {
        _id: `sub-${item._id}`,
        name: item.label,
        slug: `item-${item._id}`,
        menuType: item.children.some((c) => c.children && c.children.length > 0)
          ? 'mega_menu'
          : 'classic_dropdown',
        placement: 'header_main',
        status: 'published',
        visibility: 'public',
        displayOrder: 0,
        targetPaths: [],
        categoryMode: 'manual',
        includedCategoryIds: [],
        excludedCategoryIds: [],
        maxDepth: 3,
        megaMenuConfig: {
          ...DEFAULT_MEGA_MENU_LAYOUT,
          showSidebar: false,
          showSlider: false,
          columns: '2',
        },
        appearanceConfig: headerMainMenu?.appearanceConfig || DEFAULT_MEGA_MENU_APPEARANCE,
        responsiveConfig: DEFAULT_RESPONSIVE_CONFIG,
        sliderSettings: DEFAULT_SLIDER_SETTINGS,
        items: item.children,
        categoriesTree: [],
        slides: [],
      };
    }
    return null;
  };

  const activeMegaMenu = useMemo(() => {
    if (!activeOverlayKey) return null;
    if (activeOverlayKey === 'all_categories') {
      return allCategoriesMenu;
    }
    const targetItem = mainNavItems.find((i) => i._id === activeOverlayKey);
    return targetItem ? resolveMenuForNavItem(targetItem) : null;
  }, [activeOverlayKey, allCategoriesMenu, mainNavItems, shopNavMenu, dealsNavMenu, headerMainMenu]);

  const isOverlayClassicDropdown =
    activeMegaMenu &&
    (activeMegaMenu.menuType === 'classic_dropdown' || activeMegaMenu.menuType === 'nested_dropdown');

  const renderNavLink = (
    item: { label: string; url: string; openInNewTab?: boolean },
    className: string,
    onSelect?: () => void,
    icon?: React.ReactNode
  ) => {
    const safeUrl = sanitizeHref(item.url) || '/';
    if (item.openInNewTab || isExternalHref(safeUrl)) {
      return (
        <a
          href={safeUrl}
          target={item.openInNewTab ? '_blank' : undefined}
          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
          onClick={onSelect}
          className={className}
        >
          {icon}
          <span>{item.label}</span>
        </a>
      );
    }
    return (
      <Link
        to={safeUrl}
        target={item.openInNewTab ? '_blank' : undefined}
        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
        onClick={onSelect}
        className={className}
      >
        {icon}
        <span>{item.label}</span>
      </Link>
    );
  };

  const storeName = storeSettings?.storeName?.trim() || 'ShopVista';
  const nameWords = storeName.split(/\s+/);
  const firstWord = nameWords[0] || 'ShopVista';
  const restWords = nameWords.slice(1).join(' ');
  const isAllCatsTriggerHover = allCategoriesMenu.appearanceConfig?.triggerMode !== 'click';

  return (
    <header className={`${stickyHeader ? 'sticky top-0' : 'relative'} z-40 bg-white border-b border-slate-200`}>
      {/* Dynamic Promotional Announcement Strip */}
      {isAnnouncementActive && announcementBar && (
        <div
          className="text-xs font-semibold text-center px-4 py-1.5"
          style={{
            backgroundColor: announcementBar.backgroundColor || '#16A34A',
            color: announcementBar.textColor || '#FFFFFF',
          }}
        >
          {announcementLink ? (
            isExternalHref(announcementLink) ? (
              <a
                href={announcementLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {announcementBar.text}
              </a>
            ) : (
              <Link to={announcementLink} className="underline-offset-2 hover:underline">
                {announcementBar.text}
              </Link>
            )
          ) : (
            <span>{announcementBar.text}</span>
          )}
        </div>
      )}

      {/* Top Dark Utility Bar */}
      <div className="bg-[#0B1A2B] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-6 overflow-x-auto no-scrollbar">
            {announcementItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  idx > 0 ? 'hidden sm:flex border-l border-slate-700 pl-4 md:pl-6' : ''
                }`}
              >
                {item.icon === 'truck' && <Truck className="w-3.5 h-3.5 text-emerald-400" />}
                {item.icon === 'rotate' && <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />}
                {item.icon === 'shield' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="text-slate-200 font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          {announcementPhone && (
            <Link
              to="/contact"
              className="flex items-center gap-1.5 text-slate-200 hover:text-white whitespace-nowrap shrink-0 font-medium"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="tabular-nums">{announcementPhone}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main White Header Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-700 hover:bg-slate-100 shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
            {customLogoUrl ? (
              <SafeImage
                src={customLogoUrl}
                alt={storeName}
                className="h-9 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center text-white shadow-xs shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[16px] sm:text-xl font-extrabold tracking-tight leading-none whitespace-nowrap">
                    <span className="text-slate-900">{firstWord}</span>
                    {restWords ? (
                      <span className="text-[#16A34A]"> {restWords}</span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5 hidden sm:block">
                    {storeSettings?.tagline || 'Shop Smart, Live Better'}
                  </p>
                </div>
              </>
            )}
          </Link>
        </div>

        {/* Bounded Pill Search Bar with Dynamic Animated Placeholder & Smart Cross-Lingual Suggestions */}
        {showSearch ? (
          <div ref={searchContainerRef} className="relative flex-1 min-w-0 max-w-xl hidden md:block">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center rounded-full border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/25 focus-within:border-[#16A34A] overflow-hidden transition-all"
            >
              <AnimatedSearchInput
                value={query}
                onFocus={() => setDropdownOpen(true)}
                onChange={(next) => {
                  setQuery(next);
                  setDropdownOpen(true);
                }}
                onClear={() => {
                  setQuery('');
                  setSuggestions([]);
                  setActiveIndex(-1);
                  setDropdownOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                device="desktop"
                config={searchConfig}
                ariaLabel="Search for products in English or Bangla"
                ariaExpanded={dropdownOpen}
                ariaControls="desktop-search-listbox"
                ariaActiveDescendant={
                  activeIndex >= 0 ? `desktop-search-listbox-opt-${activeIndex}` : undefined
                }
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="h-10 px-5 rounded-full bg-[#16A34A] hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shrink-0"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            <SearchSuggestionDropdown
              open={dropdownOpen}
              listboxId="desktop-search-listbox"
              query={query}
              suggestions={suggestions}
              popularSearches={popularSearches}
              expandedTerms={expandedTerms}
              loading={suggestionsLoading}
              error={searchError}
              activeIndex={activeIndex}
              uiConfig={searchConfig.suggestionsUi}
              maxHeightPx={searchConfig.engine.dropdownMaxHeightPx}
              onSelectSuggestion={handleSelectSuggestion}
              onSelectPopular={handleSelectPopular}
              onViewAll={() => {
                const trimmed = query.trim();
                recordSearchInteraction(trimmed);
                setDropdownOpen(false);
                navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/shop');
              }}
            />
          </div>
        ) : (
          <div className="flex-1 hidden md:block" />
        )}

        {/* Account Popup + Wishlist + Redux Cart */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          {showAccount && (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountPopupOpen((v) => !v)}
                aria-expanded={accountPopupOpen}
                aria-haspopup="menu"
                aria-label={user ? `Account menu for ${user.name}` : 'Account menu'}
                className="flex items-center gap-2 rounded-full sm:rounded-xl sm:px-2 py-1 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/40"
              >
                <span
                  className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
                    user
                      ? 'bg-[#0B3B22] text-white border border-emerald-700/30'
                      : 'bg-slate-100 border border-slate-200 text-slate-700'
                  }`}
                >
                  {user ? (
                    user.avatarUrl ? (
                      <SafeImage
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-extrabold tracking-tight">
                        {getUserInitials(user.name)}
                      </span>
                    )
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </span>
                <span className="hidden lg:block text-left leading-tight">
                  <span className="block text-xs font-bold text-slate-900">
                    {user ? user.name.split(' ')[0] : 'Account'}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                    <span>{user ? 'Manage Account' : 'Login / Register'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </span>
              </button>

              {accountPopupOpen && (
                <div
                  role="menu"
                  aria-label="Customer account menu"
                  className="absolute right-0 mt-2.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-[0_18px_40px_rgba(15,23,42,0.14)] z-50 overflow-hidden"
                >
                  {user ? (
                    <>
                      <div className="px-4 py-3.5 bg-gradient-to-br from-[#F4FAF6] to-white border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0B3B22] text-white font-extrabold text-xs overflow-hidden flex items-center justify-center border border-emerald-700/20 shrink-0">
                          {user.avatarUrl ? (
                            <SafeImage
                              src={user.avatarUrl}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{getUserInitials(user.name)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="py-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleProtectedAccountNav('/account')}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-[#EAF7EE] hover:text-[#14532D] text-left transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4 text-slate-400" />
                          <span>My Account</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleProtectedAccountNav('/account/orders')}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-[#EAF7EE] hover:text-[#14532D] text-left transition-colors"
                        >
                          <Package className="w-4 h-4 text-slate-400" />
                          <span>My Orders</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAccountPopupOpen(false);
                            navigate('/account/wishlist');
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-[#EAF7EE] hover:text-[#14532D] text-left transition-colors"
                        >
                          <Heart className="w-4 h-4 text-slate-400" />
                          <span>My Wishlist</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleProtectedAccountNav('/account/reviews')}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-[#EAF7EE] hover:text-[#14532D] text-left transition-colors"
                        >
                          <Star className="w-4 h-4 text-slate-400" />
                          <span>My Reviews</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleProtectedAccountNav('/account/settings')}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-[#EAF7EE] hover:text-[#14532D] text-left transition-colors"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          <span>Account Settings</span>
                        </button>

                        {isStaffRole(user.role) && (
                          <div className="border-t border-slate-100 mt-1.5 pt-2">
                            <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              Administrator
                            </p>
                            <Link
                              to="/admin"
                              role="menuitem"
                              onClick={() => setAccountPopupOpen(false)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              <LayoutDashboard className="w-4 h-4" />
                              <span>Admin Panel</span>
                            </Link>
                          </div>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 text-left border-t border-slate-100 mt-1.5"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 space-y-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-slate-900">Welcome to {storeName}</p>
                        <p className="text-xs text-slate-500">
                          Sign in or create a customer account to track orders and manage your profile.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2" role="group" aria-label="Account authentication options">
                        <button
                          type="button"
                          aria-pressed={unauthPopupMode === 'login'}
                          onClick={() => {
                            setUnauthPopupMode('login');
                            setAccountPopupOpen(false);
                            dispatch(openAuthModal({ mode: 'login' }));
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-colors ${
                            unauthPopupMode === 'login'
                              ? 'bg-[#16A34A] hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          Sign In
                        </button>
                        <button
                          type="button"
                          aria-pressed={unauthPopupMode === 'register'}
                          onClick={() => {
                            setUnauthPopupMode('register');
                            setAccountPopupOpen(false);
                            dispatch(openAuthModal({ mode: 'register' }));
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-colors ${
                            unauthPopupMode === 'register'
                              ? 'bg-[#16A34A] hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          Create Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showWishlist && (
            <button
              type="button"
              onClick={() => navigate('/account/wishlist')}
              aria-label={`Wishlist (${wishlistCount} items)`}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
            >
              <Heart className="w-4 h-4" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {wishlistCount}
                </span>
              )}
            </button>
          )}

          {showCart && (
            <button
              type="button"
              onClick={() => {
                dispatch(setCartDrawerOpen(false));
                navigate('/cart');
              }}
              aria-label={`Shopping cart (${uniqueCartLines} items)`}
              data-testid="header-cart-button"
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              {uniqueCartLines > 0 && (
                <span
                  data-testid="cart-badge-count"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
                >
                  {uniqueCartLines}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Category & Primary Mega Menu Navigation Bar */}
      <div
        ref={navBarWrapperRef}
        onMouseLeave={scheduleHoverClose}
        onMouseEnter={cancelHoverClose}
        className="relative border-t border-slate-100 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            {/* Vibrant Green All Categories Mega Menu Trigger */}
            {allCategoriesMenu.responsiveConfig?.desktopEnabled !== false && (
              <div
                className="relative shrink-0"
                onMouseEnter={() => {
                  if (isAllCatsTriggerHover) {
                    openOverlayByHover('all_categories');
                  }
                }}
              >
                <button
                  type="button"
                  data-testid="all-categories-trigger"
                  onClick={() => toggleOverlayByClick('all_categories')}
                  aria-expanded={activeOverlayKey === 'all_categories'}
                  aria-haspopup="true"
                  className="h-9 px-4 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap"
                >
                  <Menu className="w-4 h-4" />
                  <span>{allCategoriesMenu.megaMenuConfig?.allCategoriesLabel || 'All Categories'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      activeOverlayKey === 'all_categories' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Dynamic Horizontal Main Menu Links */}
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-2 xl:gap-4 text-sm font-semibold">
              {mainNavItems.map((item) => {
                const subMenu = resolveMenuForNavItem(item);
                const isOpen = activeOverlayKey === item._id;
                const isRouteActive =
                  item.url === '/'
                    ? location.pathname === '/'
                    : location.pathname + location.search === item.url ||
                      (item.url !== '/' && location.pathname === item.url);

                const iconNode =
                  item.iconType !== 'none' ? (
                    <NavIconRenderer
                      iconType={item.iconType}
                      iconName={item.iconName}
                      iconSvg={item.iconSvg}
                      iconImageUrl={item.iconImageUrl}
                      iconColor={isRouteActive || isOpen ? '#16A34A' : item.iconColor || '#475569'}
                      sizePx={15}
                    />
                  ) : null;

                if (subMenu) {
                  return (
                    <div
                      key={item._id}
                      className="relative shrink-0"
                      onMouseEnter={() => {
                        cancelHoverClose();
                        if (subMenu.appearanceConfig?.triggerMode !== 'click') {
                          openOverlayByHover(item._id);
                        }
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleOverlayByClick(item._id)}
                        aria-expanded={isOpen}
                        aria-haspopup="true"
                        className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-t-lg border-b-2 transition-colors ${
                          isOpen
                            ? 'bg-emerald-50/90 text-[#15803D] border-[#16A34A]'
                            : isRouteActive
                            ? 'border-transparent text-[#15803D] hover:bg-emerald-50/60'
                            : 'border-transparent text-slate-700 hover:text-[#16A34A] hover:bg-slate-50'
                        }`}
                      >
                        {iconNode}
                        <span>{item.label}</span>
                        {item.badgeText && (
                          <span
                            style={{
                              backgroundColor: item.badgeBgColor || '#16A34A',
                              color: item.badgeTextColor || '#FFFFFF',
                            }}
                            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none"
                          >
                            {item.badgeText}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Classic / Nested Dropdown anchored to item */}
                      {isOpen && isOverlayClassicDropdown && activeMegaMenu && (
                        <div className="absolute left-0 top-full pt-2 z-50">
                          <MegaMenuOverlay
                            menu={activeMegaMenu}
                            fallbackPhone={announcementPhone}
                            onClose={() => setActiveOverlayKey(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={item._id} className="shrink-0">
                    {renderNavLink(
                      item,
                      `flex items-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg border-b-2 transition-colors ${
                        isRouteActive
                          ? 'border-transparent text-[#15803D] hover:bg-emerald-50/60'
                          : 'border-transparent text-slate-700 hover:text-[#16A34A] hover:bg-slate-50'
                      }`,
                      () => setActiveOverlayKey(null),
                      iconNode
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {user && isStaffRole(user.role) && (
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </Link>
          )}
        </div>

        {/* Full-Width Centered Mega Menu Overlay (Reference Match) */}
        {activeMegaMenu && !isOverlayClassicDropdown && (
          <div
            className="hidden md:block absolute left-0 right-0 top-full pt-2 z-50 pointer-events-none"
            onMouseEnter={cancelHoverClose}
            onMouseLeave={scheduleHoverClose}
          >
            <div
              className={`${
                activeMegaMenu.appearanceConfig?.menuWidth === 'full'
                  ? 'w-full px-4'
                  : 'max-w-7xl mx-auto px-4'
              } pointer-events-auto`}
              style={
                activeMegaMenu.appearanceConfig?.menuWidth === 'custom'
                  ? {
                      maxWidth: `${activeMegaMenu.appearanceConfig.customWidthPx || 1180}px`,
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }
                  : undefined
              }
            >
              <MegaMenuOverlay
                menu={activeMegaMenu}
                fallbackPhone={announcementPhone}
                onClose={() => setActiveOverlayKey(null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Search with Animated Placeholder & Live Suggestions */}
      {showSearch && (
        <div
          ref={mobileSearchContainerRef}
          className="md:hidden px-4 pb-3 bg-white border-t border-slate-100 relative"
        >
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center mt-2 rounded-full border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/25 focus-within:border-[#16A34A] overflow-hidden"
          >
            <AnimatedSearchInput
              value={query}
              onFocus={() => setMobileDropdownOpen(true)}
              onChange={(next) => {
                setQuery(next);
                setMobileDropdownOpen(true);
              }}
              onClear={() => {
                setQuery('');
                setSuggestions([]);
                setActiveIndex(-1);
                setMobileDropdownOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              device="mobile"
              config={searchConfig}
              ariaLabel="Mobile search"
              ariaExpanded={mobileDropdownOpen}
              ariaControls="mobile-search-listbox"
              ariaActiveDescendant={
                activeIndex >= 0 ? `mobile-search-listbox-opt-${activeIndex}` : undefined
              }
              inputClassName="w-full h-9 pl-3.5 pr-7 bg-transparent text-sm text-slate-900 focus:outline-none"
              placeholderClassName="text-xs text-slate-400 pl-3.5"
            />
            <button
              type="submit"
              aria-label="Search"
              className="h-9 px-4 rounded-r-full bg-[#16A34A] hover:bg-emerald-700 text-white flex items-center justify-center shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          <SearchSuggestionDropdown
            open={mobileDropdownOpen}
            listboxId="mobile-search-listbox"
            query={query}
            suggestions={suggestions}
            popularSearches={popularSearches}
            expandedTerms={expandedTerms}
            loading={suggestionsLoading}
            error={searchError}
            activeIndex={activeIndex}
            uiConfig={searchConfig.suggestionsUi}
            maxHeightPx={Math.min(360, searchConfig.engine.dropdownMaxHeightPx)}
            onSelectSuggestion={handleSelectSuggestion}
            onSelectPopular={handleSelectPopular}
            onViewAll={() => {
              const trimmed = query.trim();
              recordSearchInteraction(trimmed);
              setMobileDropdownOpen(false);
              navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/shop');
            }}
          />
        </div>
      )}

      {/* Dedicated Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        storeName={storeName}
        allCategoriesMenu={allCategoriesMenu}
        mainNavItems={mainNavItems}
        mobileMenuConfig={mobileNavMenu}
        searchConfig={searchConfig}
        categoriesTree={
          mobileNavMenu?.categoriesTree && mobileNavMenu.categoriesTree.length > 0
            ? mobileNavMenu.categoriesTree
            : allCategoriesMenu.categoriesTree && allCategoriesMenu.categoriesTree.length > 0
            ? allCategoriesMenu.categoriesTree
            : fallbackCategoriesTree
        }
      />
    </header>
  );
}
