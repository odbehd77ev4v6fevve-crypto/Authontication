import { useEffect, useState } from 'react';
import { useAppDispatch } from '../../../app/hooks.ts';
import { pushToast } from '../../../features/toast/toastSlice.ts';
import { apiRequest } from '../../../lib/api.ts';
import type { MegaMenuSlideRecord, NavigationMenuRecord } from '../../../types/domain.ts';
import { MegaMenuPromoSlider } from '../../navigation/MegaMenuPromoSlider.tsx';
import { CloudinaryUploadField } from '../../ui/CloudinaryUploadField.tsx';
import { Modal } from '../../ui/Modal.tsx';

interface MegaMenuSlideModalProps {
  open: boolean;
  onClose: () => void;
  slide: MegaMenuSlideRecord | null;
  menus: NavigationMenuRecord[];
  defaultMenuId?: string;
  onSaved: (slide: MegaMenuSlideRecord) => void;
}

function toDatetimeLocalValue(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function MegaMenuSlideModal({
  open,
  onClose,
  slide,
  menus,
  defaultMenuId,
  onSaved,
}: MegaMenuSlideModalProps) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    menuIds: [] as string[],
    internalName: '',
    badgeText: 'Special Offer',
    mainHeading: '',
    highlightText: '',
    discountText: '',
    description: '',
    ctaLabel: 'Shop Now',
    ctaUrl: '/shop',
    openInNewTab: false,
    desktopImageUrl: '',
    desktopImagePublicId: '',
    mobileImageUrl: '',
    mobileImagePublicId: '',
    altText: 'Mega Menu Promotional Slide',
    imagePosition: 'bottom_right' as MegaMenuSlideRecord['imagePosition'],
    textColor: '#0F172A',
    highlightColor: '#16A34A',
    buttonBgColor: '#16A34A',
    buttonTextColor: '#FFFFFF',
    badgeBgColor: '#16A34A',
    badgeTextColor: '#FFFFFF',
    textAlign: 'left' as MegaMenuSlideRecord['textAlign'],
    overlayColor: '#DCFCE7',
    overlayOpacity: 0,
    borderRadiusPx: 16,
    priority: 10,
    displayOrder: 0,
    isActive: true,
    status: 'published' as MegaMenuSlideRecord['status'],
    startsAt: '',
    endsAt: '',
  });

  useEffect(() => {
    if (!open) return;
    if (slide) {
      setForm({
        menuIds: (slide.menuIds || []).map(String),
        internalName: slide.internalName || '',
        badgeText: slide.badgeText || '',
        mainHeading: slide.mainHeading || '',
        highlightText: slide.highlightText || '',
        discountText: slide.discountText || '',
        description: slide.description || '',
        ctaLabel: slide.ctaLabel || 'Shop Now',
        ctaUrl: slide.ctaUrl || '/shop',
        openInNewTab: Boolean(slide.openInNewTab),
        desktopImageUrl: slide.desktopImageUrl || '',
        desktopImagePublicId: slide.desktopImagePublicId || '',
        mobileImageUrl: slide.mobileImageUrl || '',
        mobileImagePublicId: slide.mobileImagePublicId || '',
        altText: slide.altText || '',
        imagePosition: slide.imagePosition || 'bottom_right',
        textColor: slide.textColor || '#0F172A',
        highlightColor: slide.highlightColor || '#16A34A',
        buttonBgColor: slide.buttonBgColor || '#16A34A',
        buttonTextColor: slide.buttonTextColor || '#FFFFFF',
        badgeBgColor: slide.badgeBgColor || '#16A34A',
        badgeTextColor: slide.badgeTextColor || '#FFFFFF',
        textAlign: slide.textAlign || 'left',
        overlayColor: slide.overlayColor || '#DCFCE7',
        overlayOpacity: slide.overlayOpacity ?? 0,
        borderRadiusPx: slide.borderRadiusPx ?? 16,
        priority: slide.priority ?? 10,
        displayOrder: slide.displayOrder ?? 0,
        isActive: slide.isActive ?? true,
        status: slide.status || 'published',
        startsAt: toDatetimeLocalValue(slide.startsAt),
        endsAt: toDatetimeLocalValue(slide.endsAt),
      });
    } else {
      setForm({
        menuIds: defaultMenuId ? [defaultMenuId] : menus[0]?._id ? [menus[0]._id] : [],
        internalName: '',
        badgeText: 'Special Offer',
        mainHeading: 'Smart Living',
        highlightText: 'Better Tomorrow',
        discountText: 'Up to 60% Off',
        description: 'on Top Brands',
        ctaLabel: 'Shop Now',
        ctaUrl: '/deals',
        openInNewTab: false,
        desktopImageUrl: '',
        desktopImagePublicId: '',
        mobileImageUrl: '',
        mobileImagePublicId: '',
        altText: 'Mega Menu Promotional Offer',
        imagePosition: 'bottom_right',
        textColor: '#0F172A',
        highlightColor: '#16A34A',
        buttonBgColor: '#16A34A',
        buttonTextColor: '#FFFFFF',
        badgeBgColor: '#16A34A',
        badgeTextColor: '#FFFFFF',
        textAlign: 'left',
        overlayColor: '#DCFCE7',
        overlayOpacity: 0,
        borderRadiusPx: 16,
        priority: 10,
        displayOrder: 0,
        isActive: true,
        status: 'published',
        startsAt: '',
        endsAt: '',
      });
    }
  }, [open, slide, defaultMenuId, menus]);

  const toggleMenuAssignment = (id: string) => {
    setForm((prev) => ({
      ...prev,
      menuIds: prev.menuIds.includes(id)
        ? prev.menuIds.filter((m) => m !== id)
        : [...prev.menuIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority) || 0,
        displayOrder: Number(form.displayOrder) || 0,
        overlayOpacity: Number(form.overlayOpacity) || 0,
        borderRadiusPx: Number(form.borderRadiusPx) || 16,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      const endpoint = slide
        ? `/api/navigation/admin/slides/${slide._id}`
        : '/api/navigation/admin/slides';
      const res = await apiRequest<{ slide: MegaMenuSlideRecord }>(endpoint, {
        method: slide ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      window.dispatchEvent(new CustomEvent('novara:cms-updated'));
      dispatch(
        pushToast({
          variant: 'success',
          message: slide ? 'Promotional slide updated.' : 'Promotional slide created.',
        })
      );
      onSaved(res.slide);
      onClose();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to save promotional slide.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const previewSlide: MegaMenuSlideRecord = {
    _id: slide?._id || 'preview',
    ...form,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={slide ? 'Edit Mega Menu Slide' : 'Create Mega Menu Promotional Slide'}
      description="Configure slide copy, styling, schedule, and menu assignments with real-time preview."
      maxWidthClass="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Fields */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Name *</label>
              <input
                type="text"
                required
                value={form.internalName}
                onChange={(e) => setForm((f) => ({ ...f, internalName: e.target.value }))}
                placeholder="e.g. Smart Living Offer"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Text</label>
              <input
                type="text"
                value={form.badgeText}
                onChange={(e) => setForm((f) => ({ ...f, badgeText: e.target.value }))}
                placeholder="Special Offer"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Main Heading *</label>
              <input
                type="text"
                required
                value={form.mainHeading}
                onChange={(e) => setForm((f) => ({ ...f, mainHeading: e.target.value }))}
                placeholder="Smart Living"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Highlighted Heading</label>
              <input
                type="text"
                value={form.highlightText}
                onChange={(e) => setForm((f) => ({ ...f, highlightText: e.target.value }))}
                placeholder="Better Tomorrow"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Text</label>
              <input
                type="text"
                value={form.discountText}
                onChange={(e) => setForm((f) => ({ ...f, discountText: e.target.value }))}
                placeholder="Up to 60% Off"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="on Top Brands"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CTA Button Label</label>
              <input
                type="text"
                value={form.ctaLabel}
                onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Link</label>
              <input
                type="text"
                value={form.ctaUrl}
                onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                placeholder="/deals"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>

          {/* Media Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="space-y-2">
              <CloudinaryUploadField
                folder="navigation"
                label="Upload Desktop Image"
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
                placeholder="Desktop image URL"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-mono bg-white"
              />
            </div>
            <div className="space-y-2">
              <CloudinaryUploadField
                folder="navigation"
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
                placeholder="Mobile image URL"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-mono bg-white"
              />
            </div>
          </div>

          {/* Styling Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Image Position</label>
              <select
                value={form.imagePosition}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imagePosition: e.target.value as MegaMenuSlideRecord['imagePosition'] }))
                }
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="bottom_right">Bottom Right Card</option>
                <option value="center">Centered Card</option>
                <option value="cover">Full Cover BG</option>
                <option value="right">Right Aligned</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Text Align</label>
              <select
                value={form.textAlign}
                onChange={(e) =>
                  setForm((f) => ({ ...f, textAlign: e.target.value as MegaMenuSlideRecord['textAlign'] }))
                }
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as MegaMenuSlideRecord['status'] }))
                }
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Draft</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Priority</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Text</span>
              <input
                type="color"
                value={form.textColor}
                onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                className="w-6 h-6 rounded border border-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Highlight</span>
              <input
                type="color"
                value={form.highlightColor}
                onChange={(e) => setForm((f) => ({ ...f, highlightColor: e.target.value }))}
                className="w-6 h-6 rounded border border-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Button</span>
              <input
                type="color"
                value={form.buttonBgColor}
                onChange={(e) => setForm((f) => ({ ...f, buttonBgColor: e.target.value }))}
                className="w-6 h-6 rounded border border-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Badge</span>
              <input
                type="color"
                value={form.badgeBgColor}
                onChange={(e) => setForm((f) => ({ ...f, badgeBgColor: e.target.value }))}
                className="w-6 h-6 rounded border border-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Overlay %</span>
              <input
                type="number"
                min={0}
                max={95}
                value={form.overlayOpacity}
                onChange={(e) => setForm((f) => ({ ...f, overlayOpacity: Number(e.target.value) || 0 }))}
                className="w-16 h-7 px-2 rounded border border-slate-200 text-xs"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Schedule (Optional)</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Schedule (Optional)</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Menu Assignment */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1.5">Assign to Mega Menus</p>
            <div className="flex flex-wrap gap-2">
              {menus.map((m) => (
                <label
                  key={m._id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                    form.menuIds.includes(m._id)
                      ? 'bg-emerald-50 border-[#16A34A] text-[#15803D] font-semibold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.menuIds.includes(m._id)}
                    onChange={() => toggleMenuAssignment(m._id)}
                  />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-semibold">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <span>Slide Active</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.openInNewTab}
                onChange={(e) => setForm((f) => ({ ...f, openInNewTab: e.target.checked }))}
              />
              <span>Open Link in New Tab</span>
            </label>
          </div>
        </div>

        {/* Live Slide Preview */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Card Preview</p>
          <div className="h-[400px]">
            <MegaMenuPromoSlider slides={[previewSlide]} />
          </div>
        </div>

        <div className="lg:col-span-12 flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
          >
            {saving ? 'Saving Slide...' : slide ? 'Save Changes' : 'Create Slide'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
