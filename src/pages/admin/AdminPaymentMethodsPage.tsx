import { useEffect, useState } from 'react';
import { CreditCard, Save, ShieldCheck } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { StoreSettings } from '../../types/domain.ts';

type PaymentMethodRow = NonNullable<StoreSettings['paymentMethods']>[number];

const DEFAULT_METHODS: PaymentMethodRow[] = [
  { key: 'cod', label: 'Cash on Delivery (COD)', enabled: true, displayOrder: 1, instructions: 'Pay cash at doorstep upon parcel inspection.', mode: 'live' },
  { key: 'bkash', label: 'bKash Mobile Wallet', enabled: true, displayOrder: 2, instructions: 'Pay securely via SSLCommerz bKash checkout.', mode: 'sandbox' },
  { key: 'nagad', label: 'Nagad Mobile Wallet', enabled: true, displayOrder: 3, instructions: 'Pay securely via SSLCommerz Nagad checkout.', mode: 'sandbox' },
  { key: 'card', label: 'Visa / Mastercard / Cards', enabled: true, displayOrder: 4, instructions: 'International and local debit/credit cards.', mode: 'sandbox' },
  { key: 'sslcommerz', label: 'SSLCommerz Gateway', enabled: true, displayOrder: 5, instructions: 'Unified Bangladesh payment gateway.', mode: 'sandbox' },
];

export function AdminPaymentMethodsPage() {
  const dispatch = useAppDispatch();
  const [methods, setMethods] = useState<PaymentMethodRow[]>(DEFAULT_METHODS);
  const [gatewayStatus, setGatewayStatus] = useState<{
    sslcommerzConfigured: boolean;
    codEnabled: boolean;
    mode?: 'sandbox' | 'live';
    sandbox?: boolean;
    reservationTtlMinutes?: number;
    webhookSecretConfigured?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<{ settings: StoreSettings }>('/api/cms/admin/settings'),
      apiRequest<{
        gatewayStatus: {
          sslcommerzConfigured: boolean;
          codEnabled: boolean;
          mode?: 'sandbox' | 'live';
          sandbox?: boolean;
          reservationTtlMinutes?: number;
          webhookSecretConfigured?: boolean;
        };
      }>('/api/payments/admin/transactions').catch(() => ({ gatewayStatus: null })),
    ])
      .then(([settingsRes, txRes]) => {
        if (settingsRes.settings?.paymentMethods?.length) {
          setMethods(settingsRes.settings.paymentMethods);
        }
        setGatewayStatus(txRes.gatewayStatus);
      })
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load payment method config.',
          })
        );
      })
      .finally(() => setLoading(false));
  }, [dispatch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest<{ settings: StoreSettings }>('/api/cms/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ paymentMethods: methods }),
      });
      if (res.settings?.paymentMethods) setMethods(res.settings.paymentMethods);
      const codRow = (res.settings?.paymentMethods || methods).find((m) => m.key === 'cod');
      setGatewayStatus((prev) =>
        prev ? { ...prev, codEnabled: codRow ? Boolean(codRow.enabled) : prev.codEnabled } : prev
      );
      dispatch(pushToast({ variant: 'success', message: 'Payment method configuration saved.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save payment methods.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-56 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  const serverMode = gatewayStatus?.mode || (gatewayStatus?.sandbox === false ? 'live' : 'sandbox');
  const hasModeMismatch =
    Boolean(gatewayStatus) &&
    methods.some((m) => m.key !== 'cod' && m.enabled && m.mode !== serverMode);

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Payment Gateways &amp; Methods</h1>
          <p className="text-xs text-slate-500">
            Configure storefront checkout channels, display labels, instructions, and live vs sandbox mode.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Payment Methods'}
        </button>
      </div>

      {gatewayStatus && (
        <div className="space-y-2.5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
              <span>
                Server Gateway:{' '}
                <strong>
                  {gatewayStatus.sslcommerzConfigured
                    ? `SSLCommerz ${serverMode.toUpperCase()} Credentials Active`
                    : `SSLCommerz ${serverMode.toUpperCase()} Env Vars Unset`}
                </strong>
                {gatewayStatus.reservationTtlMinutes
                  ? ` · Stock Reservation TTL: ${gatewayStatus.reservationTtlMinutes}m`
                  : ''}
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-700">
              Active SSLCommerz endpoint &amp; secrets come strictly from server .env
            </span>
          </div>

          {hasModeMismatch && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-900">
              <strong>Mode Notice:</strong> One or more enabled online channels use a UI mode label that differs from the server environment&apos;s active{' '}
              <span className="font-mono font-bold uppercase">{serverMode}</span> endpoint. Actual gateway transactions always route according to server <span className="font-mono">SSLCOMMERZ_IS_LIVE</span> / <span className="font-mono">PAYMENT_SANDBOX</span> env vars.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((method, idx) => (
          <div
            key={method.key}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">{method.key}</p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={method.enabled}
                  onChange={(e) =>
                    setMethods((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, enabled: e.target.checked } : m))
                    )
                  }
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  required
                  value={method.label}
                  onChange={(e) =>
                    setMethods((prev) =>
                      prev.map((m, i) => (i === idx ? { ...m, label: e.target.value } : m))
                    )
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mode</label>
                <select
                  value={method.mode}
                  onChange={(e) =>
                    setMethods((prev) =>
                      prev.map((m, i) =>
                        i === idx ? { ...m, mode: e.target.value as 'sandbox' | 'live' } : m
                      )
                    )
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Customer Instructions
              </label>
              <input
                type="text"
                value={method.instructions}
                onChange={(e) =>
                  setMethods((prev) =>
                    prev.map((m, i) => (i === idx ? { ...m, instructions: e.target.value } : m))
                  )
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </form>
  );
}
