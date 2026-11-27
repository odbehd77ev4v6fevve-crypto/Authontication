import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { BannerRenderer } from '../components/marketing/BannerRenderer.tsx';
import { SeoHead } from '../components/ui/SeoHead.tsx';
import { apiRequest, ApiError } from '../lib/api.ts';
import type { StaticPage, StoreSettings } from '../types/domain.ts';

export function CustomStaticPage({ storeSettings }: { storeSettings?: StoreSettings | null }) {
  const { slug } = useParams<{ slug: string }>();
  const storeName = storeSettings?.storeName || 'NOVARA COMMERCE';

  const [page, setPage] = useState<StaticPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dbOffline, setDbOffline] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    setDbOffline(false);

    apiRequest<{ page: StaticPage }>(`/api/cms/public/pages/${encodeURIComponent(slug)}`)
      .then((res) => {
        setPage(res.page);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 503) {
          setDbOffline(true);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-14 space-y-4">
        <div className="h-10 w-2/3 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-64 w-full rounded-2xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (notFound || dbOffline || !page) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <SeoHead title={`Page Unavailable | ${storeName}`} noindex />
        <h1 className="text-2xl font-extrabold text-slate-900">
          {dbOffline ? 'Page Temporarily Offline' : 'Page Not Found'}
        </h1>
        <p className="text-sm text-slate-600">
          {dbOffline
            ? 'Database connection is unavailable right now.'
            : 'The requested page could not be found or is not currently published.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-6">
      <SeoHead
        title={`${page.seoTitle || page.title} | ${storeName}`}
        description={page.seoDescription || `${page.title} on ${storeName}`}
      />

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Storefront</span>
      </Link>

      <BannerRenderer position="custom_cms_page" pageSlug={slug} />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-6">
        <div className="border-b border-slate-100 pb-5 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <FileText className="w-3.5 h-3.5" />
            <span>{page.pageType === 'policy' ? 'Store Policy' : 'Information'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{page.title}</h1>
          {page.updatedAt && (
            <p className="text-xs text-slate-400">
              Last updated: {new Date(page.updatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
            </p>
          )}
        </div>

        <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
          {page.content}
        </div>
      </div>
    </div>
  );
}
