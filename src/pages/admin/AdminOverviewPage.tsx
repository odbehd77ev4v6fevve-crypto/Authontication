import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Database,
  Gift,
  Lock,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelativeTime, type DashboardRange } from '../../../shared/adminAnalytics.ts';
import { hasPermission } from '../../../shared/rbac.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import {
  MiniSparkline,
  OrdersStatusDonutChart,
  SalesOverviewChart,
} from '../../components/admin/AdminCharts.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { ApiError, apiRequest, formatBdt } from '../../lib/api.ts';
import type { AdminDashboardPayload } from '../../types/domain.ts';

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'processing':
    case 'packed':
    case 'shipped':
    case 'confirmed':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'return_requested':
    case 'refund_pending':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'cancelled':
    case 'refunded':
    case 'payment_failed':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function AdminOverviewPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [range, setRange] = useState<DashboardRange>('30D');
  const [data, setData] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000 * 30);
    return () => window.clearInterval(id);
  }, []);

  const loadDashboard = (targetRange: DashboardRange = range) => {
    setLoading(true);
    setDbError(null);
    apiRequest<AdminDashboardPayload>(`/api/support/admin/dashboard?range=${targetRange}`)
      .then((res) => setData(res))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 503) {
          setDbError(err.message || 'MongoDB database is not connected.');
        } else {
          setDbError(err instanceof Error ? err.message : 'Unable to load dashboard KPIs.');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard(range);
  }, [range]);

  const handleSeedCatalog = async () => {
    setSeeding(true);
    try {
      const res = await apiRequest<{
        productsCreated?: number;
        categoriesCreated?: number;
        brandsCreated?: number;
        skipped?: boolean;
      }>('/api/support/admin/seed-catalog', {
        method: 'POST',
      });
      setSeedConfirmOpen(false);
      const count = res.productsCreated ?? 0;
      dispatch(
        pushToast({
          variant: 'success',
          message: res.skipped
            ? 'Catalog already contains products; seed skipped.'
            : `Bangladesh catalog seeded (${count} products, ${res.categoriesCreated ?? 0} categories, ${res.brandsCreated ?? 0} brands written to MongoDB).`,
        })
      );
      loadDashboard(range);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Catalog seed failed.',
        })
      );
    } finally {
      setSeeding(false);
    }
  };

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const m = data?.metrics;
  const sparkRevenue = data?.salesOverview?.points.slice(-8).map((p) => p.revenue) || [0, 0];
  const sparkOrders = data?.salesOverview?.points.slice(-8).map((p) => p.orders) || [0, 0];

  return (
    <div className="space-y-5">
      {/* Dark-Green Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#062E1B] via-[#0F4D2A] to-[#126234] text-white p-5 sm:p-6 shadow-md">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-right"
          style={{
            backgroundImage: `url(/src/assets/images/promo_tech_laptops_1795621230990.jpg)`,
          }}
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
                <span>Welcome Back, {user?.name || 'Admin'}!</span>
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90">
                Here&apos;s what&apos;s happening with your NOVARA COMMERCE storefront today.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-emerald-50 border border-white/10">
                <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                <span>{formattedDate}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-emerald-50 border border-white/10 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-emerald-300" />
                <span>{formattedTime}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => loadDashboard(range)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/15 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            {user && hasPermission(user.role, 'settings:write') && (
              <button
                type="button"
                onClick={() => setSeedConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#22C55E] hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-xs transition-colors"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Seed Catalog</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {dbError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Live Database Notice:</strong> {dbError} Real metrics appear automatically once MongoDB is connected.
            </span>
          </div>
          <Link
            to="/admin/tools/health"
            className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-semibold"
          >
            Check System Health
          </Link>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiMetricCard
          title="Total Sales"
          value={m ? formatBdt(m.netSales) : '—'}
          growth={m?.salesGrowthPercent ?? null}
          icon={ShoppingBag}
          tone="emerald"
          sparkValues={sparkRevenue}
          loading={loading}
        />
        <KpiMetricCard
          title="Total Orders"
          value={m ? m.orderCount.toLocaleString('en-US') : '—'}
          growth={m?.ordersGrowthPercent ?? null}
          icon={ShoppingCart}
          tone="blue"
          sparkValues={sparkOrders}
          loading={loading}
        />
        <KpiMetricCard
          title="Total Customers"
          value={m ? m.totalCustomers.toLocaleString('en-US') : '—'}
          growth={m?.customersGrowthPercent ?? null}
          icon={Users}
          tone="purple"
          sparkValues={
            m?.customerSparkValues?.length
              ? m.customerSparkValues
              : [Math.max(0, (m?.totalCustomers || 0) - (m?.newCustomersCurrent || 0)), m?.totalCustomers || 0]
          }
          loading={loading}
        />
        <KpiMetricCard
          title="Total Products"
          value={m ? m.totalProducts.toLocaleString('en-US') : '—'}
          subtitle={m ? `${m.activeProducts} published` : undefined}
          growth={null}
          icon={Package}
          tone="amber"
          sparkValues={[m?.activeProducts || 0, m?.totalProducts || 0]}
          loading={loading}
        />
      </section>

      {/* Sales Overview + Recent Orders */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#16A34A]" />
                <h2 className="text-sm font-extrabold text-slate-900">Sales Overview</h2>
              </div>
              <div className="flex flex-wrap items-baseline gap-2.5 mt-1.5">
                <span className="text-2xl font-extrabold font-mono text-slate-900">
                  {data ? formatBdt(data.salesOverview.totalRevenue) : '—'}
                </span>
                {data?.salesOverview.growthPercent !== null &&
                  data?.salesOverview.growthPercent !== undefined && (
                    <span
                      className={`text-xs font-bold ${
                        data.salesOverview.growthPercent >= 0 ? 'text-[#16A34A]' : 'text-red-600'
                      }`}
                    >
                      {data.salesOverview.growthPercent >= 0 ? '↑' : '↓'}{' '}
                      {Math.abs(data.salesOverview.growthPercent)}% vs previous period
                    </span>
                  )}
              </div>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
              {(['7D', '30D', '3M', '1Y'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    range === r
                      ? 'bg-[#16A34A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <SalesOverviewChart points={data?.salesOverview.points || []} />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#16A34A]" />
              <h2 className="text-sm font-extrabold text-slate-900">Recent Orders</h2>
            </div>
            <Link
              to="/admin/orders"
              className="text-xs font-bold text-[#16A34A] hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="text-left py-2 font-semibold">#Order</th>
                  <th className="text-left py-2 font-semibold">Customer</th>
                  <th className="text-right py-2 font-semibold">Amount</th>
                  <th className="text-center py-2 font-semibold">Status</th>
                  <th className="text-right py-2 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!data?.recentOrders?.length ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.recentOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <Link to="/admin/orders" className="hover:text-[#16A34A]">
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {order.customerName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700 truncate max-w-[110px]">
                            {order.customerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatBdt(order.totalAmount)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${statusBadgeClass(
                            order.orderStatus
                          )}`}
                        >
                          {order.orderStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(order.createdAt, now)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Middle 4-Panel Row: Top Products | Orders Donut | Latest Customers | Special Offer & Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
        {/* Top Selling Products */}
        <div className="xl:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">Top Selling Products</h2>
            <Link to="/admin/products" className="text-xs font-bold text-[#16A34A] hover:underline">
              View All →
            </Link>
          </div>

          {!data?.topSellingProducts?.length ? (
            <p className="text-xs text-slate-400 py-8 text-center">No product sales recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {data.topSellingProducts.slice(0, 4).map((prod, idx) => (
                <div key={prod.productId} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <SafeImage
                    src={prod.imageUrl}
                    alt={prod.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0 bg-slate-50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                        {prod.unitsSold.toLocaleString()} sold
                      </span>
                    </div>
                    <p className="text-[11px] font-mono font-bold text-[#16A34A]">
                      {formatBdt(prod.price)}
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#16A34A]"
                        style={{ width: `${prod.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders by Status Donut */}
        <div className="xl:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900">Orders by Status</h2>
          <OrdersStatusDonutChart
            totalOrders={data?.orderStatusBreakdown.totalOrders ?? 0}
            breakdown={
              data?.orderStatusBreakdown.breakdown ?? [
                { key: 'delivered', label: 'Delivered', count: 0, percentage: 0, color: '#16A34A' },
                { key: 'processing', label: 'Processing', count: 0, percentage: 0, color: '#2563EB' },
                { key: 'pending', label: 'Pending', count: 0, percentage: 0, color: '#F59E0B' },
                { key: 'cancelled', label: 'Cancelled', count: 0, percentage: 0, color: '#EF4444' },
              ]
            }
          />
        </div>

        {/* Latest Customers */}
        <div className="xl:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">Latest Customers</h2>
            <Link to="/admin/customers" className="text-xs font-bold text-[#16A34A] hover:underline">
              View All →
            </Link>
          </div>

          {!data?.latestCustomers?.length ? (
            <p className="text-xs text-slate-400 py-8 text-center">No customer registrations yet.</p>
          ) : (
            <div className="space-y-3">
              {data.latestCustomers.slice(0, 4).map((c) => (
                <div key={c._id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.avatarUrl ? (
                      <SafeImage
                        src={c.avatarUrl}
                        alt={c.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.emailVerified
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {c.emailVerified ? 'Verified' : 'Pending'}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {formatRelativeTime(c.createdAt, now)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Stack: Special Offer + Quick Actions */}
        <div className="xl:col-span-3 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#062E1B] via-[#0E5129] to-[#17703A] text-white p-5 shadow-md space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-emerald-100">
                  {data?.specialOffer?.title || 'Special Offer'}
                </span>
              </div>
              {data?.specialOffer?.code && (
                <span className="px-2 py-0.5 rounded bg-white/15 font-mono text-[10px] font-bold">
                  {data.specialOffer.code}
                </span>
              )}
            </div>

            <div>
              <p className="text-2xl font-black tracking-tight text-amber-300">
                {data?.specialOffer?.highlight || 'No Active Offer'}
              </p>
              <p className="text-xs text-emerald-100/85 mt-0.5 line-clamp-2">
                {data?.specialOffer?.subtitle || 'Launch a coupon or flash campaign to boost conversions.'}
              </p>
            </div>

            <Link
              to="/admin/marketing/offers"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-slate-900 hover:bg-emerald-50 text-xs font-bold transition-colors"
            >
              <span>Manage Offer</span>
              <span>→</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#16A34A]" />
              <h2 className="text-sm font-extrabold text-slate-900">Quick Actions</h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/admin/products/new"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] hover:bg-emerald-50 border border-slate-200/70 text-xs font-bold text-slate-800 transition-colors text-center"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Product</span>
              </Link>
              <Link
                to="/admin/orders/create"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] hover:bg-emerald-50 border border-slate-200/70 text-xs font-bold text-slate-800 transition-colors text-center"
              >
                <ShoppingCart className="w-4 h-4 text-sky-600" />
                <span>Create Order</span>
              </Link>
              <Link
                to="/admin/marketing/coupons"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] hover:bg-emerald-50 border border-slate-200/70 text-xs font-bold text-slate-800 transition-colors text-center"
              >
                <Tag className="w-4 h-4 text-[#16A34A]" />
                <span>Add Coupon</span>
              </Link>
              <Link
                to="/admin/reports/sales"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] hover:bg-emerald-50 border border-slate-200/70 text-xs font-bold text-slate-800 transition-colors text-center"
              >
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>View Reports</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Row: Recent Activities + Security Banner */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#16A34A]" />
              <h2 className="text-sm font-extrabold text-slate-900">Recent Activities</h2>
            </div>
            <Link
              to="/admin/tools/audit-logs"
              className="text-xs font-bold text-[#16A34A] hover:underline"
            >
              View All →
            </Link>
          </div>

          {!data?.recentAuditLogs?.length ? (
            <p className="text-xs text-slate-400 py-6 text-center">No administrative activity logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentAuditLogs.slice(0, 5).map((log) => (
                <div key={log._id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center shrink-0">
                      <UserPlus className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        <span className="font-mono text-[11px] text-[#16A34A]">{log.action}</span>{' '}
                        <span className="text-slate-500">on</span> {log.resourceType}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        by {log.actorEmail} ({log.actorRole.replace(/_/g, ' ')})
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {formatRelativeTime(log.createdAt, now)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#062E1B] via-[#0B4626] to-[#0D5B30] text-white p-6 shadow-md flex items-center justify-between gap-4 relative overflow-hidden">
          <div className="space-y-2.5 relative z-10 max-w-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#22C55E] text-slate-950 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-extrabold">
                {data?.securitySummary?.dbConnected
                  ? 'Your Store is Safe & Secure'
                  : 'System Check Required'}
              </h2>
            </div>

            <p className="text-xs text-emerald-100/90 leading-relaxed">
              {data?.securitySummary
                ? `Database: ${data.securitySummary.dbConnected ? 'Connected' : 'Disconnected'} · JWT Auth: ${
                    data.securitySummary.jwtConfigured ? 'Active' : 'Default'
                  } · Gateway Mode: ${data.securitySummary.paymentSandbox ? 'Sandbox' : 'Live'}`
                : 'Inspect live runtime security checks, database connectivity, and integration health.'}
            </p>

            <Link
              to="/admin/tools/health"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-colors"
            >
              <span>Security Details</span>
              <span>→</span>
            </Link>
          </div>

          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <Lock className="w-9 h-9 text-emerald-300" />
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={seedConfirmOpen}
        onClose={() => setSeedConfirmOpen(false)}
        onConfirm={handleSeedCatalog}
        title="Seed Bangladesh Store Catalog"
        message="This idempotent action writes sample categories, brands, products, welcome coupon NOVARA10, and CMS defaults into your MongoDB Atlas database without overwriting existing records."
        confirmLabel="Seed Catalog Now"
        loading={seeding}
      />
    </div>
  );
}

function KpiMetricCard({
  title,
  value,
  subtitle,
  growth,
  icon: Icon,
  tone,
  sparkValues,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  growth: number | null;
  icon: typeof ShoppingBag;
  tone: 'emerald' | 'blue' | 'purple' | 'amber';
  sparkValues: number[];
  loading: boolean;
}) {
  const palette = {
    emerald: {
      bg: 'bg-emerald-50 text-[#16A34A]',
      stroke: '#16A34A',
    },
    blue: {
      bg: 'bg-blue-50 text-blue-600',
      stroke: '#2563EB',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-600',
      stroke: '#9333EA',
    },
    amber: {
      bg: 'bg-amber-50 text-amber-600',
      stroke: '#D97706',
    },
  }[tone];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${palette.bg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 truncate">{title}</p>
            {loading ? (
              <div className="h-6 w-20 bg-slate-100 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-lg xl:text-[19px] font-extrabold font-mono text-slate-900 whitespace-nowrap leading-tight mt-0.5">
                {value}
              </p>
            )}
          </div>
        </div>
        <MiniSparkline values={sparkValues} color={palette.stroke} />
      </div>

      {!loading && (growth !== null || subtitle) && (
        <div className="flex items-center justify-between pl-[52px]">
          {growth !== null ? (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                growth >= 0 ? 'text-[#16A34A]' : 'text-red-600'
              }`}
            >
              {growth >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(growth)}% vs prev
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-[#16A34A]">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
