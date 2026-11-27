import { useEffect, useState } from 'react';
import { Calendar, Eye, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toDatetimeLocalInput } from '../../../shared/formHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { SafeImage } from '../../components/ui/SafeImage.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { CartHeroBannerConfig } from '../../types/domain.ts';

interface BannerFormState {
  badgeText: string;
  heading: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  desktopImageUrl: string;
  desktopImagePublicId: string;
  mobileImageUrl: string;
  mobileImagePublicId: string;
  altText: string;
  imagePosition: 'right' | 'background';
  displayOrder: number;
  isEnabled: boolean;
  startsAt: string;
  endsAt: string;
}

const emptyBannerForm = (): BannerFormState => ({
  badgeText: 'Your Shopping Cart',
  heading: 'Your Cart',
  subtitle: 'Review your items and proceed to checkout',
  ctaText: 'Continue Shopping',
  ctaLink: '/shop',
  desktopImageUrl: '',
  desktopImagePublicId: '',
  mobileImageUrl: '',
  mobileImagePublicId: '',
  altText: 'Your Shopping Cart Banner',
  imagePosition: 'right',
  displayOrder: 0,
  isEnabled: true,
  startsAt: '',
  endsAt: '',
});

export function AdminCartBannersTab() {
  const dispatch = useAppDispatch();
  const [banners, setBanners] = useState<CartHeroBannerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<CartHeroBannerConfig | null>(null);
  const [form, setForm] = useState<BannerFormState>(emptyBannerForm());
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBanners = () => {
    setLoading(true);
    apiRequest<{ banners: CartHeroBannerConfig[] }>('/api/cms/admin/cart-banners')
      .then((res) => setBanners(res.banners || []))
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load Cart Hero Banners.',
          })
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const openModal = (banner?: CartHeroBannerConfig) => {
    if (banner) {
      setEditingBanner(banner);
      setForm({
        badgeText: banner.badgeText || '',
        heading: banner.heading || 'Your Cart',
        subtitle: banner.subtitle || '',
        ctaText: banner.ctaText || 'Continue Shopping',
        ctaLink: banner.ctaLink || '/shop',
        desktopImageUrl: banner.desktopImageUrl || '',
        desktopImagePublicId: banner.desktopImagePublicId || '',
        mobileImageUrl: banner.mobileImageUrl || '',
        mobileImagePublicId: banner.mobileImagePublicId || '',
        altText: banner.altText || 'Your Shopping Cart Banner',
        imagePosition: banner.imagePosition || 'right',
        displayOrder: banner.displayOrder ?? 0,
        isEnabled: banner.isEnabled,
        startsAt: toDatetimeLocalInput(banner.startsAt),
        endsAt: toDatetimeLocalInput(banner.endsAt),
      });
    } else {
      setEditingBanner(null);
      setForm({
        ...emptyBannerForm(),
        displayOrder: banners.length,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        badgeText: form.badgeText.trim(),
        heading: form.heading.trim(),
        subtitle: form.subtitle.trim(),
        ctaText: form.ctaText.trim(),
        ctaLink: form.ctaLink.trim() || '/shop',
        desktopImageUrl: form.desktopImageUrl.trim(),
        desktopImagePublicId: form.desktopImagePublicId.trim(),
        mobileImageUrl: form.mobileImageUrl.trim(),
        mobileImagePublicId: form.mobileImagePublicId.trim(),
        altText: form.altText.trim() || 'Your Shopping Cart Banner',
        imagePosition: form.imagePosition,
        displayOrder: Number(form.displayOrder) || 0,
        isEnabled: form.isEnabled,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };

      const url = editingBanner
        ? `/api/cms/admin/cart-banners/${editingBanner._id}`
        : '/api/cms/admin/cart-banners';
      await apiRequest(url, {
        method: editingBanner ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });

      setModalOpen(false);
      dispatch(
        pushToast({
          variant: 'success',
          message: editingBanner ? 'Cart Hero Banner updated.' : 'Cart Hero Banner created.',
        })
      );
      loadBanners();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save Cart Hero Banner.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggle = async (banner: CartHeroBannerConfig) => {
    try {
      await apiRequest(`/api/cms/admin/cart-banners/${banner._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !banner.isEnabled }),
      });
      dispatch(
        pushToast({
          variant: 'success',
          message: !banner.isEnabled ? 'Banner enabled.' : 'Banner disabled.',
        })
      );
      loadBanners();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to toggle banner.',
        })
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/cms/admin/cart-banners/${deleteTargetId}`, { method: 'DELETE' });
      setDeleteTargetId(null);
      dispatch(pushToast({ variant: 'info', message: 'Cart Hero Banner deleted.' }));
      loadBanners();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to delete banner.',
        })
      );
    } finally {
      setDeleting(false);
    }
  };

  const getScheduleBadge = (banner: CartHeroBannerConfig) => {
    if (!banner.isEnabled) {
      return { label: 'Disabled', cls: 'bg-slate-100 text-slate-600' };
    }
    const now = new Date();
    if (banner.startsAt && now < new Date(banner.startsAt)) {
      return { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700' };
    }
    if (banner.endsAt && now > new Date(banner.endsAt)) {
      return { label: 'Expired', cls: 'bg-red-50 text-red-700' };
    }
    return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Cart Hero Banners</h2>
          <p className="text-xs text-slate-500">
            Manage responsive Cart Page hero banners, schedule campaigns, set display priority, and upload custom desktop/mobile artwork. When none are active, the cart uses its clean green vector fallback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>New Cart Banner</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2">
          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No Cart Hero Banners configured</p>
          <p className="text-xs text-slate-500">
            Create a banner to customize the heading, CTA link, or upload campaign artwork for the Shopping Cart page.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {banners.map((banner) => {
            const badge = getScheduleBadge(banner);
            return (
              <div
                key={banner._id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {banner.desktopImageUrl ? (
                    <SafeImage
                      src={banner.desktopImageUrl}
                      alt={banner.altText || banner.heading}
                      className="w-24 h-14 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-14 rounded-lg bg-gradient-to-br from-[#F0FDF4] to-[#BBF7D0] border border-emerald-200 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5 text-[#16A34A]" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {banner.heading}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                        Priority #{banner.displayOrder ?? 0}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{banner.subtitle}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                      <span>
                        CTA: {banner.ctaText || 'Continue Shopping'} → {banner.ctaLink || '/shop'}
                      </span>
                      {(banner.startsAt || banner.endsAt) && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Calendar className="w-3 h-3" />
                          {banner.startsAt ? banner.startsAt.slice(0, 10) : 'Now'} –{' '}
                          {banner.endsAt ? banner.endsAt.slice(0, 10) : 'Forever'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleQuickToggle(banner)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    {banner.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal(banner)}
                    aria-label={`Edit ${banner.heading}`}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(banner._id)}
                    aria-label={`Delete ${banner.heading}`}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Cart Hero Banner Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBanner ? 'Edit Cart Hero Banner' : 'Create Cart Hero Banner'}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Text</label>
              <input
                type="text"
                maxLength={60}
                value={form.badgeText}
                onChange={(e) => setForm((f) => ({ ...f, badgeText: e.target.value }))}
                placeholder="Your Shopping Cart"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Heading *</label>
              <input
                type="text"
                required
                maxLength={120}
                value={form.heading}
                onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))}
                placeholder="Your Cart"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle</label>
              <input
                type="text"
                maxLength={240}
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="Review your items and proceed to checkout"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CTA Text</label>
              <input
                type="text"
                maxLength={50}
                value={form.ctaText}
                onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                placeholder="Continue Shopping"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CTA Destination URL
              </label>
              <input
                type="text"
                maxLength={300}
                value={form.ctaLink}
                onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))}
                placeholder="/shop"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Image Layout Position
              </label>
              <select
                value={form.imagePosition}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    imagePosition: e.target.value as 'right' | 'background',
                  }))
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
              >
                <option value="right">Right Showcase Artwork</option>
                <option value="background">Full-Width Background</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Priority (0 = Highest)
              </label>
              <input
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayOrder: Number(e.target.value) || 0 }))
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Schedule Start (Optional)
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Schedule End (Optional)
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Image Alt Text
              </label>
              <input
                type="text"
                maxLength={180}
                value={form.altText}
                onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
                placeholder="Your Shopping Cart Banner"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Desktop & Mobile Image Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <CloudinaryUploadField
                folder="cart"
                label="Upload Desktop Image (Optional)"
                onUploaded={(asset) =>
                  setForm((f) => ({
                    ...f,
                    desktopImageUrl: asset.url,
                    desktopImagePublicId: asset.publicId,
                  }))
                }
              />
              <input
                type="text"
                value={form.desktopImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, desktopImageUrl: e.target.value }))}
                placeholder="Or paste desktop image path/URL"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
              {form.desktopImageUrl && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <SafeImage
                    src={form.desktopImageUrl}
                    alt="Desktop preview"
                    className="h-12 w-20 object-cover rounded"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, desktopImageUrl: '', desktopImagePublicId: '' }))
                    }
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <CloudinaryUploadField
                folder="cart"
                label="Upload Mobile Image (Optional)"
                onUploaded={(asset) =>
                  setForm((f) => ({
                    ...f,
                    mobileImageUrl: asset.url,
                    mobileImagePublicId: asset.publicId,
                  }))
                }
              />
              <input
                type="text"
                value={form.mobileImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, mobileImageUrl: e.target.value }))}
                placeholder="Or paste mobile image path/URL"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
              {form.mobileImageUrl && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <SafeImage
                    src={form.mobileImageUrl}
                    alt="Mobile preview"
                    className="h-12 w-20 object-cover rounded"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, mobileImageUrl: '', mobileImagePublicId: '' }))
                    }
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded accent-emerald-600"
            />
            <span>Enable this Cart Hero Banner</span>
          </label>

          {/* Live Mini Preview */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Live Banner Preview
            </p>
            <div
              className={`rounded-2xl overflow-hidden bg-gradient-to-br from-[#F0FDF4] via-[#DCFCE7] to-[#D1FAE5] border border-emerald-200 p-5 relative flex items-center justify-between gap-4 ${
                form.isEnabled ? 'opacity-100' : 'opacity-45'
              }`}
            >
              {form.imagePosition === 'background' && form.desktopImageUrl && (
                <SafeImage
                  src={form.desktopImageUrl}
                  alt={form.altText || 'Banner preview'}
                  className="absolute inset-0 w-full h-full object-cover opacity-25"
                />
              )}
              <div className="relative z-10 space-y-1.5">
                {form.badgeText && (
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#22C55E] text-white text-[11px] font-bold">
                    {form.badgeText}
                  </span>
                )}
                <h3 className="text-xl font-extrabold text-slate-900">
                  {form.heading || 'Your Cart'}
                </h3>
                <p className="text-xs text-slate-700">
                  {form.subtitle || 'Review your items and proceed to checkout'}
                </p>
                {form.ctaText && (
                  <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#16A34A] text-white text-[11px] font-bold">
                    {form.ctaText} →
                  </span>
                )}
              </div>
              {form.imagePosition === 'right' && form.desktopImageUrl && (
                <SafeImage
                  src={form.desktopImageUrl}
                  alt={form.altText || 'Banner artwork preview'}
                  className="relative z-10 h-24 w-32 object-contain rounded-xl shrink-0"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Cart Hero Banner?"
        message="This banner will be permanently removed from CMS."
        confirmLabel="Delete Banner"
        danger
        loading={deleting}
      />
    </div>
  );
}
