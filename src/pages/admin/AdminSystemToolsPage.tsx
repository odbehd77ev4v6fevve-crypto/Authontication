import { useEffect, useState } from 'react';
import { Activity, Database, FileClock, LifeBuoy, Mail, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks.ts';
import { Modal } from '../../components/ui/Modal.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { SystemHealthPayload } from '../../types/domain.ts';

interface AuditLogRecord {
  _id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

interface SupportEnquiryRecord {
  _id: string;
  ticketNumber: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  orderNumber?: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  internalNotes?: Array<{ note: string; actorName: string; createdAt: string }>;
  createdAt: string;
}

export type SystemToolsTab = 'health' | 'audit-logs' | 'support' | 'messages';

export function AdminSystemToolsPage({ initialTab = 'health' }: { initialTab?: SystemToolsTab }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<SystemToolsTab>(initialTab);

  const [health, setHealth] = useState<SystemHealthPayload | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [logQuery, setLogQuery] = useState('');
  const [enquiries, setEnquiries] = useState<SupportEnquiryRecord[]>([]);

  const [replyTarget, setReplyTarget] = useState<SupportEnquiryRecord | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<'in_progress' | 'resolved' | 'closed'>('resolved');
  const [sendingReply, setSendingReply] = useState(false);
  const [showAllEnquiries, setShowAllEnquiries] = useState(false);

  useEffect(() => {
    setTab(initialTab);
    setShowAllEnquiries(false);
  }, [initialTab]);

  const loadHealth = () => {
    apiRequest<SystemHealthPayload>('/api/support/admin/system-health')
      .then((res) => setHealth(res))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Failed to load system health.',
          })
        );
      });
  };

  const loadLogs = () => {
    const params = new URLSearchParams();
    if (logQuery.trim()) params.set('q', logQuery.trim());
    apiRequest<{ logs: AuditLogRecord[] }>(`/api/support/admin/audit-logs?${params.toString()}`)
      .then((res) => setLogs(res.logs || []))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Failed to load audit logs.',
          })
        );
      });
  };

  const loadEnquiries = () => {
    apiRequest<{ enquiries: SupportEnquiryRecord[] }>('/api/support/admin/enquiries')
      .then((res) => setEnquiries(res.enquiries || []))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Failed to load enquiries.',
          })
        );
      });
  };

  useEffect(() => {
    if (tab === 'health') loadHealth();
    else if (tab === 'audit-logs') loadLogs();
    else loadEnquiries();
  }, [tab]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget) return;
    setSendingReply(true);
    try {
      const res = await apiRequest<{ emailStatus: string }>(
        `/api/support/admin/enquiries/${replyTarget._id}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({
            replyMessage: replyMessage.trim(),
            status: replyStatus,
          }),
        }
      );
      setReplyTarget(null);
      setReplyMessage('');
      dispatch(
        pushToast({
          variant: 'success',
          message:
            res.emailStatus === 'sent'
              ? 'Reply emailed to customer & ticket updated.'
              : 'Reply logged to ticket history (Resend unconfigured in .env).',
        })
      );
      loadEnquiries();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to reply.',
        })
      );
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['health', 'System & DB Health', Activity],
            ['audit-logs', 'Audit Logs', FileClock],
            ['support', 'Support Tickets', LifeBuoy],
            ['messages', 'Contact Messages', Mail],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
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

      {tab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-slate-900">Server, Database &amp; Integration Diagnostics</h1>
            <button
              type="button"
              onClick={loadHealth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {health ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">MongoDB Atlas</span>
                  <Database className="w-4 h-4 text-[#16A34A]" />
                </div>
                <p className="text-lg font-extrabold text-slate-900 capitalize">
                  {health.database.state}
                </p>
                <p className="text-xs text-slate-500">
                  Runtime status:{' '}
                  <strong className={health.database.connected ? 'text-emerald-700' : 'text-amber-700'}>
                    {health.status.toUpperCase()}
                  </strong>
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Node Process</span>
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-lg font-extrabold font-mono text-slate-900">
                  {health.nodeVersion} · {health.uptimeSeconds}s uptime
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  RSS {health.memory.rssMb} MB · Heap {health.memory.heapUsedMb}/{health.memory.heapTotalMb} MB
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Integrations</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    ['JWT Secret', health.integrations.jwtConfigured],
                    ['Cloudinary', health.integrations.cloudinaryConfigured],
                    ['Resend Email', health.integrations.resendConfigured],
                    ['Payment GW', health.integrations.paymentConfigured],
                    ['Google OAuth', health.integrations.googleOAuthConfigured],
                    ['Facebook OAuth', health.integrations.facebookOAuthConfigured],
                  ].map(([name, ok]) => (
                    <div key={String(name)} className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                      <span className="text-slate-600">{name}</span>
                      <span className={ok ? 'text-emerald-700 font-bold' : 'text-amber-600 font-bold'}>
                        {ok ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          )}
        </div>
      )}

      {tab === 'audit-logs' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadLogs();
            }}
            className="flex items-center gap-2 max-w-md"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="Filter by actor email, action, resource..."
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs"
              />
            </div>
            <button type="submit" className="h-9 px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold">
              Filter
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Timestamp</th>
                    <th className="text-left px-4 py-3 font-semibold">Actor</th>
                    <th className="text-left px-4 py-3 font-semibold">Action</th>
                    <th className="text-left px-4 py-3 font-semibold">Resource</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No audit log events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l._id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900">{l.actorEmail}</span>{' '}
                          <span className="text-[10px] uppercase text-slate-400">({l.actorRole})</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">{l.action}</td>
                        <td className="px-4 py-2.5 text-slate-600">{l.resourceType}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(tab === 'support' || tab === 'messages') && (() => {
        const orderTickets = enquiries.filter((e) => Boolean(e.orderNumber?.trim()));
        const contactMessages = enquiries.filter((e) => !e.orderNumber?.trim());
        const visibleEnquiries = showAllEnquiries
          ? enquiries
          : tab === 'support'
            ? orderTickets
            : contactMessages;

        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="text-slate-600 font-semibold">
                {showAllEnquiries
                  ? `Showing all enquiries (${enquiries.length})`
                  : tab === 'support'
                    ? `Order-Linked Support Tickets (${orderTickets.length})`
                    : `General Contact Messages (${contactMessages.length})`}
              </p>
              <button
                type="button"
                onClick={() => setShowAllEnquiries((v) => !v)}
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                {showAllEnquiries
                  ? tab === 'support'
                    ? `Filter Order Tickets (${orderTickets.length})`
                    : `Filter Contact Messages (${contactMessages.length})`
                  : `Show All (${enquiries.length})`}
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Ticket #</th>
                      <th className="text-left px-4 py-3 font-semibold">Sender</th>
                      <th className="text-left px-4 py-3 font-semibold">Subject &amp; Message</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                      <th className="text-right px-4 py-3 font-semibold">Respond</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleEnquiries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          {tab === 'support' && !showAllEnquiries
                            ? 'No order-linked support tickets yet.'
                            : tab === 'messages' && !showAllEnquiries
                              ? 'No general contact messages yet.'
                              : 'No customer support tickets or contact enquiries yet.'}
                        </td>
                      </tr>
                    ) : (
                      visibleEnquiries.map((enq) => (
                        <tr key={enq._id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {enq.ticketNumber}
                            {enq.orderNumber && (
                              <span className="block text-[10px] text-emerald-700">
                                Order: {enq.orderNumber}
                              </span>
                            )}
                            <p className="text-[10px] font-sans font-normal text-slate-400">
                              {new Date(enq.createdAt).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{enq.name}</p>
                            <p className="text-slate-500">{enq.email}</p>
                          </td>
                          <td className="px-4 py-3 max-w-md">
                            <p className="font-bold text-slate-800">{enq.subject}</p>
                            <p className="text-slate-600 line-clamp-2 mt-0.5">{enq.message}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                enq.status === 'resolved' || enq.status === 'closed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {enq.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTarget(enq);
                                setReplyMessage('');
                                setReplyStatus('resolved');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                            >
                              <Send className="w-3 h-3" /> Reply
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      <Modal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        title={`Reply to ${replyTarget?.ticketNumber || ''}`}
        description={replyTarget ? `${replyTarget.name} <${replyTarget.email}>` : undefined}
      >
        {replyTarget && (
          <form onSubmit={handleSendReply} className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
              <p className="font-bold text-slate-900">{replyTarget.subject}</p>
              <p className="text-slate-600 whitespace-pre-wrap">{replyTarget.message}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Status</label>
              <select
                value={replyStatus}
                onChange={(e) =>
                  setReplyStatus(e.target.value as 'in_progress' | 'resolved' | 'closed')
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
              >
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reply Message *
              </label>
              <textarea
                rows={4}
                required
                minLength={5}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Write your helpful response to the customer..."
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingReply}
                className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold disabled:opacity-60"
              >
                {sendingReply ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
