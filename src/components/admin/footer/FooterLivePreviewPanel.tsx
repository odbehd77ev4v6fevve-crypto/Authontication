import { useState } from 'react';
import { Eye, Monitor, Smartphone, Tablet } from 'lucide-react';
import type {
  FooterConfigPayload,
  StorePaymentMethodFlag,
} from '../../../../shared/footerHelpers.ts';
import { FooterRenderer } from '../../layout/FooterRenderer.tsx';

interface FooterLivePreviewPanelProps {
  config: FooterConfigPayload;
  storePaymentMethods: StorePaymentMethodFlag[];
  onClose?: () => void;
}

export function FooterLivePreviewPanel({
  config,
  storePaymentMethods,
}: FooterLivePreviewPanelProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const frameWidthClass =
    viewport === 'mobile'
      ? 'max-w-[390px] mx-auto'
      : viewport === 'tablet'
      ? 'max-w-[768px] mx-auto'
      : 'w-full';

  return (
    <div
      data-testid="footer-live-preview-panel"
      className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-[#15803D] flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900">Real-Time Draft Preview</h3>
            <p className="text-[11px] text-slate-500">
              Updates instantly as you edit. Public site updates only after Publish.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {(
            [
              { id: 'desktop', label: 'Desktop', icon: Monitor },
              { id: 'tablet', label: 'Tablet', icon: Tablet },
              { id: 'mobile', label: 'Mobile', icon: Smartphone },
            ] as const
          ).map((vp) => {
            const Icon = vp.icon;
            const active = viewport === vp.id;
            return (
              <button
                key={vp.id}
                type="button"
                onClick={() => setViewport(vp.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#16A34A] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{vp.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-slate-100/80 overflow-x-auto">
        <div className={`${frameWidthClass} transition-all duration-200 rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white`}>
          <div className="px-3 py-1.5 bg-slate-900 text-[10px] text-slate-400 flex items-center justify-between">
            <span>ShopVista Storefront Preview ({viewport})</span>
            <span className="tabular-nums">
              {viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '768px' : '1280px+'}
            </span>
          </div>
          <FooterRenderer
            config={config}
            storePaymentMethods={storePaymentMethods}
            previewMode
            previewViewport={viewport}
            onAdminAccessClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
