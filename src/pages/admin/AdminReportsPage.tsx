import { useEffect, useState } from 'react';
import { BarChart3, Download, Package, TrendingUp, Users, Warehouse } from 'lucide-react';
import type { DashboardRange } from '../../../shared/adminAnalytics.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { OrdersStatusDonutChart, SalesOverviewChart } from '../../components/admin/AdminCharts.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest, downloadCsvRequest, formatBdt } from '../../lib/api.ts';
import type { AdminAnalyticsPayload } from '../../types/domain.ts';

export type AdminReportTab = 'sales' | 'revenue' | 'products' | 'customers' | 'inventory';

export function AdminReportsPage({ initialTab = 'sales' }: { initialTab?: AdminReportTab }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<AdminReportTab>(initialTab);
  const [range, setRange] = useState<DashboardRange>('30D');
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setLoading(true);
    apiRequest<AdminAnalyticsPayload>(`/api/support/admin/analytics?range=${range}`)
      .then((res) => setData(res))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load analytics report.',
          })
        );
      })
      .finally(() => setLoading(false));
  }, [range, dispatch]);

  const handleExportCsv = async () => {
    try {
      await downloadCsvRequest(
        `/api/support/admin/reports/orders.csv?range=${encodeURIComponent(range)}`,
        `novara-analytics-${range.toLowerCase()}.csv`
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'CSV export failed.',
        })
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['sales', 'Sales Analytics', BarChart3],
              ['revenue', 'Revenue & Tax', TrendingUp],
              ['products', 'Product Performance', Package],
              ['customers', 'Customer Insights', Users],
              ['inventory', 'Inventory Valuation', Warehouse],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                tab === id
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-white border border-slate-200 p-0.5">
            {(['7D', '30D', '3M', '1Y'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  range === r ? 'bg-[#16A34A] text-white' : 'text-slate-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> Export Orders CSV
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      ) : (
        <>
          {(tab === 'sales' || tab === 'revenue') && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Net Revenue', formatBdt(data.revenue.netRevenue)],
                  ['Gross Sales', formatBdt(data.revenue.grossSales)],
                  ['Discounts Given', formatBdt(data.revenue.discountsGiven)],
                  ['Tax Collected', formatBdt(data.revenue.taxCollected)],
                  ['Shipping Collected', formatBdt(data.revenue.shippingCollected)],
                  ['Refunded Amount', formatBdt(data.revenue.refundedAmount)],
                  ['Total Orders', String(data.revenue.ordersCount)],
                  ['Avg Order Value', formatBdt(data.revenue.avgOrderValue)],
                ].map(([label, val]) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                    <p className="text-xl font-extrabold font-mono text-slate-900 mt-1">{val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Revenue Trend ({range})
                  </h2>
                  <SalesOverviewChart points={data.salesSeries.points} />
                </div>
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <h2 className="text-sm font-extrabold text-slate-900">Orders by Status</h2>
                  <OrdersStatusDonutChart
                    totalOrders={data.orderStatusBreakdown.totalOrders}
                    breakdown={data.orderStatusBreakdown.breakdown}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'products' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h2 className="text-sm font-extrabold text-slate-900">Top Performing Products ({range})</h2>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Product</th>
                    <th className="text-left px-4 py-3 font-semibold">SKU</th>
                    <th className="text-right px-4 py-3 font-semibold">Units Sold</th>
                    <th className="text-right px-4 py-3 font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No product sales recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    data.topProducts.map((p) => (
                      <tr key={p.productId}>
                        <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{p.sku}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{p.unitsSold}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                          {formatBdt(p.revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'customers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <p className="text-xs text-slate-500">Total Customers</p>
                  <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                    {data.customers.totalCustomers}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <p className="text-xs text-slate-500">New Signups ({range})</p>
                  <p className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">
                    {data.customers.newCustomersCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <p className="text-xs text-slate-500">Repeat Buyers ({range})</p>
                  <p className="text-2xl font-extrabold font-mono text-blue-700 mt-1">
                    {data.customers.repeatBuyersCount}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h2 className="text-sm font-extrabold text-slate-900">Highest Spending Customers</h2>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Customer</th>
                      <th className="text-left px-4 py-3 font-semibold">Email</th>
                      <th className="text-right px-4 py-3 font-semibold">Orders</th>
                      <th className="text-right px-4 py-3 font-semibold">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.customers.topSpenders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No customer spenders in this range yet.
                        </td>
                      </tr>
                    ) : (
                      data.customers.topSpenders.map((c) => (
                        <tr key={c._id}>
                          <td className="px-4 py-3 font-bold text-slate-900">{c.customerName}</td>
                          <td className="px-4 py-3 text-slate-500">{c.customerEmail}</td>
                          <td className="px-4 py-3 text-right font-mono">{c.ordersCount}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                            {formatBdt(c.totalSpent)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'inventory' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Total Catalog Items', String(data.inventory.totalProducts)],
                  ['Total Units on Hand', String(data.inventory.totalUnits)],
                  ['Retail Valuation', formatBdt(data.inventory.inventoryValuation)],
                  ['Cost Valuation', formatBdt(data.inventory.costValuation)],
                ].map(([label, val]) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-xl font-extrabold font-mono text-slate-900 mt-1">{val}</p>
                    {label === 'Cost Valuation' &&
                      typeof data.inventory.uncostedSkuCount === 'number' &&
                      data.inventory.uncostedSkuCount > 0 && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          {data.inventory.costedSkuCount ?? 0} costed · {data.inventory.uncostedSkuCount} SKUs missing costPrice
                        </p>
                      )}
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Low Stock &amp; Reorder Watchlist ({data.inventory.lowStockCount})
                  </h2>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Item</th>
                      <th className="text-left px-4 py-3 font-semibold">SKU</th>
                      <th className="text-right px-4 py-3 font-semibold">Available</th>
                      <th className="text-right px-4 py-3 font-semibold">Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.inventory.lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          All active SKUs are above low-stock thresholds.
                        </td>
                      </tr>
                    ) : (
                      data.inventory.lowStockItems.map((i) => (
                        <tr key={i.sku}>
                          <td className="px-4 py-3 font-bold text-slate-900">{i.name}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{i.sku}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                            {i.available}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">{i.threshold}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
