import { useEffect, useState } from 'react';
import { Globe, Layout, Mail, Save, Send, Shield, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.ts';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { StoreSettings } from '../../types/domain.ts';

export type WebsiteSettingsTab = 'header' | 'footer' | 'shipping-tax' | 'email' | 'seo' | 'security';

export function AdminWebsiteSettingsPage({ initialTab = 'header' }: { initialTab?: WebsiteSettingsTab }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<WebsiteSettingsTab>(initialTab);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    apiRequest<{ settings: StoreSettings }>('/api/cms/admin/settings')
      .then((res) => setSettings(res.settings))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load store settings.',
          })
        );
      });
  }, [dispatch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ settings: StoreSettings }>('/api/cms/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings(res.settings);
      dispatch(pushToast({ variant: 'success', message: 'Store configuration saved.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save configuration.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>(
        '/api/cms/admin/settings/test-email',
        {
          method: 'POST',
          body: JSON.stringify({ email: testEmailAddress.trim() || undefined }),
        }
      );
      dispatch(pushToast({ variant: res.ok ? 'success' : 'info', message: res.message }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Test email failed.',
        })
      );
    } finally {
      setSendingTest(false);
    }
  };

  if (!settings) {
    return <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  const headerCfg = settings.headerSettings || {
    logoUrl: '',
    logoPublicId: '',
    showSearch: true,
    showWishlist: true,
    showCart: true,
    showAccount: true,
    stickyHeader: true,
    announcementBar: {
      enabled: true,
      text: 'Free Shipping on Orders Over ৳999 · 7 Days Easy Return · Secure Payment',
      backgroundColor: '#0B1A2B',
      textColor: '#FFFFFF',
      linkUrl: '/shop',
    },
  };

  const footerCfg = settings.footerSettings || {
    footerLogoUrl: '',
    description:
      'Your trusted Bangladesh retail storefront for authentic electronics, fashion, books, beauty, and home essentials.',
    copyrightText: `© ${new Date().getFullYear()} ${settings.storeName}. All Rights Reserved.`,
    showPaymentLogos: true,
  };

  const taxCfg = settings.taxSettings || {
    enabled: (settings.taxRate || 0) > 0,
    taxInclusive: false,
    label: 'VAT',
    applyToShipping: false,
  };

  const emailCfg = settings.emailSettings || {
    senderName: settings.storeName,
    senderEmail: settings.supportEmail || 'support@novaracommerce.com',
    replyToEmail: settings.supportEmail || '',
    orderConfirmationEnabled: true,
    shipmentUpdateEnabled: true,
    lowStockAlertEnabled: true,
  };

  const notifCfg = settings.notificationSettings || {
    adminNewOrder: true,
    adminLowStock: true,
    adminReturnRequest: true,
    customerOrderUpdates: true,
    customerPromotions: true,
    lowStockAlertEmail: settings.supportEmail || '',
  };

  const secCfg = settings.securitySettings || {
    sessionTimeoutMinutes: 1440,
    maxLoginAttempts: 8,
    lockoutMinutes: 15,
    minPasswordLength: 8,
    requireStrongPassword: true,
    requireEmailVerification: false,
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['header', 'Header & Announcement', Layout],
              ['footer', 'Footer & Socials', Layout],
              ['shipping-tax', 'Shipping & Tax', Truck],
              ['email', 'Email & Notifications', Mail],
              ['seo', 'SEO & Sitemap', Globe],
              ['security', 'Security Rules', Shield],
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

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {tab === 'header' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <h2 className="text-base font-extrabold text-slate-900">Storefront Header &amp; Announcement Bar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <CloudinaryUploadField
              folder="cms"
              label="Custom Storefront Logo (Optional)"
              onUploaded={(asset) =>
                setSettings({
                  ...settings,
                  headerSettings: { ...headerCfg, logoUrl: asset.url, logoPublicId: asset.publicId },
                })
              }
            />
            {headerCfg.logoUrl && (
              <div className="flex items-center gap-3">
                <SafeImage src={headerCfg.logoUrl} alt="Header Logo" className="h-12 object-contain border border-slate-200 rounded p-1" />
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      headerSettings: { ...headerCfg, logoUrl: '', logoPublicId: '' },
                    })
                  }
                  className="text-xs font-semibold text-red-600"
                >
                  Reset to Default Wordmark
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-700 pt-2 border-t border-slate-100">
            {(
              [
                ['stickyHeader', 'Sticky Top Header'],
                ['showSearch', 'Show Search Bar'],
                ['showWishlist', 'Show Wishlist Icon'],
                ['showCart', 'Show Cart Icon'],
                ['showAccount', 'Show Account Menu'],
              ] as const
            ).map(([k, lbl]) => (
              <label key={k} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={headerCfg[k]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      headerSettings: { ...headerCfg, [k]: e.target.checked },
                    })
                  }
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={headerCfg.announcementBar.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    headerSettings: {
                      ...headerCfg,
                      announcementBar: { ...headerCfg.announcementBar, enabled: e.target.checked },
                    },
                  })
                }
              />
              <span>Enable Top Announcement Strip</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Announcement text"
                value={headerCfg.announcementBar.text}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    headerSettings: {
                      ...headerCfg,
                      announcementBar: { ...headerCfg.announcementBar, text: e.target.value },
                    },
                  })
                }
                className="sm:col-span-2 h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
              <input
                type="text"
                placeholder="Link URL (/shop)"
                value={headerCfg.announcementBar.linkUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    headerSettings: {
                      ...headerCfg,
                      announcementBar: { ...headerCfg.announcementBar, linkUrl: e.target.value },
                    },
                  })
                }
                className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <span>Background</span>
                <input
                  type="color"
                  value={headerCfg.announcementBar.backgroundColor}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      headerSettings: {
                        ...headerCfg,
                        announcementBar: {
                          ...headerCfg.announcementBar,
                          backgroundColor: e.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-2">
                <span>Text Color</span>
                <input
                  type="color"
                  value={headerCfg.announcementBar.textColor}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      headerSettings: {
                        ...headerCfg,
                        announcementBar: {
                          ...headerCfg.announcementBar,
                          textColor: e.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === 'footer' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-emerald-900">
                Full Dynamic Footer CMS Available
              </p>
              <p className="text-[11px] text-emerald-800">
                Customize footer layouts, unlimited drag-and-drop columns &amp; menus, social icons, newsletter, trust badges, and live responsive preview.
              </p>
            </div>
            <Link
              to="/admin/cms/footer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shrink-0 shadow-xs"
            >
              <span>Open Full Dynamic Footer CMS</span>
              <span>→</span>
            </Link>
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Quick Footer Content &amp; Social Profiles</h2>
          <textarea
            rows={3}
            placeholder="Footer brand description"
            value={footerCfg.description}
            onChange={(e) =>
              setSettings({
                ...settings,
                footerSettings: { ...footerCfg, description: e.target.value },
              })
            }
            className="w-full p-3 rounded-lg border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Copyright notice"
              value={footerCfg.copyrightText}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  footerSettings: { ...footerCfg, copyrightText: e.target.value },
                })
              }
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 h-10">
              <input
                type="checkbox"
                checked={footerCfg.showPaymentLogos}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    footerSettings: { ...footerCfg, showPaymentLogos: e.target.checked },
                  })
                }
              />
              <span>Show Payment Method Badges (VISA / Mastercard / bKash / Nagad / COD)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {(['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'whatsapp'] as const).map((net) => (
              <div key={net}>
                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                  {net} URL
                </label>
                <input
                  type="url"
                  placeholder={`https://${net}.com/...`}
                  value={settings.socialLinks?.[net] || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      socialLinks: { ...settings.socialLinks, [net]: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'shipping-tax' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <h2 className="text-base font-extrabold text-slate-900">Bangladesh Delivery Zones &amp; Tax Rules</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                ['dhakaMetroCharge', 'Dhaka Metro (৳)'],
                ['dhakaSuburbCharge', 'Dhaka Suburb (৳)'],
                ['outsideDhakaCharge', 'Outside Dhaka (৳)'],
                ['freeShippingThreshold', 'Free Over (৳)'],
                ['expressSurcharge', 'Express Add-On (৳)'],
              ] as const
            ).map(([k, lbl]) => (
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{lbl}</label>
                <input
                  type="number"
                  min={0}
                  value={settings.shipping[k]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      shipping: { ...settings.shipping, [k]: Number(e.target.value) || 0 },
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                step="0.5"
                value={settings.taxRate}
                onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Label</label>
              <input
                type="text"
                value={taxCfg.label}
                onChange={(e) =>
                  setSettings({ ...settings, taxSettings: { ...taxCfg, label: e.target.value } })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 h-10">
              <input
                type="checkbox"
                checked={taxCfg.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, taxSettings: { ...taxCfg, enabled: e.target.checked } })
                }
              />
              <span>Enable Checkout Tax</span>
            </label>
          </div>
        </div>
      )}

      {tab === 'email' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <h2 className="text-base font-extrabold text-slate-900">Transactional Email &amp; Alert Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Name</label>
              <input
                type="text"
                value={emailCfg.senderName}
                onChange={(e) =>
                  setSettings({ ...settings, emailSettings: { ...emailCfg, senderName: e.target.value } })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Email</label>
              <input
                type="email"
                value={emailCfg.senderEmail}
                onChange={(e) =>
                  setSettings({ ...settings, emailSettings: { ...emailCfg, senderEmail: e.target.value } })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Low Stock Alert Email</label>
              <input
                type="email"
                value={notifCfg.lowStockAlertEmail}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notificationSettings: { ...notifCfg, lowStockAlertEmail: e.target.value },
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifCfg.adminNewOrder}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notificationSettings: { ...notifCfg, adminNewOrder: e.target.checked },
                  })
                }
              />
              <span>Notify Admin on New Orders</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailCfg.orderConfirmationEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    emailSettings: { ...emailCfg, orderConfirmationEnabled: e.target.checked },
                  })
                }
              />
              <span>Send Customer Order Confirmations</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailCfg.shipmentUpdateEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    emailSettings: { ...emailCfg, shipmentUpdateEnabled: e.target.checked },
                  })
                }
              />
              <span>Send Shipment Status Updates</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <input
              type="email"
              placeholder="Recipient email for test..."
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs w-64"
            />
            <button
              type="button"
              disabled={sendingTest}
              onClick={handleSendTestEmail}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingTest ? 'Testing...' : 'Send Test Email'}
            </button>
          </div>
        </div>
      )}

      {tab === 'seo' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">SEO Meta Defaults, Robots &amp; Sitemap</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title Suffix</label>
              <input
                type="text"
                value={settings.seoDefaults.titleSuffix}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    seoDefaults: { ...settings.seoDefaults, titleSuffix: e.target.value },
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 mt-5">
              <input
                type="checkbox"
                checked={settings.seoDefaults.sitemapEnabled ?? true}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    seoDefaults: { ...settings.seoDefaults, sitemapEnabled: e.target.checked },
                  })
                }
              />
              <span>Enable XML Sitemap Generation</span>
            </label>
          </div>
          <textarea
            rows={2}
            placeholder="Default Meta Description"
            value={settings.seoDefaults.defaultDescription}
            onChange={(e) =>
              setSettings({
                ...settings,
                seoDefaults: { ...settings.seoDefaults, defaultDescription: e.target.value },
              })
            }
            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
          />
          <textarea
            rows={3}
            placeholder="robots.txt rules"
            value={settings.seoDefaults.robotsTxt || 'User-agent: *\nAllow: /'}
            onChange={(e) =>
              setSettings({
                ...settings,
                seoDefaults: { ...settings.seoDefaults, robotsTxt: e.target.value },
              })
            }
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-mono"
          />
        </div>
      )}

      {tab === 'security' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">Authentication &amp; Session Guardrails</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session Timeout (min)
              </label>
              <input
                type="number"
                min={15}
                value={secCfg.sessionTimeoutMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: {
                      ...secCfg,
                      sessionTimeoutMinutes: Math.max(15, Number(e.target.value) || 60),
                    },
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Login Attempts
              </label>
              <input
                type="number"
                min={3}
                max={30}
                value={secCfg.maxLoginAttempts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: {
                      ...secCfg,
                      maxLoginAttempts: Math.max(3, Number(e.target.value) || 8),
                    },
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lockout Window (min)
              </label>
              <input
                type="number"
                min={1}
                max={240}
                value={secCfg.lockoutMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: {
                      ...secCfg,
                      lockoutMinutes: Math.max(1, Number(e.target.value) || 15),
                    },
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Password Length
              </label>
              <input
                type="number"
                min={6}
                max={32}
                value={secCfg.minPasswordLength}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: {
                      ...secCfg,
                      minPasswordLength: Math.max(6, Number(e.target.value) || 8),
                    },
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-700 pt-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={secCfg.requireStrongPassword}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: { ...secCfg, requireStrongPassword: e.target.checked },
                  })
                }
              />
              <span>Enforce Mixed-Case + Numeric Passwords</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={secCfg.requireEmailVerification}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    securitySettings: { ...secCfg, requireEmailVerification: e.target.checked },
                  })
                }
              />
              <span>Require Email Verification Before Checkout</span>
            </label>
          </div>
        </div>
      )}
    </form>
  );
}
