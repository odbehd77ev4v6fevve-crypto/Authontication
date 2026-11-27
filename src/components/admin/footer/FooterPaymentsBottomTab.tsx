import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  FOOTER_PAYMENT_KEYS,
  formatCopyrightText,
  inferStoreChannelForBadge,
  moveArrayItem,
  type FooterBottomBarConfig,
  type FooterBottomLinkConfig,
  type FooterConfigPayload,
  type FooterPaymentBadgeConfig,
  type StorePaymentMethodFlag,
} from '../../../../shared/footerHelpers.ts';
import { CloudinaryUploadField } from '../../ui/CloudinaryUploadField.tsx';

interface FooterPaymentsTabProps {
  payments: FooterConfigPayload['payments'];
  trustBadges: FooterConfigPayload['trustBadges'];
  storePaymentMethods: StorePaymentMethodFlag[];
  onChangePayments: (next: FooterConfigPayload['payments']) => void;
  onChangeTrustBadges: (next: FooterConfigPayload['trustBadges']) => void;
}

export function FooterPaymentsTab({
  payments,
  trustBadges,
  storePaymentMethods,
  onChangePayments,
  onChangeTrustBadges,
}: FooterPaymentsTabProps) {
  const [newBadgeLabel, setNewBadgeLabel] = useState('');
  const [newBadgeKey, setNewBadgeKey] = useState<FooterPaymentBadgeConfig['key']>('sslcommerz');

  const sortedBadges = [...(payments.badges || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
  const sortedTrust = [...(trustBadges.items || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const isStoreChannelEnabled = (badge: FooterPaymentBadgeConfig): boolean => {
    if (!storePaymentMethods || storePaymentMethods.length === 0) return true;
    const chKey = badge.storeChannelKey || inferStoreChannelForBadge(badge.key);
    if (chKey === 'always') return true;
    const found = storePaymentMethods.find((m) => m.key === chKey);
    if (!found && chKey === 'sslcommerz') {
      return storePaymentMethods.some((m) => ['card', 'bkash', 'nagad'].includes(m.key) && m.enabled);
    }
    return Boolean(found?.enabled);
  };

  const handleAddBadge = () => {
    const label = newBadgeLabel.trim() || newBadgeKey.toUpperCase();
    const next: FooterPaymentBadgeConfig = {
      id: `pay-${Date.now()}`,
      key: newBadgeKey,
      storeChannelKey: inferStoreChannelForBadge(newBadgeKey),
      label,
      isActive: true,
      displayOrder: sortedBadges.length,
      bgColor: '#FFFFFF',
      textColor: '#0F172A',
    };
    onChangePayments({
      ...payments,
      badges: [...sortedBadges, next],
    });
    setNewBadgeLabel('');
  };

  return (
    <div className="space-y-6">
      {/* Payment Methods Badges */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Payment Method Badges</h2>
            <p className="text-xs text-slate-500">
              Disabled gateways in Store Payment Methods are automatically hidden from the public footer.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={payments.enabled}
              onChange={(e) => onChangePayments({ ...payments, enabled: e.target.checked })}
            />
            <span>Show Payment Badges</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Label Prefix</label>
            <input
              type="text"
              value={payments.title}
              onChange={(e) => onChangePayments({ ...payments, title: e.target.value })}
              placeholder="Payment Methods:"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div className="flex items-end gap-2">
            <select
              value={newBadgeKey}
              onChange={(e) =>
                setNewBadgeKey(e.target.value as FooterPaymentBadgeConfig['key'])
              }
              className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
            >
              {FOOTER_PAYMENT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newBadgeLabel}
              onChange={(e) => setNewBadgeLabel(e.target.value)}
              placeholder="Badge label"
              className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <button
              type="button"
              onClick={handleAddBadge}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {sortedBadges.map((badge, idx) => {
            const gatewayEnabled = isStoreChannelEnabled(badge);
            return (
              <div
                key={badge.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="checkbox"
                    checked={badge.isActive}
                    onChange={(e) =>
                      onChangePayments({
                        ...payments,
                        badges: sortedBadges.map((b) =>
                          b.id === badge.id ? { ...b, isActive: e.target.checked } : b
                        ),
                      })
                    }
                  />
                  <span
                    style={{ backgroundColor: badge.bgColor, color: badge.textColor }}
                    className="px-2.5 py-0.5 rounded border border-slate-200 text-[11px] font-bold"
                  >
                    {badge.label}
                  </span>
                  <input
                    type="text"
                    value={badge.label}
                    onChange={(e) =>
                      onChangePayments({
                        ...payments,
                        badges: sortedBadges.map((b) =>
                          b.id === badge.id ? { ...b, label: e.target.value } : b
                        ),
                      })
                    }
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs w-28"
                  />
                  {!gatewayEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Disabled in Store Payment Settings</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <CloudinaryUploadField
                    folder="footer"
                    label="Icon"
                    onUploaded={(asset) =>
                      onChangePayments({
                        ...payments,
                        badges: sortedBadges.map((b) =>
                          b.id === badge.id
                            ? { ...b, iconImageUrl: asset.url, iconImagePublicId: asset.publicId }
                            : b
                        ),
                      })
                    }
                  />
                  <input
                    type="color"
                    title="Badge background"
                    value={badge.bgColor}
                    onChange={(e) =>
                      onChangePayments({
                        ...payments,
                        badges: sortedBadges.map((b) =>
                          b.id === badge.id ? { ...b, bgColor: e.target.value } : b
                        ),
                      })
                    }
                    className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="color"
                    title="Badge text color"
                    value={badge.textColor}
                    onChange={(e) =>
                      onChangePayments({
                        ...payments,
                        badges: sortedBadges.map((b) =>
                          b.id === badge.id ? { ...b, textColor: e.target.value } : b
                        ),
                      })
                    }
                    className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                  />
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() =>
                      onChangePayments({
                        ...payments,
                        badges: moveArrayItem(sortedBadges, idx, idx - 1).map((b, i) => ({
                          ...b,
                          displayOrder: i,
                        })),
                      })
                    }
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sortedBadges.length - 1}
                    onClick={() =>
                      onChangePayments({
                        ...payments,
                        badges: moveArrayItem(sortedBadges, idx, idx + 1).map((b, i) => ({
                          ...b,
                          displayOrder: i,
                        })),
                      })
                    }
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangePayments({
                        ...payments,
                        badges: sortedBadges
                          .filter((b) => b.id !== badge.id)
                          .map((b, i) => ({ ...b, displayOrder: i })),
                      })
                    }
                    className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust Badges */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Trust & Guarantee Badges</h3>
            <p className="text-xs text-slate-500">
              Highlight secure checkout, return guarantee, and fast delivery commitments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={trustBadges.enabled}
                onChange={(e) =>
                  onChangeTrustBadges({ ...trustBadges, enabled: e.target.checked })
                }
              />
              <span>Enable Trust Strip</span>
            </label>
            <button
              type="button"
              onClick={() =>
                onChangeTrustBadges({
                  ...trustBadges,
                  items: [
                    ...sortedTrust,
                    {
                      id: `trust-${Date.now()}`,
                      title: 'Verified Warranty',
                      subtitle: 'Official manufacturer support',
                      iconName: 'Award',
                      isActive: true,
                      displayOrder: sortedTrust.length,
                    },
                  ],
                })
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Trust Badge</span>
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {sortedTrust.map((tb) => (
            <div
              key={tb.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center p-3 rounded-xl border border-slate-200"
            >
              <label className="sm:col-span-1 flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={tb.isActive}
                  onChange={(e) =>
                    onChangeTrustBadges({
                      ...trustBadges,
                      items: sortedTrust.map((t) =>
                        t.id === tb.id ? { ...t, isActive: e.target.checked } : t
                      ),
                    })
                  }
                />
              </label>
              <input
                type="text"
                value={tb.title}
                onChange={(e) =>
                  onChangeTrustBadges({
                    ...trustBadges,
                    items: sortedTrust.map((t) =>
                      t.id === tb.id ? { ...t, title: e.target.value } : t
                    ),
                  })
                }
                placeholder="Title"
                className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold"
              />
              <input
                type="text"
                value={tb.subtitle}
                onChange={(e) =>
                  onChangeTrustBadges({
                    ...trustBadges,
                    items: sortedTrust.map((t) =>
                      t.id === tb.id ? { ...t, subtitle: e.target.value } : t
                    ),
                  })
                }
                placeholder="Subtitle"
                className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
              />
              <select
                value={tb.iconName}
                onChange={(e) =>
                  onChangeTrustBadges({
                    ...trustBadges,
                    items: sortedTrust.map((t) =>
                      t.id === tb.id ? { ...t, iconName: e.target.value } : t
                    ),
                  })
                }
                className="sm:col-span-2 h-8 px-2 rounded-lg border border-slate-200 text-xs"
              >
                <option value="ShieldCheck">Shield</option>
                <option value="Package">Return Box</option>
                <option value="Truck">Delivery Truck</option>
                <option value="Award">Award</option>
                <option value="Phone">Support</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  onChangeTrustBadges({
                    ...trustBadges,
                    items: sortedTrust.filter((t) => t.id !== tb.id),
                  })
                }
                className="sm:col-span-1 p-1.5 rounded-lg text-red-600 hover:bg-red-50 justify-self-end"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FooterBottomBarTabProps {
  bottomBar: FooterBottomBarConfig;
  onChange: (next: FooterBottomBarConfig) => void;
}

export function FooterBottomBarTab({ bottomBar, onChange }: FooterBottomBarTabProps) {
  const sortedLinks = [...(bottomBar.links || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const commitLinks = (next: FooterBottomLinkConfig[]) => {
    onChange({
      ...bottomBar,
      links: next.map((l, idx) => ({ ...l, displayOrder: idx })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Copyright & Bottom Bar</h2>
            <p className="text-xs text-slate-500">
              Supports <code className="bg-slate-100 px-1 rounded">{'{year}'}</code> and{' '}
              <code className="bg-slate-100 px-1 rounded">{'{company}'}</code> tokens. Preview:{' '}
              <strong>
                {formatCopyrightText(
                  bottomBar.copyrightTemplate,
                  bottomBar.companyName,
                  bottomBar.copyrightYear
                )}
              </strong>
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={bottomBar.enabled}
              onChange={(e) => onChange({ ...bottomBar, enabled: e.target.checked })}
            />
            <span>Enable Bottom Bar</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Copyright Template
            </label>
            <input
              type="text"
              value={bottomBar.copyrightTemplate}
              onChange={(e) => onChange({ ...bottomBar, copyrightTemplate: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Copyright Year (&ldquo;auto&rdquo; or 2026)
            </label>
            <input
              type="text"
              value={bottomBar.copyrightYear}
              onChange={(e) => onChange({ ...bottomBar, copyrightYear: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              value={bottomBar.companyName}
              onChange={(e) => onChange({ ...bottomBar, companyName: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Developer Credit (Optional)
            </label>
            <input
              type="text"
              value={bottomBar.developerCreditText}
              onChange={(e) => onChange({ ...bottomBar, developerCreditText: e.target.value })}
              placeholder="Built by ..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Developer Credit URL
            </label>
            <input
              type="text"
              value={bottomBar.developerCreditUrl}
              onChange={(e) => onChange({ ...bottomBar, developerCreditUrl: e.target.value })}
              placeholder="https://..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="color"
              value={bottomBar.backgroundColor}
              onChange={(e) => onChange({ ...bottomBar, backgroundColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
            />
            <span>Background</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="color"
              value={bottomBar.textColor}
              onChange={(e) => onChange({ ...bottomBar, textColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
            />
            <span>Text Color</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="color"
              value={bottomBar.borderColor}
              onChange={(e) => onChange({ ...bottomBar, borderColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
            />
            <span>Border Color</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={bottomBar.showAdminAccess}
              onChange={(e) => onChange({ ...bottomBar, showAdminAccess: e.target.checked })}
            />
            <span>Show Subtle Admin Sign-In Icon</span>
          </label>
        </div>
      </div>

      {/* Bottom Policy Links */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Bottom Bar Policy Links</h3>
            <p className="text-xs text-slate-500">
              Manage inline links shown beside the copyright notice.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              commitLinks([
                ...sortedLinks,
                {
                  id: `bot-${Date.now()}`,
                  label: 'Cookie Policy',
                  url: '/policies/privacy',
                  openInNewTab: false,
                  isActive: true,
                  displayOrder: sortedLinks.length,
                },
              ])
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Link</span>
          </button>
        </div>

        <div className="space-y-2">
          {sortedLinks.map((lnk, idx) => (
            <div
              key={lnk.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl border border-slate-200"
            >
              <label className="sm:col-span-1 flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={lnk.isActive}
                  onChange={(e) =>
                    commitLinks(
                      sortedLinks.map((l) =>
                        l.id === lnk.id ? { ...l, isActive: e.target.checked } : l
                      )
                    )
                  }
                />
              </label>
              <input
                type="text"
                value={lnk.label}
                onChange={(e) =>
                  commitLinks(
                    sortedLinks.map((l) =>
                      l.id === lnk.id ? { ...l, label: e.target.value } : l
                    )
                  )
                }
                placeholder="Label"
                className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold"
              />
              <input
                type="text"
                value={lnk.url}
                onChange={(e) =>
                  commitLinks(
                    sortedLinks.map((l) =>
                      l.id === lnk.id ? { ...l, url: e.target.value } : l
                    )
                  )
                }
                placeholder="/policies/privacy"
                className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
              />
              <div className="sm:col-span-3 flex items-center justify-end gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => commitLinks(moveArrayItem(sortedLinks, idx, idx - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === sortedLinks.length - 1}
                  onClick={() => commitLinks(moveArrayItem(sortedLinks, idx, idx + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => commitLinks(sortedLinks.filter((l) => l.id !== lnk.id))}
                  className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
