import { useEffect, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks.ts';
import { Modal } from '../../components/ui/Modal.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest, downloadCsvRequest, formatBdt } from '../../lib/api.ts';

interface TxRecord {
  _id: string;
  orderId: string;
  orderNumber: string;
  provider: string;
  transactionRef: string;
  bankTranId?: string;
  storeAmount?: number;
  riskLevel?: number;
  amount: number;
  status: string;
  channel?: string;
  createdAt: string;
}

interface RefundRecord {
  _id: string;
  orderNumber: string;
  amount: number;
  method: string;
  refundMode?: 'gateway_api' | 'manual_offline';
  reference: string;
  bankTranId?: string;
  refundRefId?: string;
  providerStatus?: string;
  failureReason?: string;
  status?: 'pending' | 'processed' | 'failed' | 'rejected';
  reason: string;
  createdAt: string;
}

interface ReportsData {
  ordersByStatus: Array<{ _id: string; count: number; total: number }>;
  paymentSummary: Array<{ _id: string; count: number; total: number }>;
  refundSummary?: Array<{ _id: string; count: number; total: number }>;
}

interface GatewayStatusSummary {
  sslcommerzConfigured: boolean;
  codEnabled: boolean;
  mode?: 'sandbox' | 'live';
  sandbox?: boolean;
  reservationTtlMinutes?: number;
}

export function AdminPaymentsReportsPage() {
  const dispatch = useAppDispatch();
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusSummary | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);

  const [refundTarget, setRefundTarget] = useState<TxRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState('SSLCommerz / Bank Refund');
  const [refundReason, setRefundReason] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [mutatingRefundId, setMutatingRefundId] = useState<string | null>(null);

  const loadData = () => {
    Promise.all([
      apiRequest<{
        transactions: TxRecord[];
        refunds: RefundRecord[];
        gatewayStatus: GatewayStatusSummary;
      }>('/api/payments/admin/transactions'),
      apiRequest<ReportsData>('/api/support/admin/reports'),
    ])
      .then(([txRes, repRes]) => {
        setTransactions(txRes.transactions);
        setRefunds(txRes.refunds);
        setGatewayStatus(txRes.gatewayStatus);
        setReports(repRes);
      })
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Failed to load payment reports.',
          })
        );
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIssueRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setIssuing(true);
    try {
      const res = await apiRequest<{ refund: RefundRecord }>('/api/payments/admin/refunds', {
        method: 'POST',
        body: JSON.stringify({
          orderId: refundTarget.orderId,
          amount: Number(refundAmount),
          method: refundMethod,
          reason: refundReason,
          manualOverride,
        }),
      });
      setRefundTarget(null);
      dispatch(
        pushToast({
          variant: res.refund.status === 'failed' ? 'error' : 'success',
          message:
            res.refund.status === 'processed'
              ? 'Gateway refund processed and logged.'
              : res.refund.status === 'pending'
                ? 'Refund queued as pending settlement.'
                : res.refund.failureReason || 'Gateway refund failed.',
        })
      );
      loadData();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Refund failed.',
        })
      );
    } finally {
      setIssuing(false);
    }
  };

  const handleRefundAction = async (id: string, action: 'complete' | 'reject' | 'retry') => {
    setMutatingRefundId(id);
    try {
      const res = await apiRequest<{ refund: RefundRecord }>(`/api/payments/admin/refunds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      dispatch(
        pushToast({
          variant: 'success',
          message: `Refund updated to ${res.refund.status}.`,
        })
      );
      loadData();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Refund update failed.',
        })
      );
    } finally {
      setMutatingRefundId(null);
    }
  };

  const handleSyncRefund = async (id: string) => {
    setMutatingRefundId(id);
    try {
      const res = await apiRequest<{ refund: RefundRecord }>(`/api/payments/admin/refunds/${id}/sync`, {
        method: 'POST',
      });
      dispatch(
        pushToast({
          variant: 'info',
          message: `Gateway status synced: ${res.refund.providerStatus || res.refund.status}.`,
        })
      );
      loadData();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to sync refund status.',
        })
      );
    } finally {
      setMutatingRefundId(null);
    }
  };

  const handleDownloadOrdersCsv = async () => {
    try {
      await downloadCsvRequest('/api/support/admin/reports/orders.csv', 'novara-orders-report.csv');
      dispatch(pushToast({ variant: 'success', message: 'Orders CSV report downloaded.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Export failed.',
        })
      );
    }
  };

  const gatewayModeLabel =
    gatewayStatus?.mode?.toUpperCase() || (gatewayStatus?.sandbox === false ? 'LIVE' : 'SANDBOX');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`px-3 py-1.5 rounded-lg font-semibold ${
              gatewayStatus?.codEnabled
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Cash on Delivery: {gatewayStatus?.codEnabled ? 'Active' : 'Disabled'}
          </span>
          <span
            className={`px-3 py-1.5 rounded-lg font-semibold ${
              gatewayStatus?.sslcommerzConfigured
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            SSLCommerz ({gatewayModeLabel}):{' '}
            {gatewayStatus?.sslcommerzConfigured
              ? 'Credentials Configured'
              : 'Env Credentials Not Set'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDownloadOrdersCsv}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          <Download className="w-4 h-4" /> Export Orders CSV Report
        </button>
      </div>

      {/* Order & Payment Summaries */}
      {reports && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Sales Breakdown by Order Status
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {reports.ordersByStatus.map((row) => (
                <div key={row._id} className="py-2 flex items-center justify-between">
                  <span className="uppercase font-semibold text-slate-700">
                    {row._id.replace(/_/g, ' ')} ({row.count})
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatBdt(row.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Payment Reconciliation Summary
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {reports.paymentSummary.map((row) => (
                <div key={row._id} className="py-2 flex items-center justify-between">
                  <span className="uppercase font-semibold text-slate-700">
                    {row._id} ({row.count})
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatBdt(row.total)}
                  </span>
                </div>
              ))}
              {reports.refundSummary && reports.refundSummary.length > 0 && (
                <div className="pt-2.5 mt-1 border-t border-slate-200 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Refund Summary</p>
                  {reports.refundSummary.map((rf) => (
                    <div key={`rf-${rf._id}`} className="flex items-center justify-between text-slate-600">
                      <span className="uppercase font-semibold">
                        Refund {rf._id} ({rf.count})
                      </span>
                      <span className="font-mono font-bold text-red-700">{formatBdt(rf.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900">Payment Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Order #</th>
                <th className="text-left px-4 py-2.5 font-semibold">Reference</th>
                <th className="text-left px-4 py-2.5 font-semibold">Provider / Channel</th>
                <th className="text-center px-4 py-2.5 font-semibold">Status</th>
                <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
                <th className="text-right px-4 py-2.5 font-semibold">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx._id}>
                  <td className="px-4 py-2.5 font-mono font-bold">{tx.orderNumber}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    <div>{tx.transactionRef}</div>
                    {tx.bankTranId && (
                      <div className="text-[10px] text-slate-400">Bank: {tx.bankTranId}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 uppercase">
                    {tx.provider} {tx.channel ? `· ${tx.channel}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-center uppercase font-bold">{tx.status}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {formatBdt(tx.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {tx.status === 'verified' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRefundTarget(tx);
                          setRefundAmount(tx.amount);
                          setRefundMethod(
                            tx.provider === 'sslcommerz' ? 'SSLCommerz Gateway Refund' : 'Bank / bKash Refund'
                          );
                          setManualOverride(tx.provider !== 'sslcommerz');
                          setRefundReason('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                      >
                        <RotateCcw className="w-3 h-3" /> Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund History */}
      {refunds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Refund Ledger ({refunds.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {refunds.map((rf) => {
              const status = rf.status || 'processed';
              const badgeClass =
                status === 'processed'
                  ? 'bg-emerald-50 text-emerald-700'
                  : status === 'pending'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700';
              return (
                <div
                  key={rf._id}
                  className="text-xs flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-mono text-slate-900">{rf.reference}</strong>
                      <span className="text-slate-500">({rf.orderNumber})</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}`}>
                        {status}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase">
                        {rf.refundMode === 'gateway_api' ? 'Gateway API' : 'Manual Offline'}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {rf.reason}
                      {rf.refundRefId ? ` · GW Ref: ${rf.refundRefId}` : ''}
                      {rf.providerStatus ? ` · Provider: ${rf.providerStatus}` : ''}
                    </p>
                    {rf.failureReason && (
                      <p className="text-[11px] text-red-600">{rf.failureReason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-red-700">-{formatBdt(rf.amount)}</span>
                    {status === 'pending' && rf.refundMode !== 'gateway_api' && (
                      <button
                        type="button"
                        disabled={mutatingRefundId === rf._id}
                        onClick={() => handleRefundAction(rf._id, 'complete')}
                        className="px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Mark Settled
                      </button>
                    )}
                    {status === 'pending' && rf.refundMode === 'gateway_api' && rf.refundRefId && (
                      <button
                        type="button"
                        disabled={mutatingRefundId === rf._id}
                        onClick={() => handleSyncRefund(rf._id)}
                        className="px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50"
                      >
                        Sync Status
                      </button>
                    )}
                    {status === 'failed' && rf.refundMode === 'gateway_api' && rf.bankTranId && (
                      <button
                        type="button"
                        disabled={mutatingRefundId === rf._id}
                        onClick={() => handleRefundAction(rf._id, 'retry')}
                        className="px-2.5 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100 disabled:opacity-50"
                      >
                        Retry Gateway
                      </button>
                    )}
                    {(status === 'pending' || status === 'failed') && (
                      <button
                        type="button"
                        disabled={mutatingRefundId === rf._id}
                        onClick={() => handleRefundAction(rf._id, 'reject')}
                        className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title={`Process Refund — ${refundTarget?.orderNumber || ''}`}
      >
        {refundTarget && (
          <form onSubmit={handleIssueRefund} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Refund Amount (BDT, max {formatBdt(refundTarget.amount)})
              </label>
              <input
                type="number"
                required
                min={1}
                max={refundTarget.amount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Refund Method
              </label>
              <input
                type="text"
                required
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
              <input
                type="text"
                required
                minLength={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            {refundTarget.provider === 'sslcommerz' && (
              <label className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={manualOverride}
                  onChange={(e) => setManualOverride(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong>Manual offline settlement</strong> — Queue as <span className="font-mono">pending</span> for manual bKash/bank transfer instead of calling SSLCommerz Refund API
                  {!refundTarget.bankTranId ? ' (required when bank_tran_id is missing)' : ''}.
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={issuing}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {issuing ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
