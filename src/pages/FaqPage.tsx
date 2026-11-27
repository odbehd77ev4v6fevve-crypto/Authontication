import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../components/ui/SeoHead.tsx';
import { apiRequest, ApiError } from '../lib/api.ts';
import type { FaqItem, StoreSettings } from '../types/domain.ts';

export function FaqPage({ storeSettings }: { storeSettings?: StoreSettings | null }) {
  const storeName = storeSettings?.storeName || 'NOVARA COMMERCE';
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbOffline, setDbOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ faqs: FaqItem[] }>('/api/cms/public/faqs')
      .then((res) => {
        const list = res.faqs || [];
        setFaqs(list);
        if (list[0]?._id) setOpenId(list[0]._id);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 503) {
          setDbOffline(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(faqs.map((f) => f.category).filter(Boolean)));
    return ['All', ...unique];
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [faqs, selectedCategory, search]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
      <SeoHead
        title={`Frequently Asked Questions | ${storeName}`}
        description={`Answers about Cash on Delivery, shipping across Bangladesh, returns, and order tracking on ${storeName}.`}
      />

      <div className="bg-gradient-to-r from-[#0B1A2B] to-[#0E2F23] rounded-2xl p-7 sm:p-10 text-white space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <HelpCircle className="w-4 h-4" />
          <span>Help & Answers</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-slate-300 max-w-2xl">
          Quick answers covering delivery charges, Cash on Delivery, SSLCommerz/bKash payments, and our 7-day easy return policy.
        </p>

        <div className="relative max-w-md pt-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 mt-0.5" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            aria-label="Search FAQs"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">
            {dbOffline ? 'FAQs Temporarily Offline' : 'No Matching Questions'}
          </h2>
          <p className="text-sm text-slate-500">
            {dbOffline
              ? 'Database connection is unavailable right now.'
              : 'Need direct assistance? Our Dhaka support team is ready to help.'}
          </p>
          <Link
            to="/contact"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold"
          >
            Contact Support
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = openId === faq._id;
            return (
              <div
                key={faq._id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq._id)}
                  aria-expanded={isOpen}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      {faq.category || 'General'}
                    </span>
                    <p className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                      {faq.question}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 whitespace-pre-line">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Still have questions?</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Reach out to our support team for order tracking, bulk inquiries, or returns.
          </p>
        </div>
        <Link
          to="/contact"
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
