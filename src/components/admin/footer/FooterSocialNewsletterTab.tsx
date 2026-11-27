import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  FOOTER_SOCIAL_PLATFORMS,
  moveArrayItem,
  type FooterNewsletterConfig,
  type FooterSocialLinkConfig,
  type FooterSocialSectionConfig,
} from '../../../../shared/footerHelpers.ts';
import { CloudinaryUploadField } from '../../ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { Modal } from '../../ui/Modal.tsx';

interface FooterSocialTabProps {
  social: FooterSocialSectionConfig;
  onChange: (next: FooterSocialSectionConfig) => void;
}

const PLATFORM_LABELS: Record<FooterSocialLinkConfig['platform'], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  pinterest: 'Pinterest',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  custom: 'Custom Platform',
};

export function FooterSocialTab({ social, onChange }: FooterSocialTabProps) {
  const sortedLinks = [...(social.links || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
  const [editing, setEditing] = useState<FooterSocialLinkConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<FooterSocialLinkConfig | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const commitLinks = (nextLinks: FooterSocialLinkConfig[]) => {
    onChange({
      ...social,
      links: nextLinks.map((l, idx) => ({ ...l, displayOrder: idx })),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.label.trim() || !editing.url.trim()) return;
    if (isNew) {
      commitLinks([...sortedLinks, editing]);
    } else {
      commitLinks(sortedLinks.map((l) => (l.id === editing.id ? editing : l)));
    }
    setEditing(null);
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const fromIdx = sortedLinks.findIndex((l) => l.id === dragId);
    const toIdx = sortedLinks.findIndex((l) => l.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    commitLinks(moveArrayItem(sortedLinks, fromIdx, toIdx));
    setDragId(null);
  };

  return (
    <div className="space-y-6">
      {/* Social Styling */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Social Media Appearance</h2>
            <p className="text-xs text-slate-500">
              Control icon dimensions, colors, button shape, and visibility.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={social.enabled}
              onChange={(e) => onChange({ ...social, enabled: e.target.checked })}
            />
            <span>Enable Social Icons</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Section Heading</label>
            <input
              type="text"
              value={social.title}
              onChange={(e) => onChange({ ...social, title: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Button Shape</label>
            <select
              value={social.buttonStyle}
              onChange={(e) =>
                onChange({
                  ...social,
                  buttonStyle: e.target.value as FooterSocialSectionConfig['buttonStyle'],
                })
              }
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
            >
              <option value="rounded">Rounded</option>
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="ghost">Transparent Ghost</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Icon Size ({social.iconSizePx}px)
            </label>
            <input
              type="range"
              min={12}
              max={28}
              value={social.iconSizePx}
              onChange={(e) => onChange({ ...social, iconSizePx: Number(e.target.value) })}
              className="w-full accent-[#16A34A]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Border Radius ({social.borderRadiusPx}px)
            </label>
            <input
              type="range"
              min={0}
              max={24}
              value={social.borderRadiusPx}
              onChange={(e) => onChange({ ...social, borderRadiusPx: Number(e.target.value) })}
              className="w-full accent-[#16A34A]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="color"
              value={social.iconColor}
              onChange={(e) => onChange({ ...social, iconColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
            />
            <span>Icon Color</span>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="color"
              value={social.hoverColor}
              onChange={(e) => onChange({ ...social, hoverColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
            />
            <span>Hover Color</span>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="color"
              value={social.backgroundColor}
              onChange={(e) => onChange({ ...social, backgroundColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
            />
            <span>Button Fill</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={social.showLabels}
              onChange={(e) => onChange({ ...social, showLabels: e.target.checked })}
            />
            <span>Show Platform Text Labels</span>
          </label>
        </div>
      </div>

      {/* Social Links List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900">
            Social Profiles ({sortedLinks.length})
          </h3>
          <button
            type="button"
            data-testid="add-social-link-btn"
            onClick={() => {
              setIsNew(true);
              setEditing({
                id: `soc-${Date.now()}`,
                platform: 'facebook',
                label: 'Facebook',
                url: 'https://facebook.com',
                iconType: 'brand',
                iconName: 'Globe',
                iconSvg: '',
                iconImageUrl: '',
                iconImagePublicId: '',
                openInNewTab: true,
                displayOrder: sortedLinks.length,
                isActive: true,
              });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Social Link</span>
          </button>
        </div>

        <div className="space-y-2">
          {sortedLinks.map((lnk, idx) => (
            <div
              key={lnk.id}
              draggable
              onDragStart={() => setDragId(lnk.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(lnk.id)}
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{lnk.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      {PLATFORM_LABELS[lnk.platform] || lnk.platform}
                    </span>
                    {!lnk.isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 truncate max-w-xs">{lnk.url}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
                  onClick={() => {
                    setIsNew(false);
                    setEditing({ ...lnk });
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-emerald-50"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(lnk)}
                  className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Social Link Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Social Profile' : 'Edit Social Profile'}
        maxWidthClass="max-w-lg"
      >
        {editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Platform</label>
                <select
                  value={editing.platform}
                  onChange={(e) => {
                    const p = e.target.value as FooterSocialLinkConfig['platform'];
                    setEditing({
                      ...editing,
                      platform: p,
                      label: PLATFORM_LABELS[p] || editing.label,
                    });
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  {FOOTER_SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {PLATFORM_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Label</label>
                <input
                  type="text"
                  required
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Profile URL</label>
                <input
                  type="url"
                  required
                  value={editing.url}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Icon Source</label>
                <select
                  value={editing.iconType}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      iconType: e.target.value as FooterSocialLinkConfig['iconType'],
                    })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="brand">Built-in Platform Icon</option>
                  <option value="svg">Custom SVG</option>
                  <option value="image">Custom Uploaded Icon</option>
                </select>
              </div>
              <div className="flex items-end gap-4 text-xs font-semibold text-slate-700 pb-2">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editing.openInNewTab}
                    onChange={(e) => setEditing({ ...editing, openInNewTab: e.target.checked })}
                  />
                  <span>New Tab</span>
                </label>
              </div>
              {editing.iconType === 'svg' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom SVG Markup
                  </label>
                  <textarea
                    rows={3}
                    value={editing.iconSvg || ''}
                    onChange={(e) => setEditing({ ...editing, iconSvg: e.target.value })}
                    placeholder='<svg viewBox="0 0 24 24"><path d="..." /></svg>'
                    className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-xs"
                  />
                </div>
              )}
              {editing.iconType === 'image' && (
                <div className="sm:col-span-2 space-y-2">
                  <CloudinaryUploadField
                    folder="footer"
                    label="Upload Social Icon"
                    onUploaded={(asset) =>
                      setEditing({
                        ...editing,
                        iconImageUrl: asset.url,
                        iconImagePublicId: asset.publicId,
                      })
                    }
                  />
                  <input
                    type="text"
                    value={editing.iconImageUrl || ''}
                    onChange={(e) => setEditing({ ...editing, iconImageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold"
              >
                Save Social Link
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            commitLinks(sortedLinks.filter((l) => l.id !== deleting.id));
            setDeleting(null);
          }
        }}
        title="Delete Social Link"
        message={`Remove ${deleting?.label} from footer social icons?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

interface FooterNewsletterTabProps {
  newsletter: FooterNewsletterConfig;
  onChange: (next: FooterNewsletterConfig) => void;
}

export function FooterNewsletterTab({ newsletter, onChange }: FooterNewsletterTabProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Newsletter Subscription Box</h2>
          <p className="text-xs text-slate-500">
            Connected live to backend subscriber storage (/api/support/newsletter/subscribe).
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
          <input
            type="checkbox"
            checked={newsletter.enabled}
            onChange={(e) => onChange({ ...newsletter, enabled: e.target.checked })}
          />
          <span>Enable Newsletter Section</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Placement</label>
          <select
            value={newsletter.placement}
            onChange={(e) =>
              onChange({
                ...newsletter,
                placement: e.target.value as FooterNewsletterConfig['placement'],
              })
            }
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          >
            <option value="top_banner">Top Full-Width Strip</option>
            <option value="column">Inside Main Footer Grid Column</option>
            <option value="above_bottom_bar">Above Bottom Copyright Bar</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Heading</label>
          <input
            type="text"
            value={newsletter.heading}
            onChange={(e) => onChange({ ...newsletter, heading: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
          <textarea
            rows={2}
            value={newsletter.description}
            onChange={(e) => onChange({ ...newsletter, description: e.target.value })}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Input Placeholder</label>
          <input
            type="text"
            value={newsletter.inputPlaceholder}
            onChange={(e) => onChange({ ...newsletter, inputPlaceholder: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Button Label</label>
          <input
            type="text"
            value={newsletter.buttonLabel}
            onChange={(e) => onChange({ ...newsletter, buttonLabel: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Consent Label</label>
          <input
            type="text"
            value={newsletter.consentLabel}
            onChange={(e) => onChange({ ...newsletter, consentLabel: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Success Message</label>
          <input
            type="text"
            value={newsletter.successMessage}
            onChange={(e) => onChange({ ...newsletter, successMessage: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Duplicate Email Message</label>
          <input
            type="text"
            value={newsletter.duplicateMessage}
            onChange={(e) => onChange({ ...newsletter, duplicateMessage: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Generic Error Message</label>
          <input
            type="text"
            value={newsletter.errorMessage}
            onChange={(e) => onChange({ ...newsletter, errorMessage: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={newsletter.requireConsent}
              onChange={(e) => onChange({ ...newsletter, requireConsent: e.target.checked })}
            />
            <span>Require Consent Checkbox</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={newsletter.backgroundColor}
            onChange={(e) => onChange({ ...newsletter, backgroundColor: e.target.value })}
            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
          />
          <span>Box Background</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={newsletter.textColor}
            onChange={(e) => onChange({ ...newsletter, textColor: e.target.value })}
            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
          />
          <span>Box Text</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={newsletter.buttonBgColor}
            onChange={(e) => onChange({ ...newsletter, buttonBgColor: e.target.value })}
            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
          />
          <span>Button Background</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="color"
            value={newsletter.buttonTextColor}
            onChange={(e) => onChange({ ...newsletter, buttonTextColor: e.target.value })}
            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
          />
          <span>Button Text</span>
        </label>
      </div>
    </div>
  );
}
