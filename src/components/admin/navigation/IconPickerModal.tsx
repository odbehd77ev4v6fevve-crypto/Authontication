import { useEffect, useRef, useState } from 'react';
import { Image, Search, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import { sanitizeSvgMarkup } from '../../../../shared/megaMenuHelpers.ts';
import { NAV_ICON_NAMES, NavIconRenderer } from '../../navigation/NavIconRenderer.tsx';
import { CloudinaryUploadField } from '../../ui/CloudinaryUploadField.tsx';
import { Modal } from '../../ui/Modal.tsx';

export interface IconPickerValue {
  iconType: 'lucide' | 'svg' | 'image' | 'none';
  iconName: string;
  iconSvg: string;
  iconImageUrl: string;
  iconImagePublicId: string;
  iconColor: string;
  iconBgColor: string;
}

interface IconPickerModalProps {
  open: boolean;
  onClose: () => void;
  value: IconPickerValue;
  onApply: (next: IconPickerValue) => void;
}

export function IconPickerModal({ open, onClose, value, onApply }: IconPickerModalProps) {
  const [tab, setTab] = useState<'lucide' | 'svg' | 'image'>('lucide');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<IconPickerValue>(value);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (open) {
      const current = valueRef.current;
      setDraft(current);
      setSearch('');
      setTab(current.iconType === 'svg' ? 'svg' : current.iconType === 'image' ? 'image' : 'lucide');
    }
  }, [open]);

  const filteredIcons = NAV_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const sanitizedPreview = draft.iconSvg ? sanitizeSvgMarkup(draft.iconSvg) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Navigation Icon"
      description="Choose a built-in icon, paste safe custom SVG markup, or upload a custom icon image."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('lucide')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'lucide'
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Icon Library</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('svg')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'svg'
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Custom SVG</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('image')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'image'
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Image className="w-3.5 h-3.5" />
              <span>Image Icon</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onApply({
                ...draft,
                iconType: 'none',
                iconName: '',
                iconSvg: '',
                iconImageUrl: '',
                iconImagePublicId: '',
              });
              onClose();
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Remove Icon</span>
          </button>
        </div>

        {/* Live Preview & Color Pickers */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: draft.iconBgColor || '#DCFCE7',
                color: draft.iconColor || '#16A34A',
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200/60"
            >
              <NavIconRenderer
                iconType={draft.iconType}
                iconName={draft.iconName || 'LayoutGrid'}
                iconSvg={draft.iconSvg}
                iconImageUrl={draft.iconImageUrl}
                iconColor={draft.iconColor || '#16A34A'}
                sizePx={20}
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Icon Preview</p>
              <p className="text-[11px] text-slate-500">
                Type: {draft.iconType} {draft.iconType === 'lucide' ? `(${draft.iconName})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Icon</span>
              <input
                type="color"
                value={draft.iconColor || '#16A34A'}
                onChange={(e) => setDraft((d) => ({ ...d, iconColor: e.target.value }))}
                className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Badge Bg</span>
              <input
                type="color"
                value={draft.iconBgColor || '#DCFCE7'}
                onChange={(e) => setDraft((d) => ({ ...d, iconBgColor: e.target.value }))}
                className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {tab === 'lucide' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons (e.g. Smartphone, Laptop, Watch, Gift)..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-60 overflow-y-auto p-1">
              {filteredIcons.map((name) => {
                const selected = draft.iconType === 'lucide' && draft.iconName === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, iconType: 'lucide', iconName: name }))
                    }
                    title={name}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-[10px] transition-all ${
                      selected
                        ? 'border-[#16A34A] bg-emerald-50 text-[#15803D] font-bold shadow-xs'
                        : 'border-slate-200 hover:border-emerald-300 text-slate-600'
                    }`}
                  >
                    <NavIconRenderer
                      iconType="lucide"
                      iconName={name}
                      iconColor={selected ? '#15803D' : '#334155'}
                      sizePx={18}
                    />
                    <span className="truncate w-full text-center">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'svg' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Only safe SVG vector elements are kept; scripts, event handlers, and external links are stripped automatically.
              </span>
            </div>
            <textarea
              rows={5}
              value={draft.iconSvg}
              onChange={(e) =>
                setDraft((d) => ({ ...d, iconType: 'svg', iconSvg: e.target.value }))
              }
              placeholder='<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>'
              className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-xs"
            />
            <p className="text-[11px] text-slate-500">
              Sanitized output: {sanitizedPreview ? 'Valid SVG ready' : 'Waiting for valid <svg>...</svg> markup'}
            </p>
          </div>
        )}

        {tab === 'image' && (
          <div className="space-y-3">
            <CloudinaryUploadField
              folder="navigation"
              label="Upload Custom Icon Image"
              onUploaded={(asset) =>
                setDraft((d) => ({
                  ...d,
                  iconType: 'image',
                  iconImageUrl: asset.url,
                  iconImagePublicId: asset.publicId,
                }))
              }
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Or paste Icon Image URL
              </label>
              <input
                type="text"
                value={draft.iconImageUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, iconType: 'image', iconImageUrl: e.target.value }))
                }
                placeholder="https://..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
          >
            Apply Icon
          </button>
        </div>
      </div>
    </Modal>
  );
}
