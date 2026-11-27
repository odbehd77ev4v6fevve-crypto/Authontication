import { useEffect, useState } from 'react';
import { Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import { apiRequest } from '../../../lib/api.ts';
import type { NavigationMenuRecord } from '../../../types/domain.ts';
import { MegaMenuOverlay } from '../../navigation/MegaMenuOverlay.tsx';
import { MobileNavigationDrawer } from '../../navigation/MobileNavigationDrawer.tsx';

interface LiveMenuPreviewPanelProps {
  menu: NavigationMenuRecord;
}

export function LiveMenuPreviewPanel({ menu }: LiveMenuPreviewPanelProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [resolvedPreview, setResolvedPreview] = useState<NavigationMenuRecord>(menu);
  const [loading, setLoading] = useState(false);

  const fetchServerPreview = async () => {
    if (!menu._id || menu._id.startsWith('new')) {
      setResolvedPreview(menu);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ menu: NavigationMenuRecord }>(
        `/api/navigation/admin/menus/${menu._id}/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: menu.name,
            menuType: menu.menuType,
            categoryMode: menu.categoryMode,
            includedCategoryIds: menu.includedCategoryIds,
            excludedCategoryIds: menu.excludedCategoryIds,
            megaMenuConfig: menu.megaMenuConfig,
            appearanceConfig: menu.appearanceConfig,
            responsiveConfig: menu.responsiveConfig,
            sliderSettings: menu.sliderSettings,
            includeInactiveSlides: false,
          }),
        }
      );
      if (res?.menu) {
        setResolvedPreview(res.menu);
      }
    } catch {
      // Fallback cleanly to current draft object when offline or preview fails
      setResolvedPreview(menu);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchServerPreview();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [menu]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Real-Time Responsive Menu Preview</h3>
          <p className="text-xs text-slate-500">
            Hover left categories, test promo slider controls, and switch viewports before publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1">
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewport === key
                    ? 'bg-[#16A34A] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void fetchServerPreview()}
            aria-label="Refresh preview"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#16A34A]' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 overflow-x-auto">
        {viewport === 'mobile' ? (
          <MobileNavigationDrawer
            open
            onClose={() => {}}
            storeName="ShopVista"
            allCategoriesMenu={resolvedPreview}
            mainNavItems={resolvedPreview.items || []}
            mobileMenuConfig={resolvedPreview}
            categoriesTree={resolvedPreview.categoriesTree || []}
            previewMode
          />
        ) : (
          <div
            className={`mx-auto transition-all ${
              viewport === 'tablet' ? 'max-w-[780px]' : 'max-w-[1220px]'
            }`}
          >
            <MegaMenuOverlay
              menu={resolvedPreview}
              onClose={() => {}}
              previewMode
              forcedViewport={viewport}
            />
          </div>
        )}
      </div>
    </div>
  );
}
