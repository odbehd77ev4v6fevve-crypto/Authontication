import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Maximize2,
  Megaphone,
  Menu,
  Minimize2,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { hasEffectivePermission, isStaffRole, ROLE_METADATA, type Permission } from '../../../shared/rbac.ts';
import { getUserInitials } from '../../../shared/security.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { GlobalSearchModal } from '../../components/admin/GlobalSearchModal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { SeoHead } from '../../components/ui/SeoHead.tsx';
import { logoutUser, openAdminAuthModal } from '../../features/auth/authSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { AdminNotificationItem, AuthUser } from '../../types/domain.ts';

interface SubNavItem {
  to: string;
  label: string;
  permission?: Permission;
}

interface SidebarGroupItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  to?: string;
  badgeCount?: number;
  children?: SubNavItem[];
}

export function AdminLayout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, initialized } = useAppSelector((s) => s.auth);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingOrdersBadge, setPendingOrdersBadge] = useState(0);

  const canReadOrders = Boolean(user && isStaffRole(user.role) && hasEffectivePermission(user, 'orders:read'));

  const loadNotifications = useCallback(() => {
    if (!canReadOrders) return;
    apiRequest<{ notifications: AdminNotificationItem[]; unreadCount: number }>(
      '/api/orders/admin/notifications'
    )
      .then((res) => {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => {});

    apiRequest<{ metrics?: { pendingOrders?: number } }>('/api/support/admin/dashboard?range=30D')
      .then((res) => {
        setPendingOrdersBadge(res.metrics?.pendingOrders ?? 0);
      })
      .catch(() => {});
  }, [canReadOrders]);

  useEffect(() => {
    if (!user || !isStaffRole(user.role)) return;
    apiRequest<{ user: AuthUser }>('/api/admin/auth/me').catch(() => {
      // 401 handler automatically clears stale/revoked session
    });
  }, [user?.id, location.pathname]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, location.pathname]);

  // Keyboard Ctrl+K / Cmd+K global search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted iframes
    }
  };

  const handleMarkRead = async (item: AdminNotificationItem) => {
    setNotificationsOpen(false);
    if (!item.isRead) {
      setNotifications((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await apiRequest(`/api/orders/admin/notifications/${item._id}/read`, { method: 'PATCH' });
      } catch {
        // ignore
      }
    }
    navigate('/admin/orders');
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiRequest('/api/orders/admin/notifications/read-all', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await dispatch(logoutUser());
    dispatch(pushToast({ variant: 'info', message: 'Signed out of admin panel.' }));
    navigate('/');
  };

  if (initialized && (!user || !isStaffRole(user.role))) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center p-4">
        <SeoHead title="Admin Access Required" />
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#16A34A] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">NOVARA Admin Operations</h1>
          <p className="text-sm text-slate-600">
            {user
              ? `Signed in as ${user.email} (${user.role}). Staff RBAC permissions are required to enter the Admin Panel.`
              : 'Sign in with a verified staff or Super Admin account to manage NOVARA COMMERCE.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {!user && (
              <button
                type="button"
                onClick={() => dispatch(openAdminAuthModal({ returnTo: location.pathname }))}
                className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                Administrator Sign In
              </button>
            )}
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold"
            >
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#16A34A] border-t-transparent animate-spin" />
      </div>
    );
  }

  const mainMenuGroups: SidebarGroupItem[] = [
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      permission: 'catalog:read',
      children: [
        { to: '/admin/products', label: 'All Products', permission: 'catalog:read' },
        { to: '/admin/products/new', label: 'Add Product', permission: 'catalog:write' },
        { to: '/admin/taxonomy', label: 'Categories', permission: 'catalog:write' },
        { to: '/admin/brands', label: 'Brands', permission: 'catalog:write' },
        { to: '/admin/attributes', label: 'Attributes & Groups', permission: 'catalog:write' },
        { to: '/admin/inventory', label: 'Inventory & Stock', permission: 'inventory:read' },
      ],
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingBag,
      permission: 'orders:read',
      badgeCount: pendingOrdersBadge > 0 ? pendingOrdersBadge : unreadCount,
      children: [
        { to: '/admin/orders', label: 'All Orders' },
        { to: '/admin/orders/pending', label: 'Pending Orders' },
        { to: '/admin/orders/processing', label: 'Processing' },
        { to: '/admin/orders/shipped', label: 'Shipped' },
        { to: '/admin/orders/delivered', label: 'Delivered' },
        { to: '/admin/orders/cancelled', label: 'Cancelled' },
        { to: '/admin/orders/cancellations', label: 'Cancellation Requests' },
        { to: '/admin/orders/returns', label: 'Returns & Refunds', permission: 'returns:manage' },
        { to: '/admin/orders/create', label: 'Create Manual Order', permission: 'orders:transition' },
      ],
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      permission: 'customers:read',
      children: [
        { to: '/admin/customers', label: 'Customer Directory' },
        { to: '/admin/customer-groups', label: 'Customer Groups' },
        { to: '/admin/reviews', label: 'Reviews Queue', permission: 'reviews:moderate' },
        { to: '/admin/qa', label: 'Product Q&A', permission: 'reviews:moderate' },
      ],
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: FolderTree,
      permission: 'catalog:write',
      to: '/admin/taxonomy',
    },
    {
      id: 'discounts',
      label: 'Discounts & Coupons',
      icon: TicketPercent,
      permission: 'coupons:write',
      children: [
        { to: '/admin/marketing/coupons', label: 'Coupons' },
        { to: '/admin/marketing/rules', label: 'Discount Rules' },
        { to: '/admin/marketing/offers', label: 'Special Offers' },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      permission: 'ads:write',
      children: [
        { to: '/admin/cms/slideshows', label: 'All Slideshows', permission: 'cms:write' },
        { to: '/admin/cms/slideshows/homepage', label: 'Homepage Slideshow', permission: 'cms:write' },
        { to: '/admin/cms/slideshows/cart', label: 'Cart Page Slideshow', permission: 'cms:write' },
        { to: '/admin/cms/slideshows/wishlist', label: 'Wishlist Page Slideshow', permission: 'cms:write' },
        { to: '/admin/cms/slideshows/checkout', label: 'Checkout Page Slideshow', permission: 'cms:write' },
        { to: '/admin/cms/banners', label: 'Banner Creator', permission: 'cms:write' },
        { to: '/admin/marketing/campaigns', label: 'Promotional Campaigns' },
        { to: '/admin/marketing/ads', label: 'Advertisements' },
        { to: '/admin/marketing/popups', label: 'Promotional Popups' },
        { to: '/admin/cms/hero', label: 'Legacy Hero Slides', permission: 'cms:write' },
        { to: '/admin/cms/cart-banners', label: 'Legacy Cart Banners', permission: 'cms:write' },
        { to: '/admin/cms/checkout-banner', label: 'Legacy Checkout Banner', permission: 'cms:write' },
        { to: '/admin/cms/wishlist-slides', label: 'Legacy Wishlist Slides', permission: 'cms:write' },
      ],
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      permission: 'reports:read',
      children: [
        { to: '/admin/reports/sales', label: 'Sales Analytics' },
        { to: '/admin/reports/revenue', label: 'Revenue & Tax' },
        { to: '/admin/reports/products', label: 'Product Performance' },
        { to: '/admin/reports/customers', label: 'Customer Insights' },
        { to: '/admin/reports/inventory', label: 'Inventory Valuation' },
      ],
    },
    {
      id: 'content',
      label: 'Content Manager',
      icon: FileText,
      permission: 'cms:write',
      children: [
        { to: '/admin/cms/homepage', label: 'Homepage Sections' },
        { to: '/admin/cms/pages', label: 'Static Pages' },
        { to: '/admin/cms/faqs', label: 'FAQs Manager' },
        { to: '/admin/cms/blog', label: 'Blog Posts' },
        { to: '/admin/cms/navigation', label: 'Navigation & Mega Menu' },
        { to: '/admin/cms/navigation/slides', label: 'Mega Menu Slides' },
        { to: '/admin/cms/footer', label: 'Footer Management' },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      permission: 'settings:write',
      children: [
        { to: '/admin/settings', label: 'General & Policies' },
        { to: '/admin/settings/search', label: 'Search Settings' },
        { to: '/admin/website/header', label: 'Header & Announcement' },
        { to: '/admin/website/footer', label: 'Footer & Copyright' },
        { to: '/admin/settings/shipping-tax', label: 'Shipping & Tax' },
        { to: '/admin/payments/methods', label: 'Payment Methods' },
        { to: '/admin/payments', label: 'Payment Transactions' },
        { to: '/admin/settings/email', label: 'Email & Alerts' },
        { to: '/admin/settings/seo', label: 'SEO & Sitemap' },
        { to: '/admin/settings/security', label: 'Security Settings' },
      ],
    },
  ];

  const systemMenuGroups: SidebarGroupItem[] = [
    {
      id: 'users_roles',
      label: 'Users & Roles',
      icon: UserCheck,
      permission: 'staff:manage',
      children: [
        { to: '/admin/staff', label: 'Staff Accounts' },
        { to: '/admin/roles', label: 'RBAC Permissions' },
      ],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: CreditCard,
      permission: 'payments:read',
      to: '/admin/payments',
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: Wrench,
      permission: 'dashboard:view',
      children: [
        { to: '/admin/tools/health', label: 'System & DB Health' },
        { to: '/admin/tools/audit-logs', label: 'Audit & Activity Logs', permission: 'audit:read' },
      ],
    },
    {
      id: 'support',
      label: 'Support',
      icon: LifeBuoy,
      permission: 'support:manage',
      children: [
        { to: '/admin/support', label: 'Support Tickets' },
        { to: '/admin/support/messages', label: 'Contact Enquiries' },
      ],
    },
  ];

  const isGroupActive = (group: SidebarGroupItem) => {
    if (group.to) return location.pathname === group.to;
    return Boolean(group.children?.some((c) => location.pathname === c.to));
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderGroup = (group: SidebarGroupItem) => {
    if (!hasEffectivePermission(user, group.permission)) return null;
    const Icon = group.icon;
    const visibleChildren = group.children?.filter(
      (c) => !c.permission || hasEffectivePermission(user, c.permission)
    );

    if (group.to && !visibleChildren?.length) {
      return (
        <NavLink
          key={group.id}
          to={group.to}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              isActive
                ? 'bg-[#16A34A] text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <span className="flex items-center gap-2.5 truncate">
            <Icon className="w-4 h-4 shrink-0 opacity-85" />
            <span className="truncate">{group.label}</span>
          </span>
        </NavLink>
      );
    }

    const active = isGroupActive(group);
    const expanded = expandedGroups[group.id] ?? active;

    return (
      <div key={group.id} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={expanded}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
            active
              ? 'bg-white/10 text-white font-semibold'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5 truncate">
            <Icon className="w-4 h-4 shrink-0 opacity-85" />
            <span className="truncate">{group.label}</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {Boolean(group.badgeCount && group.badgeCount > 0) && (
              <span className="min-w-5 h-4 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {group.badgeCount! > 99 ? '99+' : group.badgeCount}
              </span>
            )}
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </span>
        </button>

        {expanded && visibleChildren && (
          <div className="pl-7 pr-1 py-1 space-y-0.5 border-l border-white/10 ml-4">
            {visibleChildren.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `block px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-[#16A34A] text-white font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  const roleLabel = ROLE_METADATA[user.role]?.label || user.role.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex">
      <SeoHead title="Admin Panel — NOVARA COMMERCE" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Navy Gradient Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#0D1B2E] to-[#081220] text-slate-200 flex flex-col transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-white/10">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#15803D] text-white flex items-center justify-center shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-extrabold text-white tracking-tight leading-none">
                ShopVista
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                NOVARA Admin v2.0
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          <div>
            <NavLink
              to="/admin"
              end
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#16A34A] text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </NavLink>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Main Menu
            </p>
            <div className="space-y-0.5">{mainMenuGroups.map(renderGroup)}</div>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              System
            </p>
            <div className="space-y-0.5">{systemMenuGroups.map(renderGroup)}</div>
          </div>
        </nav>

        {/* Bottom Store Operations Health Card & Admin Footer */}
        <div className="p-3 space-y-2.5 border-t border-white/10 bg-[#081220]/90">
          <div className="rounded-xl bg-gradient-to-br from-[#0F2A36] to-[#0B1F2C] border border-emerald-500/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#16A34A]/20 text-[#22C55E] flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">System Diagnostics</p>
                <p className="text-[10px] text-slate-400 truncate">MongoDB, Auth & API Status</p>
              </div>
            </div>
            <Link
              to="/admin/tools/health"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:brightness-110 text-slate-950 text-[11px] font-extrabold transition-all"
            >
              <span>Inspect Health</span>
              <span>→</span>
            </Link>
          </div>

          <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {user.avatarUrl ? (
                  <SafeImage
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    {getUserInitials(user.name)}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#081220]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-between gap-2 w-full min-w-0 max-w-md h-10 px-3 sm:px-3.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200/70 text-slate-500 text-xs transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate hidden sm:inline">Search anything... (Ctrl + K)</span>
                <span className="truncate sm:hidden">Search...</span>
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-slate-400 border border-slate-200 shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:brightness-105 text-white text-xs font-bold shadow-xs"
            >
              <span className="hidden sm:inline">Live Store</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            {canReadOrders && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Admin notifications"
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    const next = !notificationsOpen;
                    setNotificationsOpen(next);
                    if (next) loadNotifications();
                  }}
                  className="relative w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setNotificationsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">
                          Notifications ({unreadCount} unread)
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[11px] font-semibold text-[#16A34A] hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <p className="p-6 text-center text-xs text-slate-500">
                            No notifications yet.
                          </p>
                        ) : (
                          notifications.map((item) => (
                            <button
                              key={item._id}
                              type="button"
                              onClick={() => void handleMarkRead(item)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                                item.isRead ? 'bg-white' : 'bg-emerald-50/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900">{item.title}</span>
                                {!item.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {item.message}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="hidden sm:flex w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 items-center justify-center transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors text-left"
              >
                {user.avatarUrl ? (
                  <SafeImage
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                    {getUserInitials(user.name)}
                  </div>
                )}
                <div className="hidden md:block">
                  <p className="text-xs font-bold text-slate-900 leading-tight max-w-[110px] truncate">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">{roleLabel}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 py-2 text-xs">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/account/settings"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      Account Settings
                    </Link>
                    <Link
                      to="/admin/settings"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      Store Settings
                    </Link>
                    <Link
                      to="/"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      Live Storefront
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 font-semibold border-t border-slate-100 mt-1"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1520px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
