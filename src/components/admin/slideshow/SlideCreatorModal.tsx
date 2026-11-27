import { useEffect, useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Monitor,
  PlayCircle,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
} from 'lucide-react';
import type { BannerFontFamily, BannerFontWeight } from '../../../../shared/bannerHelpers.ts';
import {
  INTERNAL_SLIDESHOW_PAGES,
  createDefaultSlideForPlacement,
  validateSlideInput,
  type SlideGradientDirection,
  type SlideImagePosition,
  type SlideOverlayType,
  type SlideStatus,
  type SlideTransitionEffect,
  type SlideshowConfig,
  type SlideshowPlacement,
  type SlideshowSlideConfig,
} from '../../../../shared/slideshowHelpers.ts';
import { BUNDLED_BANNER_IMAGES } from '../banner/bannerPresets.ts';
import { PageSlideshow } from '../../marketing/PageSlideshow.tsx';
import { CloudinaryUploadField } from '../../ui/CloudinaryUploadField.tsx';
import { Modal } from '../../ui/Modal.tsx';
import { SafeImage } from '../../ui/SafeImage.tsx';
import type { Category, Product } from '../../../types/domain.ts';

interface SlideCreatorModalProps {
  open: boolean;
  onClose: () => void;
  slideshow: SlideshowConfig;
  initialSlide?: SlideshowSlideConfig | null;
  categories: Category[];
  products: Product[];
  onSave: (slide: SlideshowSlideConfig, slideId?: string) => Promise<void>;
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function InternalTargetPicker({
  label,
  value,
  onSelect,
  categories,
  products,
}: {
  label: string;
  value: string;
  onSelect: (path: string) => void;
  categories: Category[];
  products: Product[];
}) {
  return (
    <select
      aria-label={label}
      value=""
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
      }}
      className="h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 max-w-[165px]"
    >
      <option value="">{value ? 'Pick page...' : 'Quick pick page...'}</option>
      <optgroup label="Core Storefront Pages">
        {INTERNAL_SLIDESHOW_PAGES.map((p) => (
          <option key={p.path} value={p.path}>
            {p.label}
          </option>
        ))}
      </optgroup>
      {categories.length > 0 && (
        <optgroup label="Categories">
          {categories.slice(0, 20).map((c) => (
            <option key={c._id} value={`/category/${c.slug}`}>
              Category: {c.name}
            </option>
          ))}
        </optgroup>
      )}
      {products.length > 0 && (
        <optgroup label="Products">
          {products.slice(0, 25).map((prod) => (
            <option key={prod._id} value={`/product/${prod.slug}`}>
              Product: {prod.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

export function SlideCreatorModal({
  open,
  onClose,
  slideshow,
  initialSlide,
  categories,
  products,
  onSave,
}: SlideCreatorModalProps) {
  const placement: SlideshowPlacement = slideshow.placement;
  const [draft, setDraft] = useState<SlideshowSlideConfig>(() =>
    createDefaultSlideForPlacement(placement, slideshow.slides?.length || 0)
  );
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'overlay' | 'motion'>('content');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (initialSlide) {
      setDraft({ ...initialSlide });
    } else {
      setDraft(createDefaultSlideForPlacement(placement, slideshow.slides?.length || 0));
    }
  }, [open, initialSlide, placement, slideshow.slides?.length]);

  const patchDraft = (patch: Partial<SlideshowSlideConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      if ('startsAt' in patch || 'endsAt' in patch) delete next.schedule;
      return next;
    });
  };

  const handleSave = async () => {
    const check = validateSlideInput(draft);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          ...draft,
          internalName: (draft.internalName || draft.mainHeading).trim().slice(0, 140),
          altText: (draft.altText || draft.mainHeading).trim().slice(0, 180),
          startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
          endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
        },
        initialSlide?._id
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewShellStyle = useMemo(() => {
    if (viewport === 'mobile') return 'max-w-[390px] mx-auto';
    if (viewport === 'tablet') return 'max-w-[768px] mx-auto';
    return 'w-full';
  }, [viewport]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialSlide?._id ? 'Edit Slideshow Slide' : 'Create New Slideshow Slide'}
      maxWidthClass="max-w-6xl"
    >
      <div className="space-y-4">
        {/* Live Full-Background Preview Stage */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <Sparkles className="w-3 h-3" />
                Live Full-Bleed Preview
              </span>
              <span className="text-xs text-slate-500">
                Full background image with overlay typography (zero split card)
              </span>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200">
              {(
                [
                  ['desktop', 'Desktop', Monitor],
                  ['tablet', 'Tablet', Tablet],
                  ['mobile', 'Mobile', Smartphone],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewport(key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    viewport === key
                      ? 'bg-[#16A34A] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={previewShellStyle}>
            <PageSlideshow
              placement={placement}
              slideshow={slideshow}
              previewSlide={draft}
              previewViewport={viewport}
              disableNavigation
            />
          </div>
        </div>

        {/* Validation Alert */}
        {Object.keys(errors).length > 0 && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs text-red-800"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.values(errors).map((err, i) => (
                <span key={i} className="font-semibold">
                  {err}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2.5">
          {(
            [
              ['content', 'Content, Media & Links', ImageIcon],
              ['style', 'Positioning & Typography', Type],
              ['overlay', 'Overlay & Readability', Layers],
              ['motion', 'Animation & Schedule', PlayCircle],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === id
                  ? 'bg-[#16A34A] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Content, Media & Links */}
        {activeTab === 'content' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Text & CTAs */}
            <div className="lg:col-span-7 space-y-3 bg-white border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Slide Name
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={draft.internalName}
                    onChange={(e) => patchDraft({ internalName: e.target.value })}
                    placeholder="Homepage Festive Hero"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Eyebrow / Badge Text
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={draft.badgeText}
                    onChange={(e) => patchDraft({ badgeText: e.target.value })}
                    placeholder="Big Savings, Big Happiness"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Main Heading *
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={draft.mainHeading}
                    onChange={(e) => patchDraft({ mainHeading: e.target.value })}
                    placeholder="Smart Shopping Bigger Savings!"
                    className={`w-full h-9 px-3 rounded-lg border text-xs font-medium focus:outline-none ${
                      errors.mainHeading ? 'border-red-400' : 'border-slate-200 focus:border-emerald-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Highlight Word
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={draft.highlightText}
                    onChange={(e) => patchDraft({ highlightText: e.target.value })}
                    placeholder="Bigger"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={draft.subtitle}
                  onChange={(e) => patchDraft({ subtitle: e.target.value })}
                  placeholder="Up to 60% Off on Top Brands Across Bangladesh"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supporting Description (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={draft.description}
                  onChange={(e) => patchDraft({ description: e.target.value })}
                  placeholder="Shown on full-height desktop slides when space permits."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Full-Slide Click Destination */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Link2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    Full-Slide Click Destination (Optional)
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.destinationNewTab}
                      onChange={(e) => patchDraft({ destinationNewTab: e.target.checked })}
                      className="rounded accent-[#16A34A]"
                    />
                    <ExternalLink className="w-3 h-3" />
                    New tab
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    maxLength={300}
                    value={draft.destinationUrl}
                    onChange={(e) => patchDraft({ destinationUrl: e.target.value })}
                    placeholder="/shop or https://... (leave empty to disable background click)"
                    className={`flex-1 min-w-[200px] h-8 px-2.5 rounded-lg border bg-white text-xs ${
                      errors.destinationUrl ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  <InternalTargetPicker
                    label="Select destination page"
                    value={draft.destinationUrl}
                    onSelect={(path) => patchDraft({ destinationUrl: path })}
                    categories={categories}
                    products={products}
                  />
                  {draft.destinationUrl && (
                    <button
                      type="button"
                      onClick={() => patchDraft({ destinationUrl: '' })}
                      className="px-2 py-1 text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Primary CTA */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">Primary CTA Button (Optional)</span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.primaryButtonNewTab}
                      onChange={(e) => patchDraft({ primaryButtonNewTab: e.target.checked })}
                      className="rounded accent-[#16A34A]"
                    />
                    New tab
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={draft.primaryButtonText}
                    onChange={(e) => patchDraft({ primaryButtonText: e.target.value })}
                    placeholder="Button label (e.g. Shop Now)"
                    className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <input
                    type="text"
                    maxLength={300}
                    value={draft.primaryButtonUrl}
                    onChange={(e) => patchDraft({ primaryButtonUrl: e.target.value })}
                    placeholder="/shop"
                    className="sm:col-span-5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <div className="sm:col-span-3 flex justify-end">
                    <InternalTargetPicker
                      label="Pick primary CTA page"
                      value={draft.primaryButtonUrl}
                      onSelect={(path) => patchDraft({ primaryButtonUrl: path })}
                      categories={categories}
                      products={products}
                    />
                  </div>
                </div>
              </div>

              {/* Secondary CTA */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">Secondary CTA Button (Optional)</span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.secondaryButtonNewTab}
                      onChange={(e) => patchDraft({ secondaryButtonNewTab: e.target.checked })}
                      className="rounded accent-[#16A34A]"
                    />
                    New tab
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={draft.secondaryButtonText}
                    onChange={(e) => patchDraft({ secondaryButtonText: e.target.value })}
                    placeholder="Secondary label (optional)"
                    className="sm:col-span-4 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <input
                    type="text"
                    maxLength={300}
                    value={draft.secondaryButtonUrl}
                    onChange={(e) => patchDraft({ secondaryButtonUrl: e.target.value })}
                    placeholder="/deals"
                    className="sm:col-span-5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <div className="sm:col-span-3 flex justify-end">
                    <InternalTargetPicker
                      label="Pick secondary CTA page"
                      value={draft.secondaryButtonUrl}
                      onSelect={(path) => patchDraft({ secondaryButtonUrl: path })}
                      categories={categories}
                      products={products}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Background Images & Focal Position */}
            <div className="lg:col-span-5 space-y-3 bg-white border border-slate-200 rounded-xl p-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Desktop Full-Bleed Background Image *
                  </label>
                  {draft.desktopImageUrl && (
                    <button
                      type="button"
                      onClick={() => patchDraft({ desktopImageUrl: '', desktopImagePublicId: '' })}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={600}
                  value={draft.desktopImageUrl}
                  onChange={(e) =>
                    patchDraft({ desktopImageUrl: e.target.value, desktopImagePublicId: '' })
                  }
                  placeholder="/src/assets/images/... or https://res.cloudinary.com/..."
                  className={`w-full h-8 px-2.5 rounded-lg border text-xs ${
                    errors.desktopImageUrl ? 'border-red-400' : 'border-slate-200'
                  }`}
                />
                <CloudinaryUploadField
                  label="Upload Desktop Image"
                  folder="slideshows"
                  className="w-full"
                  onUploaded={(asset) =>
                    patchDraft({
                      desktopImageUrl: asset.url || '',
                      desktopImagePublicId: asset.publicId || '',
                    })
                  }
                />
                <p className="text-[11px] text-slate-500">
                  High-res landscape photo covering 100% of slide width.
                </p>
              </div>

              {/* Studio Preset Picker */}
              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">
                  Or choose bundled store photography:
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {BUNDLED_BANNER_IMAGES.map((img) => {
                    const selected = draft.desktopImageUrl === img.url;
                    return (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() =>
                          patchDraft({ desktopImageUrl: img.url, desktopImagePublicId: '' })
                        }
                        className={`relative rounded-lg overflow-hidden border h-12 ${
                          selected
                            ? 'border-[#16A34A] ring-2 ring-[#16A34A]/30'
                            : 'border-slate-200 hover:border-emerald-400'
                        }`}
                      >
                        <SafeImage
                          src={img.url}
                          alt={img.label}
                          className="w-full h-full object-cover"
                        />
                        {selected && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#16A34A] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Mobile Background Image (Optional)
                  </label>
                  {draft.mobileImageUrl && (
                    <button
                      type="button"
                      onClick={() => patchDraft({ mobileImageUrl: '', mobileImagePublicId: '' })}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={600}
                  value={draft.mobileImageUrl}
                  onChange={(e) =>
                    patchDraft({ mobileImageUrl: e.target.value, mobileImagePublicId: '' })
                  }
                  placeholder="Optional portrait/mobile image URL"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
                <CloudinaryUploadField
                  label="Upload Mobile Image"
                  folder="slideshows"
                  className="w-full"
                  onUploaded={(asset) =>
                    patchDraft({
                      mobileImageUrl: asset.url || '',
                      mobileImagePublicId: asset.publicId || '',
                    })
                  }
                />
                <p className="text-[11px] text-slate-500">
                  Optional portrait/mobile crop used below 768px.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Image Focal Position
                  </label>
                  <select
                    value={draft.imagePosition}
                    onChange={(e) =>
                      patchDraft({ imagePosition: e.target.value as SlideImagePosition })
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SEO Image Alt Text
                  </label>
                  <input
                    type="text"
                    maxLength={180}
                    value={draft.altText}
                    onChange={(e) => patchDraft({ altText: e.target.value })}
                    placeholder="Campaign description"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Positioning & Typography */}
        {activeTab === 'style' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 rounded-xl p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    Horizontal Alignment
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
                    {(
                      [
                        ['left', AlignLeft, 'Left'],
                        ['center', AlignCenter, 'Center'],
                        ['right', AlignRight, 'Right'],
                      ] as const
                    ).map(([val, Icon, label]) => (
                      <button
                        key={val}
                        type="button"
                        aria-label={`Horizontal align ${label}`}
                        onClick={() => patchDraft({ horizontalAlign: val })}
                        className={`h-8 rounded-md flex items-center justify-center ${
                          draft.horizontalAlign === val
                            ? 'bg-[#16A34A] text-white'
                            : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    Vertical Alignment
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
                    {(
                      [
                        ['top', ArrowUpToLine, 'Top'],
                        ['center', AlignCenter, 'Middle'],
                        ['bottom', ArrowDownToLine, 'Bottom'],
                      ] as const
                    ).map(([val, Icon, label]) => (
                      <button
                        key={val}
                        type="button"
                        aria-label={`Vertical align ${label}`}
                        onClick={() => patchDraft({ verticalAlign: val })}
                        className={`h-8 rounded-md flex items-center justify-center ${
                          draft.verticalAlign === val
                            ? 'bg-[#16A34A] text-white'
                            : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Font Family
                  </label>
                  <select
                    value={draft.fontFamily}
                    onChange={(e) =>
                      patchDraft({ fontFamily: e.target.value as BannerFontFamily })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="Poppins">Poppins</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Outfit">Outfit</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Manrope">Manrope</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Font Weight
                  </label>
                  <select
                    value={draft.fontWeight}
                    onChange={(e) =>
                      patchDraft({ fontWeight: e.target.value as BannerFontWeight })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="400">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="800">ExtraBold (800)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Heading Size</span>
                    <span className="font-mono text-slate-500">{draft.headingSizePx}px</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={72}
                    value={draft.headingSizePx}
                    onChange={(e) => patchDraft({ headingSizePx: Number(e.target.value) })}
                    className="w-full accent-[#16A34A]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Subtitle Size</span>
                    <span className="font-mono text-slate-500">{draft.subtitleSizePx}px</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={30}
                    value={draft.subtitleSizePx}
                    onChange={(e) => patchDraft({ subtitleSizePx: Number(e.target.value) })}
                    className="w-full accent-[#16A34A]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Content Width (px)
                  </label>
                  <input
                    type="number"
                    min={280}
                    max={1200}
                    value={draft.contentMaxWidthPx}
                    onChange={(e) =>
                      patchDraft({ contentMaxWidthPx: Math.max(280, Number(e.target.value) || 600) })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Padding (px)
                  </label>
                  <input
                    type="number"
                    min={12}
                    max={96}
                    value={draft.paddingPx}
                    onChange={(e) =>
                      patchDraft({ paddingPx: Math.max(12, Number(e.target.value) || 32) })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Line Height
                  </label>
                  <input
                    type="number"
                    min={0.95}
                    max={2}
                    step={0.05}
                    value={draft.lineHeight}
                    onChange={(e) =>
                      patchDraft({ lineHeight: Math.max(0.95, Number(e.target.value) || 1.15) })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Letter Spacing</span>
                  <span className="font-mono text-slate-500">{draft.letterSpacingPx}px</span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={8}
                  step={0.5}
                  value={draft.letterSpacingPx}
                  onChange={(e) => patchDraft({ letterSpacingPx: Number(e.target.value) })}
                  className="w-full accent-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    ['Text Color', 'textColor'],
                    ['Highlight Color', 'highlightColor'],
                    ['Primary Btn Bg', 'primaryBtnBg'],
                    ['Primary Btn Text', 'primaryBtnText'],
                    ['Secondary Text', 'secondaryBtnText'],
                  ] as const
                ).map(([label, key]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    <span className="truncate">{label}</span>
                    <input
                      type="color"
                      value={draft[key]}
                      onChange={(e) => patchDraft({ [key]: e.target.value })}
                      className="w-6 h-5 rounded border border-slate-300 cursor-pointer bg-transparent p-0"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Overlay & Readability */}
        {activeTab === 'overlay' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 rounded-xl p-4">
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">Overlay Type</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['gradient', 'solid'] as SlideOverlayType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => patchDraft({ overlayType: type })}
                      className={`py-2 rounded-xl border text-xs font-bold capitalize ${
                        draft.overlayType === type
                          ? 'border-[#16A34A] bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {type === 'gradient' ? 'Directional Gradient' : 'Solid Scrim'}
                    </button>
                  ))}
                </div>
              </div>

              {draft.overlayType === 'solid' ? (
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <span>Solid Overlay Color</span>
                    <input
                      type="color"
                      value={draft.overlayColor}
                      onChange={(e) => patchDraft({ overlayColor: e.target.value })}
                      className="w-8 h-6 rounded border border-slate-300 cursor-pointer p-0"
                    />
                  </label>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Overlay Opacity</span>
                      <span className="font-mono text-slate-500">{draft.overlayOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={95}
                      value={draft.overlayOpacity}
                      onChange={(e) => patchDraft({ overlayOpacity: Number(e.target.value) })}
                      className="w-full accent-[#16A34A]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold">
                      <span>Start Color</span>
                      <input
                        type="color"
                        value={draft.gradientStart}
                        onChange={(e) => patchDraft({ gradientStart: e.target.value })}
                        className="w-7 h-5 rounded border border-slate-300 cursor-pointer p-0"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold">
                      <span>End Color</span>
                      <input
                        type="color"
                        value={draft.gradientEnd}
                        onChange={(e) => patchDraft({ gradientEnd: e.target.value })}
                        className="w-7 h-5 rounded border border-slate-300 cursor-pointer p-0"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Start Opacity</span>
                        <span className="font-mono">{draft.gradientStartOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={95}
                        value={draft.gradientStartOpacity}
                        onChange={(e) =>
                          patchDraft({ gradientStartOpacity: Number(e.target.value) })
                        }
                        className="w-full accent-[#16A34A]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>End Opacity</span>
                        <span className="font-mono">{draft.gradientEndOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={95}
                        value={draft.gradientEndOpacity}
                        onChange={(e) =>
                          patchDraft({ gradientEndOpacity: Number(e.target.value) })
                        }
                        className="w-full accent-[#16A34A]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gradient Direction
                </label>
                <select
                  value={draft.gradientDirection}
                  onChange={(e) =>
                    patchDraft({ gradientDirection: e.target.value as SlideGradientDirection })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                >
                  <option value="to right">Left → Right</option>
                  <option value="to left">Right → Left</option>
                  <option value="to bottom">Top → Bottom</option>
                  <option value="to top">Bottom → Top</option>
                  <option value="135deg">Diagonal (135°)</option>
                  <option value="45deg">Diagonal (45°)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Backdrop Blur Effect</span>
                  <span className="font-mono text-slate-500">{draft.blurPx}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={16}
                  value={draft.blurPx}
                  onChange={(e) => patchDraft({ blurPx: Number(e.target.value) })}
                  className="w-full accent-[#16A34A]"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Animation & Schedule */}
        {activeTab === 'motion' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 rounded-xl p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slide Transition Effect
                  </label>
                  <select
                    value={draft.animationEffect}
                    onChange={(e) =>
                      patchDraft({ animationEffect: e.target.value as SlideTransitionEffect })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="fade">Fade</option>
                    <option value="slide">Slide</option>
                    <option value="zoom">Zoom</option>
                    <option value="zoom_in">Zoom In</option>
                    <option value="zoom_out">Zoom Out</option>
                    <option value="ken_burns">Ken Burns (Slow Pan/Zoom)</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transition Duration (ms)
                  </label>
                  <input
                    type="number"
                    min={150}
                    max={3000}
                    step={50}
                    value={draft.animationDurationMs}
                    onChange={(e) =>
                      patchDraft({ animationDurationMs: Math.max(150, Number(e.target.value) || 600) })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={draft.displayOrder}
                    onChange={(e) =>
                      patchDraft({ displayOrder: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Publish Status
                  </label>
                  <select
                    value={draft.status}
                    onChange={(e) => patchDraft({ status: e.target.value as SlideStatus })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => patchDraft({ isActive: e.target.checked })}
                  className="rounded accent-[#16A34A]"
                />
                <span className="text-xs font-bold text-slate-800">
                  Slide is Active (eligible for storefront rendering)
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date &amp; Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(draft.startsAt)}
                  onChange={(e) =>
                    patchDraft({
                      startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date &amp; Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(draft.endsAt)}
                  onChange={(e) =>
                    patchDraft({
                      endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving Slide...' : initialSlide?._id ? 'Update Slide' : 'Save Slide'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
