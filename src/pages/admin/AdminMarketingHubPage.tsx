import { useEffect, useState } from 'react';
import {
  Flame,
  Image as ImageIcon,
  Layers,
  Megaphone,
  Pencil,
  Percent,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  extractEntityIds,
  toDatetimeLocalInput,
  toOptionalNumberInput,
} from '../../../shared/formHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest, formatBdt } from '../../lib/api.ts';
import type {
  Advertisement,
  Campaign,
  Category,
  CustomerGroup,
  DiscountRule,
  Product,
  PromoPopup,
} from '../../types/domain.ts';

export type MarketingHubTab = 'rules' | 'offers' | 'campaigns' | 'ads' | 'popups';

export function AdminMarketingHubPage({ initialTab = 'campaigns' }: { initialTab?: MarketingHubTab }) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<MarketingHubTab>(initialTab);

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [popups, setPopups] = useState<PromoPopup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);

  // Discount Rule modal
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    ruleType: 'percentage' as DiscountRule['ruleType'],
    value: 10,
    maxDiscountCap: '',
    minOrderAmount: 0,
    minQuantity: 1,
    targetScope: 'all' as DiscountRule['targetScope'],
    targetIds: [] as string[],
    priority: 0,
    startsAt: '',
    endsAt: '',
    isActive: true,
  });

  // Campaign modal
  const [campOpen, setCampOpen] = useState(false);
  const [editingCamp, setEditingCamp] = useState<Campaign | null>(null);
  const [campForm, setCampForm] = useState({
    name: '',
    slug: '',
    description: '',
    bannerImageUrl: '',
    bannerImagePublicId: '',
    discountLabel: '30% OFF',
    discountPercent: 30,
    productIds: [] as string[],
    categoryIds: [] as string[],
    status: 'active' as Campaign['status'],
    startsAt: '',
    endsAt: '',
  });

  // Ad modal
  const [adOpen, setAdOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [adForm, setAdForm] = useState({
    title: '',
    placement: 'homepage_mid' as Advertisement['placement'],
    desktopImageUrl: '/src/assets/images/promo_tech_laptops_1795621230990.jpg',
    desktopImagePublicId: '',
    mobileImageUrl: '',
    mobileImagePublicId: '',
    targetUrl: '/shop',
    altText: 'Promotional Banner',
    status: 'active' as Advertisement['status'],
  });

  // Popup modal
  const [popupOpen, setPopupOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<PromoPopup | null>(null);
  const [popupForm, setPopupForm] = useState({
    title: '',
    description: '',
    ctaText: 'Shop Offer',
    ctaUrl: '/deals',
    imageUrl: '',
    imagePublicId: '',
    displayFrequency: 'once_per_session' as PromoPopup['displayFrequency'],
    delaySeconds: 3,
    targetPagesText: '*, /, /shop',
    isEnabled: true,
  });

  // Quick Flash Offer modal
  const [flashProductId, setFlashProductId] = useState('');
  const [flashPrice, setFlashPrice] = useState(0);
  const [savingFlash, setSavingFlash] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: string; id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadAll = () => {
    Promise.all([
      apiRequest<{ rules: DiscountRule[] }>('/api/marketing/admin/discount-rules').catch(() => ({ rules: [] })),
      apiRequest<{ campaigns: Campaign[] }>('/api/marketing/admin/campaigns').catch(() => ({ campaigns: [] })),
      apiRequest<{ ads: Advertisement[] }>('/api/marketing/admin/ads').catch(() => ({ ads: [] })),
      apiRequest<{ popups: PromoPopup[] }>('/api/marketing/admin/popups').catch(() => ({ popups: [] })),
      apiRequest<{ products: Product[] }>('/api/catalog/admin/products?limit=50').catch(() => ({ products: [] })),
      apiRequest<{ categories: Category[] }>('/api/catalog/categories?all=true').catch(() => ({ categories: [] })),
      apiRequest<{ groups: CustomerGroup[] }>('/api/users/admin/customer-groups').catch(() => ({ groups: [] })),
    ]).then(([rRes, cRes, aRes, pRes, prodRes, catRes, grpRes]) => {
      setRules(rRes.rules || []);
      setCampaigns(cRes.campaigns || []);
      setAds(aRes.ads || []);
      setPopups(pRes.popups || []);
      setProducts(prodRes.products || []);
      setCategories(catRes.categories || []);
      setCustomerGroups(grpRes.groups || []);
    });
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...ruleForm,
        value: Number(ruleForm.value),
        maxDiscountCap: ruleForm.maxDiscountCap !== '' ? Number(ruleForm.maxDiscountCap) : null,
        minOrderAmount: Number(ruleForm.minOrderAmount) || 0,
        minQuantity: Math.max(1, Number(ruleForm.minQuantity) || 1),
        targetIds: ruleForm.targetScope === 'all' ? [] : ruleForm.targetIds,
        priority: Number(ruleForm.priority) || 0,
        startsAt: ruleForm.startsAt ? new Date(ruleForm.startsAt).toISOString() : null,
        endsAt: ruleForm.endsAt ? new Date(ruleForm.endsAt).toISOString() : null,
      };
      const url = editingRule
        ? `/api/marketing/admin/discount-rules/${editingRule._id}`
        : '/api/marketing/admin/discount-rules';
      await apiRequest(url, { method: editingRule ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setRuleOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'Discount rule saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const saveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...campForm,
        slug: (campForm.slug || campForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase(),
        discountPercent: Number(campForm.discountPercent) || 0,
        startsAt: campForm.startsAt ? new Date(campForm.startsAt).toISOString() : null,
        endsAt: campForm.endsAt ? new Date(campForm.endsAt).toISOString() : null,
      };
      const url = editingCamp
        ? `/api/marketing/admin/campaigns/${editingCamp._id}`
        : '/api/marketing/admin/campaigns';
      await apiRequest(url, { method: editingCamp ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setCampOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'Campaign saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const saveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingAd ? `/api/marketing/admin/ads/${editingAd._id}` : '/api/marketing/admin/ads';
      await apiRequest(url, { method: editingAd ? 'PATCH' : 'POST', body: JSON.stringify(adForm) });
      setAdOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'Advertisement saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const savePopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: popupForm.title,
        description: popupForm.description,
        ctaText: popupForm.ctaText,
        ctaUrl: popupForm.ctaUrl,
        imageUrl: popupForm.imageUrl,
        imagePublicId: popupForm.imagePublicId,
        displayFrequency: popupForm.displayFrequency,
        delaySeconds: Number(popupForm.delaySeconds) || 0,
        targetPages: popupForm.targetPagesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isEnabled: popupForm.isEnabled,
      };
      const url = editingPopup
        ? `/api/marketing/admin/popups/${editingPopup._id}`
        : '/api/marketing/admin/popups';
      await apiRequest(url, { method: editingPopup ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setPopupOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'Promotional popup saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const applyQuickFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flashProductId || flashPrice <= 0) return;
    setSavingFlash(true);
    try {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await apiRequest(`/api/catalog/admin/products/${flashProductId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          flashSalePrice: Number(flashPrice),
          flashSaleStart: now.toISOString(),
          flashSaleEnd: week.toISOString(),
        }),
      });
      dispatch(pushToast({ variant: 'success', message: '7-day flash deal activated on product.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Failed.' }));
    } finally {
      setSavingFlash(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/marketing/admin/${deleteTarget.kind}/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      dispatch(pushToast({ variant: 'info', message: `${deleteTarget.label} deleted.` }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Delete failed.' }));
    }
  };

  const flashProducts = products.filter((p) => p.flashSalePrice || (p.salePrice && p.salePrice < p.basePrice));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['rules', 'Discount Rules', Percent],
              ['offers', 'Special Offers & Flash Sales', Flame],
              ['campaigns', 'Campaigns', Sparkles],
              ['ads', 'Advertisements', Megaphone],
              ['popups', 'Promo Popups', Layers],
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

        {tab === 'rules' && (
          <button
            type="button"
            onClick={() => {
              setEditingRule(null);
              setRuleForm({
                name: '',
                description: '',
                ruleType: 'percentage',
                value: 10,
                maxDiscountCap: '',
                minOrderAmount: 0,
                minQuantity: 1,
                targetScope: 'all',
                targetIds: [],
                priority: 0,
                startsAt: '',
                endsAt: '',
                isActive: true,
              });
              setRuleOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New Discount Rule
          </button>
        )}
        {tab === 'campaigns' && (
          <button
            type="button"
            onClick={() => {
              setEditingCamp(null);
              setCampForm({
                name: '',
                slug: '',
                description: '',
                bannerImageUrl: '',
                bannerImagePublicId: '',
                discountLabel: '30% OFF',
                discountPercent: 30,
                productIds: [],
                categoryIds: [],
                status: 'active',
                startsAt: '',
                endsAt: '',
              });
              setCampOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        )}
        {tab === 'ads' && (
          <button
            type="button"
            onClick={() => {
              setEditingAd(null);
              setAdForm({
                title: '',
                placement: 'homepage_mid',
                desktopImageUrl: '/src/assets/images/promo_tech_laptops_1795621230990.jpg',
                desktopImagePublicId: '',
                mobileImageUrl: '',
                mobileImagePublicId: '',
                targetUrl: '/shop',
                altText: 'Promotional Advertisement',
                status: 'active',
              });
              setAdOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New Advertisement
          </button>
        )}
        {tab === 'popups' && (
          <button
            type="button"
            onClick={() => {
              setEditingPopup(null);
              setPopupForm({
                title: '',
                description: '',
                ctaText: 'Claim Offer',
                ctaUrl: '/deals',
                imageUrl: '',
                imagePublicId: '',
                displayFrequency: 'once_per_session',
                delaySeconds: 3,
                targetPagesText: '*, /, /shop',
                isEnabled: true,
              });
              setPopupOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New Popup
          </button>
        )}
      </div>

      {/* Discount Rules Tab */}
      {tab === 'rules' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Rule Name</th>
                <th className="text-left px-4 py-3 font-semibold">Type &amp; Value</th>
                <th className="text-left px-4 py-3 font-semibold">Conditions</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No automatic discount rules configured yet.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r._id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{r.name}</p>
                      <p className="text-[11px] text-slate-500">{r.description}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                      {r.ruleType === 'fixed' ? formatBdt(r.value) : `${r.value}%`} ({r.ruleType})
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      Min Order {formatBdt(r.minOrderAmount)} · Min Qty {r.minQuantity} · Scope: {r.targetScope}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {r.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule(r);
                          setRuleForm({
                            name: r.name,
                            description: r.description || '',
                            ruleType: r.ruleType,
                            value: r.value,
                            maxDiscountCap: toOptionalNumberInput(r.maxDiscountCap),
                            minOrderAmount: r.minOrderAmount,
                            minQuantity: r.minQuantity,
                            targetScope: r.targetScope,
                            targetIds: extractEntityIds(r.targetIds),
                            priority: r.priority,
                            startsAt: toDatetimeLocalInput(r.startsAt),
                            endsAt: toDatetimeLocalInput(r.endsAt),
                            isActive: r.isActive,
                          });
                          setRuleOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        aria-label={`Edit ${r.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'discount-rules', id: r._id, label: r.name })
                        }
                        className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Special Offers & Flash Sales Tab */}
      {tab === 'offers' && (
        <div className="space-y-4">
          <form
            onSubmit={applyQuickFlashSale}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Activate 7-Day Flash Deal on Product
              </label>
              <select
                required
                value={flashProductId}
                onChange={(e) => {
                  const p = products.find((x) => x._id === e.target.value);
                  setFlashProductId(e.target.value);
                  if (p) setFlashPrice(Math.round(p.basePrice * 0.8));
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (Base: {formatBdt(p.basePrice)})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flash Price (৳)
              </label>
              <input
                type="number"
                required
                min={1}
                value={flashPrice || ''}
                onChange={(e) => setFlashPrice(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={savingFlash}
              className="h-10 px-5 rounded-xl bg-[#16A34A] text-white text-xs font-semibold disabled:opacity-60"
            >
              {savingFlash ? 'Applying...' : 'Launch Flash Offer'}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900">
                Active Deals &amp; Flash Sale Products ({flashProducts.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {flashProducts.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No active flash-sale or discounted products yet.
                </p>
              ) : (
                flashProducts.map((p) => (
                  <div key={p._id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-[11px] font-mono text-slate-400">{p.sku}</p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-emerald-700">
                        {formatBdt(p.flashSalePrice || p.salePrice || p.basePrice)}
                      </span>
                      <span className="ml-2 text-slate-400 line-through">{formatBdt(p.basePrice)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Tab */}
      {tab === 'campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
              No promotional campaigns created yet.
            </div>
          ) : (
            campaigns.map((c) => (
              <div key={c._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900">{c.name}</h3>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">
                      /{c.slug} · {c.discountLabel || `${c.discountPercent}% OFF`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCamp(c);
                        setCampForm({
                          name: c.name,
                          slug: c.slug,
                          description: c.description || '',
                          bannerImageUrl: c.bannerImageUrl || '',
                          bannerImagePublicId: c.bannerImagePublicId || '',
                          discountLabel: c.discountLabel || '',
                          discountPercent: c.discountPercent || 0,
                          productIds: extractEntityIds(c.productIds),
                          categoryIds: extractEntityIds(c.categoryIds),
                          status: c.status,
                          startsAt: toDatetimeLocalInput(c.startsAt),
                          endsAt: toDatetimeLocalInput(c.endsAt),
                        });
                        setCampOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ kind: 'campaigns', id: c._id, label: c.name })}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {c.description && <p className="text-xs text-slate-600">{c.description}</p>}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>{c.productIds?.length || 0} linked products</span>
                  <span className="font-mono">
                    {c.clicks} clicks · {c.conversions} conversions
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Advertisements Tab */}
      {tab === 'ads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ads.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
              No advertisement slots configured yet.
            </div>
          ) : (
            ads.map((ad) => {
              const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0.00';
              return (
                <div key={ad._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={ad.desktopImageUrl}
                      alt={ad.altText || ad.title}
                      className="w-24 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-slate-900 truncate">{ad.title}</p>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold uppercase">
                          {ad.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500">
                        {ad.placement} → {ad.targetUrl}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="font-mono text-slate-600">
                      {ad.impressions} views · {ad.clicks} clicks · CTR {ctr}%
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAd(ad);
                          setAdForm({
                            title: ad.title,
                            placement: ad.placement,
                            desktopImageUrl: ad.desktopImageUrl,
                            desktopImagePublicId: ad.desktopImagePublicId || '',
                            mobileImageUrl: ad.mobileImageUrl || '',
                            mobileImagePublicId: ad.mobileImagePublicId || '',
                            targetUrl: ad.targetUrl,
                            altText: ad.altText || '',
                            status: ad.status,
                          });
                          setAdOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        aria-label={`Edit ${ad.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind: 'ads', id: ad._id, label: ad.title })}
                        className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                        aria-label={`Delete ${ad.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Promo Popups Tab */}
      {tab === 'popups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {popups.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
              No storefront promotional popups created yet.
            </div>
          ) : (
            popups.map((p) => (
              <div key={p._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{p.title}</h3>
                    <p className="text-xs text-slate-500">{p.description}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    {p.displayFrequency.replace(/_/g, ' ')} · {p.delaySeconds}s delay · CTA: {p.ctaText}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPopup(p);
                        setPopupForm({
                          title: p.title,
                          description: p.description || '',
                          ctaText: p.ctaText,
                          ctaUrl: p.ctaUrl,
                          imageUrl: p.imageUrl || '',
                          imagePublicId: p.imagePublicId || '',
                          displayFrequency: p.displayFrequency,
                          delaySeconds: p.delaySeconds,
                          targetPagesText: (p.targetPages || ['*']).join(', '),
                          isEnabled: p.isEnabled,
                        });
                        setPopupOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                      aria-label={`Edit ${p.title}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ kind: 'popups', id: p._id, label: p.title })}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                      aria-label={`Delete ${p.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Discount Rule Modal */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title={editingRule ? 'Edit Rule' : 'New Discount Rule'}>
        <form onSubmit={saveRule} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Rule Name (e.g. Eid Cart Savings)"
            value={ruleForm.name}
            onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
          />
          <input
            type="text"
            placeholder="Description"
            value={ruleForm.description}
            onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={ruleForm.ruleType}
              onChange={(e) => setRuleForm((f) => ({ ...f, ruleType: e.target.value as DiscountRule['ruleType'] }))}
              className="h-10 px-2 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed (৳)</option>
              <option value="bulk_tier">Bulk Tier</option>
            </select>
            <input
              type="number"
              required
              min={1}
              placeholder="Value"
              value={ruleForm.value}
              onChange={(e) => setRuleForm((f) => ({ ...f, value: Number(e.target.value) || 1 }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <select
              value={ruleForm.targetScope}
              onChange={(e) =>
                setRuleForm((f) => ({
                  ...f,
                  targetScope: e.target.value as DiscountRule['targetScope'],
                  targetIds: [],
                }))
              }
              className="h-10 px-2 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="all">All Catalog</option>
              <option value="category">Category</option>
              <option value="product">Product</option>
              <option value="customer_group">Customer Group</option>
            </select>
          </div>
          {ruleForm.targetScope !== 'all' && (
            <div className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">
                Select Target{' '}
                {ruleForm.targetScope === 'category'
                  ? 'Categories'
                  : ruleForm.targetScope === 'product'
                  ? 'Products'
                  : 'Customer Groups'}
              </p>
              <div className="max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {(ruleForm.targetScope === 'category'
                  ? categories.map((c) => ({ id: c._id, label: c.name }))
                  : ruleForm.targetScope === 'product'
                  ? products.map((p) => ({ id: p._id, label: `${p.name} (${p.sku})` }))
                  : customerGroups.map((g) => ({
                      id: g._id,
                      label: `${g.name} (${g.discountPercent}%)`,
                    }))
                ).map((item) => {
                  const checked = ruleForm.targetIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-1.5 truncate cursor-pointer text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setRuleForm((f) => ({
                            ...f,
                            targetIds: e.target.checked
                              ? [...f.targetIds, item.id]
                              : f.targetIds.filter((id) => id !== item.id),
                          }))
                        }
                      />
                      <span className="truncate">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Min Order Amount (৳)
              </label>
              <input
                type="number"
                min={0}
                value={ruleForm.minOrderAmount}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, minOrderAmount: Number(e.target.value) || 0 }))
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Qty</label>
              <input
                type="number"
                min={1}
                value={ruleForm.minQuantity}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, minQuantity: Number(e.target.value) || 1 }))
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Max Discount Cap (৳, optional)
              </label>
              <input
                type="number"
                min={0}
                placeholder="No cap"
                value={ruleForm.maxDiscountCap}
                onChange={(e) => setRuleForm((f) => ({ ...f, maxDiscountCap: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Priority (higher wins ties)
              </label>
              <input
                type="number"
                value={ruleForm.priority}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Starts At (Optional)
              </label>
              <input
                type="datetime-local"
                value={ruleForm.startsAt}
                onChange={(e) => setRuleForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Ends At (Optional)
              </label>
              <input
                type="datetime-local"
                value={ruleForm.endsAt}
                onChange={(e) => setRuleForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={ruleForm.isActive}
              onChange={(e) => setRuleForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span>Active Rule</span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRuleOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Campaign Modal */}
      <Modal open={campOpen} onClose={() => setCampOpen(false)} title={editingCamp ? 'Edit Campaign' : 'Create Campaign'} maxWidthClass="max-w-xl">
        <form onSubmit={saveCampaign} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Campaign Name"
              value={campForm.name}
              onChange={(e) =>
                setCampForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: editingCamp ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                }))
              }
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="text"
              required
              placeholder="Slug"
              value={campForm.slug}
              onChange={(e) => setCampForm((f) => ({ ...f, slug: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Label (e.g. 50% OFF)"
              value={campForm.discountLabel}
              onChange={(e) => setCampForm((f) => ({ ...f, discountLabel: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="number"
              min={0}
              max={95}
              placeholder="Discount %"
              value={campForm.discountPercent}
              onChange={(e) => setCampForm((f) => ({ ...f, discountPercent: Number(e.target.value) || 0 }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <select
              value={campForm.status}
              onChange={(e) => setCampForm((f) => ({ ...f, status: e.target.value as Campaign['status'] }))}
              className="h-10 px-2 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <textarea
            rows={2}
            placeholder="Campaign description..."
            value={campForm.description}
            onChange={(e) => setCampForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">
                Linked Categories ({campForm.categoryIds.length})
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                {categories.map((cat) => (
                  <label key={cat._id} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={campForm.categoryIds.includes(cat._id)}
                      onChange={(e) =>
                        setCampForm((f) => ({
                          ...f,
                          categoryIds: e.target.checked
                            ? [...f.categoryIds, cat._id]
                            : f.categoryIds.filter((id) => id !== cat._id),
                        }))
                      }
                    />
                    <span className="truncate">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">
                Linked Products ({campForm.productIds.length})
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                {products.map((prod) => (
                  <label key={prod._id} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={campForm.productIds.includes(prod._id)}
                      onChange={(e) =>
                        setCampForm((f) => ({
                          ...f,
                          productIds: e.target.checked
                            ? [...f.productIds, prod._id]
                            : f.productIds.filter((id) => id !== prod._id),
                        }))
                      }
                    />
                    <span className="truncate">{prod.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Starts At (Optional)
              </label>
              <input
                type="datetime-local"
                value={campForm.startsAt}
                onChange={(e) => setCampForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Ends At (Optional)
              </label>
              <input
                type="datetime-local"
                value={campForm.endsAt}
                onChange={(e) => setCampForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>
          <CloudinaryUploadField
            folder="promotions"
            label="Campaign Banner Artwork (Optional)"
            onUploaded={(asset) =>
              setCampForm((f) => ({ ...f, bannerImageUrl: asset.url, bannerImagePublicId: asset.publicId }))
            }
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCampOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Save Campaign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ad Modal */}
      <Modal open={adOpen} onClose={() => setAdOpen(false)} title={editingAd ? 'Edit Advertisement' : 'Create Advertisement'} maxWidthClass="max-w-xl">
        <form onSubmit={saveAd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Ad Title"
              value={adForm.title}
              onChange={(e) => setAdForm((f) => ({ ...f, title: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <select
              value={adForm.placement}
              onChange={(e) => setAdForm((f) => ({ ...f, placement: e.target.value as Advertisement['placement'] }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="homepage_top">Homepage Top</option>
              <option value="homepage_mid">Homepage Mid</option>
              <option value="sidebar">Sidebar</option>
              <option value="category_top">Category Top</option>
              <option value="product_detail">Product Detail</option>
              <option value="global_banner">Global Banner</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Target URL (/shop)"
              value={adForm.targetUrl}
              onChange={(e) => setAdForm((f) => ({ ...f, targetUrl: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
            />
            <select
              value={adForm.status}
              onChange={(e) => setAdForm((f) => ({ ...f, status: e.target.value as Advertisement['status'] }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <CloudinaryUploadField
            folder="promotions"
            label="Desktop Ad Image"
            onUploaded={(asset) =>
              setAdForm((f) => ({ ...f, desktopImageUrl: asset.url, desktopImagePublicId: asset.publicId }))
            }
          />
          <CloudinaryUploadField
            folder="promotions"
            label="Mobile Ad Image (Optional)"
            onUploaded={(asset) =>
              setAdForm((f) => ({ ...f, mobileImageUrl: asset.url, mobileImagePublicId: asset.publicId }))
            }
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Save Ad'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Popup Modal */}
      <Modal open={popupOpen} onClose={() => setPopupOpen(false)} title={editingPopup ? 'Edit Popup' : 'Create Promo Popup'} maxWidthClass="max-w-xl">
        <form onSubmit={savePopup} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Popup Title"
            value={popupForm.title}
            onChange={(e) => setPopupForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
          />
          <textarea
            rows={2}
            placeholder="Message / offer details..."
            value={popupForm.description}
            onChange={(e) => setPopupForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="CTA Button Text"
              value={popupForm.ctaText}
              onChange={(e) => setPopupForm((f) => ({ ...f, ctaText: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="text"
              required
              placeholder="CTA URL (/deals)"
              value={popupForm.ctaUrl}
              onChange={(e) => setPopupForm((f) => ({ ...f, ctaUrl: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={popupForm.displayFrequency}
              onChange={(e) =>
                setPopupForm((f) => ({
                  ...f,
                  displayFrequency: e.target.value as PromoPopup['displayFrequency'],
                }))
              }
              className="h-10 px-3 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="once_per_session">Once per Session</option>
              <option value="once_per_day">Once per Day</option>
              <option value="once_ever">Once Ever</option>
              <option value="always">Every Page Load</option>
            </select>
            <input
              type="number"
              min={0}
              max={60}
              placeholder="Delay (seconds)"
              value={popupForm.delaySeconds}
              onChange={(e) => setPopupForm((f) => ({ ...f, delaySeconds: Number(e.target.value) || 0 }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Target paths (*, /, /shop)"
            value={popupForm.targetPagesText}
            onChange={(e) => setPopupForm((f) => ({ ...f, targetPagesText: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-mono"
          />
          <CloudinaryUploadField
            folder="promotions"
            label="Popup Artwork (Optional)"
            onUploaded={(asset) =>
              setPopupForm((f) => ({ ...f, imageUrl: asset.url, imagePublicId: asset.publicId }))
            }
          />
          <label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={popupForm.isEnabled}
              onChange={(e) => setPopupForm((f) => ({ ...f, isEnabled: e.target.checked }))}
            />
            <span>Enable Storefront Popup</span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPopupOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Save Popup'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Marketing Item"
        message={`Permanently delete "${deleteTarget?.label || ''}"?`}
        confirmLabel="Delete"
        danger
      />
      <ImageIcon className="hidden" />
      <span className="hidden">{categories.length}</span>
    </div>
  );
}
