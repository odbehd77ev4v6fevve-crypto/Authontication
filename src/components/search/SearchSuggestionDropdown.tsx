import { ArrowRight, Loader2, Search, Sparkles, Tag } from 'lucide-react';
import { buildHighlightSegments } from '../../../shared/searchHelpers.ts';
import { formatBdt } from '../../lib/api.ts';
import type { SearchSuggestionItem, SearchSuggestionsUiConfig } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

interface SearchSuggestionDropdownProps {
  open: boolean;
  listboxId: string;
  query: string;
  suggestions: SearchSuggestionItem[];
  popularSearches: string[];
  expandedTerms?: string[];
  loading: boolean;
  error: boolean;
  activeIndex: number;
  uiConfig: SearchSuggestionsUiConfig;
  maxHeightPx?: number;
  onSelectSuggestion: (item: SearchSuggestionItem) => void;
  onSelectPopular: (term: string) => void;
  onViewAll: () => void;
}

const MATCH_SOURCE_LABELS: Record<string, string> = {
  exact_title: 'Exact Match',
  exact_sku: 'SKU Match',
  brand: 'Brand Match',
  category: 'Category Match',
  tags: 'Keyword Match',
  attribute: 'Spec / Variant Match',
  description: 'Description Match',
  synonym: 'Smart Synonym',
  transliteration: 'Phonetic Match',
};

function HighlightedText({
  text,
  query,
  extraTerms,
  enabled,
}: {
  text: string;
  query: string;
  extraTerms: string[];
  enabled: boolean;
}) {
  if (!enabled || !query.trim()) {
    return <>{text}</>;
  }
  const segments = buildHighlightSegments(text, query, extraTerms);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.highlight ? (
          <mark
            key={`${idx}-${seg.text}`}
            className="bg-emerald-100 text-emerald-950 rounded-xs px-0.5 font-semibold"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={`${idx}-${seg.text}`}>{seg.text}</span>
        )
      )}
    </>
  );
}

export function SearchSuggestionDropdown({
  open,
  listboxId,
  query,
  suggestions,
  popularSearches,
  expandedTerms = [],
  loading,
  error,
  activeIndex,
  uiConfig,
  maxHeightPx = 420,
  onSelectSuggestion,
  onSelectPopular,
  onViewAll,
}: SearchSuggestionDropdownProps) {
  if (!open) return null;

  const trimmedQuery = query.trim();
  const effectivePopular =
    popularSearches.length > 0
      ? popularSearches
      : ['Smartphone', 'মোটিভেশনাল বই', 'মোবাইল', 'ল্যাপটপ', 'Smartwatch'];

  const panelStyle = {
    '--search-dropdown-max-h': `${Math.max(220, Math.min(720, maxHeightPx))}px`,
  } as React.CSSProperties;

  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label="Search suggestions"
      style={panelStyle}
      className="search-dropdown-panel mega-menu-scroll absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-y-auto overflow-x-hidden"
    >
      {error ? (
        <div className="p-4 text-sm text-slate-500 flex items-center justify-between gap-3">
          <span>Live suggestions unavailable right now. Press Enter to search the catalog.</span>
          {trimmedQuery && (
            <button
              type="button"
              onClick={onViewAll}
              className="shrink-0 text-xs font-bold text-[#16A34A] hover:underline"
            >
              Search Now →
            </button>
          )}
        </div>
      ) : trimmedQuery.length === 0 ? (
        uiConfig.showPopularWhenEmpty ? (
          <div className="p-3.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1.5 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Popular Searches (English &amp; বাংলা)</span>
            </p>
            <div className="flex flex-wrap gap-2 px-1.5 pb-1">
              {effectivePopular.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onSelectPopular(term)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold text-slate-700 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-slate-500">
            Type a product name, category, brand, or SKU in English or বাংলা.
          </div>
        )
      ) : loading && suggestions.length === 0 ? (
        <div className="p-3 space-y-2.5" aria-busy="true" aria-label="Loading search suggestions">
          <div className="flex items-center gap-2 px-1 text-xs font-medium text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16A34A]" />
            <span>Searching catalog across English &amp; বাংলা...</span>
          </div>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 animate-pulse">
              <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/3 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="p-5 text-center space-y-2">
          <Search className="w-5 h-5 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">
            No quick matches for &quot;{trimmedQuery}&quot;
          </p>
          <p className="text-xs text-slate-500">
            Try searching in English or বাংলা (e.g. মোবাইল, iPhone, ল্যাপটপ, জুতা, বই), or press Enter for full catalog search.
          </p>
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-[#16A34A] text-xs font-bold hover:bg-emerald-100"
          >
            <span>Search Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {suggestions.map((item, idx) => {
            const outOfStock = item.availableStock <= 0 && !item.allowBackorders;
            const lowStock = !outOfStock && item.availableStock > 0 && item.availableStock <= 5;
            const matchBadge =
              uiConfig.showMatchedFieldHint &&
              item.matchedField &&
              item.matchedField !== 'title'
                ? MATCH_SOURCE_LABELS[item.matchedField] || ''
                : '';

            return (
              <button
                key={item.id}
                id={`${listboxId}-opt-${idx}`}
                type="button"
                role="option"
                aria-selected={activeIndex === idx}
                onClick={() => onSelectSuggestion(item)}
                className={`w-full flex items-center gap-3 p-2.5 sm:px-3.5 text-left transition-colors ${
                  activeIndex === idx ? 'bg-emerald-50/90' : 'hover:bg-slate-50'
                }`}
              >
                {uiConfig.showThumbnails && (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 overflow-hidden shrink-0">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      fallbackLabel={item.name}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      <HighlightedText
                        text={item.name}
                        query={trimmedQuery}
                        extraTerms={expandedTerms}
                        enabled={uiConfig.highlightMatches}
                      />
                    </p>
                    {uiConfig.showStockStatus && (
                      <span
                        className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          outOfStock
                            ? 'bg-red-50 text-red-600'
                            : lowStock
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {outOfStock ? 'Out of Stock' : lowStock ? `Only ${item.availableStock} left` : 'In Stock'}
                      </span>
                    )}
                  </div>

                  {item.nameBn && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      <HighlightedText
                        text={item.nameBn}
                        query={trimmedQuery}
                        extraTerms={expandedTerms}
                        enabled={uiConfig.highlightMatches}
                      />
                    </p>
                  )}

                  <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-1">
                    {uiConfig.showPrice && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-extrabold text-[#16A34A] tabular-nums">
                          {formatBdt(item.effectivePrice)}
                        </span>
                        {item.originalPrice && item.originalPrice > item.effectivePrice && (
                          <span className="text-[11px] text-slate-400 line-through tabular-nums">
                            {formatBdt(item.originalPrice)}
                          </span>
                        )}
                        {item.discountPercent > 0 && (
                          <span className="text-[10px] font-bold text-red-600 tabular-nums">
                            -{item.discountPercent}%
                          </span>
                        )}
                      </div>
                    )}

                    {(uiConfig.showBrand && item.brandName) || (uiConfig.showCategory && item.categoryName) ? (
                      <span className="text-[11px] text-slate-500 truncate">
                        {[
                          uiConfig.showBrand ? item.brandName : '',
                          uiConfig.showCategory ? item.categoryName : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}

                    {matchBadge && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                        <Tag className="w-2.5 h-2.5" />
                        <span>{matchBadge}</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onViewAll}
            className="sticky bottom-0 w-full py-2.5 px-4 bg-slate-50/95 backdrop-blur-xs border-t border-slate-100 text-xs font-bold text-[#16A34A] hover:bg-emerald-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>View all results for &quot;{trimmedQuery}&quot;</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
