export type QueryLanguage = 'bn' | 'en' | 'mixed';
export type DeviceScope = 'all' | 'desktop' | 'mobile';
export type PlaceholderTransitionBehavior = 'type_and_erase' | 'fade_cycle' | 'instant_cycle';
export type OutOfStockBehavior = 'show' | 'demote' | 'hide';

export interface SearchRelevanceWeights {
  exactTitle: number;
  exactSku: number;
  titleKeyword: number;
  brand: number;
  category: number;
  tags: number;
  attribute: number;
  description: number;
  synonymTranslit: number;
}

export interface SearchEngineConfig {
  smartSearchEnabled: boolean;
  crossLanguageEnabled: boolean;
  synonymMatchingEnabled: boolean;
  transliterationEnabled: boolean;
  minQueryLength: number;
  debounceMs: number;
  maxSuggestions: number;
  dropdownMaxHeightPx: number;
  outOfStockBehavior: OutOfStockBehavior;
  relevanceWeights: SearchRelevanceWeights;
}

export interface SearchPlaceholderAnimationConfig {
  enabled: boolean;
  typingSpeedMs: number;
  erasingSpeedMs: number;
  pauseAfterCompleteMs: number;
  delayBeforeNextMs: number;
  startDelayMs: number;
  loop: boolean;
  showCursor: boolean;
  cursorChar: string;
  cursorBlinkSpeedMs: number;
  transitionBehavior: PlaceholderTransitionBehavior;
  pauseOnFocus: boolean;
  resumeOnBlur: boolean;
  desktopEnabled: boolean;
  mobileEnabled: boolean;
  fallbackStaticText: string;
}

export interface SearchSuggestionsUiConfig {
  showThumbnails: boolean;
  showBrand: boolean;
  showCategory: boolean;
  showPrice: boolean;
  showStockStatus: boolean;
  showPopularWhenEmpty: boolean;
  highlightMatches: boolean;
  showMatchedFieldHint: boolean;
}

export interface SearchPlaceholderMessageItem {
  _id?: string;
  text: string;
  language: QueryLanguage;
  isEnabled: boolean;
  displayOrder: number;
  deviceScope: DeviceScope;
  notes?: string;
}

export interface SearchSynonymEntry {
  _id?: string;
  primaryTerm: string;
  aliases: string[];
  languagePair?: string;
  categoryHint?: string;
  isActive: boolean;
  priority?: number;
}

export interface PublicSearchConfig {
  engine: SearchEngineConfig;
  placeholderAnimation: SearchPlaceholderAnimationConfig;
  suggestionsUi: SearchSuggestionsUiConfig;
  placeholders: SearchPlaceholderMessageItem[];
}

export const DEFAULT_RELEVANCE_WEIGHTS: SearchRelevanceWeights = {
  exactTitle: 1000,
  exactSku: 950,
  titleKeyword: 600,
  brand: 450,
  category: 380,
  tags: 320,
  attribute: 260,
  description: 140,
  synonymTranslit: 220,
};

export const DEFAULT_SEARCH_ENGINE_CONFIG: SearchEngineConfig = {
  smartSearchEnabled: true,
  crossLanguageEnabled: true,
  synonymMatchingEnabled: true,
  transliterationEnabled: true,
  minQueryLength: 1,
  debounceMs: 220,
  maxSuggestions: 8,
  dropdownMaxHeightPx: 420,
  outOfStockBehavior: 'demote',
  relevanceWeights: { ...DEFAULT_RELEVANCE_WEIGHTS },
};

export const DEFAULT_PLACEHOLDER_ANIMATION_CONFIG: SearchPlaceholderAnimationConfig = {
  enabled: true,
  typingSpeedMs: 65,
  erasingSpeedMs: 36,
  pauseAfterCompleteMs: 1800,
  delayBeforeNextMs: 360,
  startDelayMs: 250,
  loop: true,
  showCursor: true,
  cursorChar: '|',
  cursorBlinkSpeedMs: 530,
  transitionBehavior: 'type_and_erase',
  pauseOnFocus: true,
  resumeOnBlur: true,
  desktopEnabled: true,
  mobileEnabled: true,
  fallbackStaticText: 'Search products in English or বাংলা...',
};

export const DEFAULT_SUGGESTIONS_UI_CONFIG: SearchSuggestionsUiConfig = {
  showThumbnails: true,
  showBrand: true,
  showCategory: true,
  showPrice: true,
  showStockStatus: true,
  showPopularWhenEmpty: true,
  highlightMatches: true,
  showMatchedFieldHint: true,
};

export const DEFAULT_SEED_PLACEHOLDERS: SearchPlaceholderMessageItem[] = [
  {
    text: 'Search iPhone, মোবাইল, ল্যাপটপ বা টি-শার্ট...',
    language: 'mixed',
    isEnabled: true,
    displayOrder: 0,
    deviceScope: 'all',
    notes: 'Primary bilingual storefront prompt',
  },
  {
    text: 'মোবাইল, স্মার্টওয়াচ বা হেডফোন খুঁজুন...',
    language: 'bn',
    isEnabled: true,
    displayOrder: 1,
    deviceScope: 'all',
    notes: 'Bengali electronics discovery prompt',
  },
  {
    text: 'Search Laptop, Shoes, Skincare or Books...',
    language: 'en',
    isEnabled: true,
    displayOrder: 2,
    deviceScope: 'all',
    notes: 'English multi-category prompt',
  },
  {
    text: 'আইফোন, স্যামসাং বা জুতা লিখে সার্চ করুন...',
    language: 'bn',
    isEnabled: true,
    displayOrder: 3,
    deviceScope: 'all',
    notes: 'Bengali brand and fashion prompt',
  },
  {
    text: 'Search by product name, brand, or SKU...',
    language: 'en',
    isEnabled: true,
    displayOrder: 4,
    deviceScope: 'desktop',
    notes: 'Desktop power-buyer prompt',
  },
  {
    text: 'সার্চ করুন মোবাইল, ল্যাপটপ, বই...',
    language: 'bn',
    isEnabled: true,
    displayOrder: 5,
    deviceScope: 'mobile',
    notes: 'Concise mobile search prompt',
  },
];

export const DEFAULT_SEED_SYNONYMS: SearchSynonymEntry[] = [
  {
    primaryTerm: 'mobile',
    aliases: ['মোবাইল', 'ফোন', 'স্মার্টফোন', 'smartphone', 'phone', 'cellphone', 'handset', 'mobile phone'],
    languagePair: 'bn-en',
    categoryHint: 'Smartphones',
    isActive: true,
    priority: 100,
  },
  {
    primaryTerm: 'iphone',
    aliases: ['আইফোন', 'আই ফোন', 'apple iphone', 'ios phone', 'apple mobile'],
    languagePair: 'bn-en',
    categoryHint: 'Smartphones',
    isActive: true,
    priority: 100,
  },
  {
    primaryTerm: 'apple',
    aliases: ['অ্যাপল', 'এপল', 'macbook', 'ম্যাকবুক', 'ipad', 'আইপ্যাড'],
    languagePair: 'bn-en',
    categoryHint: 'Electronics',
    isActive: true,
    priority: 95,
  },
  {
    primaryTerm: 'samsung',
    aliases: ['স্যামসাং', 'সামসাং', 'galaxy', 'গ্যালাক্সি'],
    languagePair: 'bn-en',
    categoryHint: 'Smartphones',
    isActive: true,
    priority: 95,
  },
  {
    primaryTerm: 'laptop',
    aliases: ['ল্যাপটপ', 'নোটবুক', 'কম্পিউটার', 'notebook', 'ultrabook', 'computer', 'pc'],
    languagePair: 'bn-en',
    categoryHint: 'Laptops',
    isActive: true,
    priority: 100,
  },
  {
    primaryTerm: 'smartwatch',
    aliases: ['স্মার্টওয়াচ', 'স্মার্ট ওয়াচ', 'স্মার্ট ওয়াচ', 'ঘড়ি', 'smart watch', 'watch', 'ghori', 'fitness watch'],
    languagePair: 'bn-en',
    categoryHint: 'Wearables',
    isActive: true,
    priority: 100,
  },
  {
    primaryTerm: 'shoes',
    aliases: ['জুতা', 'জুতো', 'স্নিকার্স', 'juta', 'shoe', 'sneaker', 'sneakers', 'footwear', 'loafers'],
    languagePair: 'bn-en',
    categoryHint: 'Fashion',
    isActive: true,
    priority: 100,
  },
  {
    primaryTerm: 't-shirt',
    aliases: ['টি শার্ট', 'টি-শার্ট', 'টিশার্ট', 'tshirt', 't shirt', 'tee', 'polo shirt', 'জামা', 'শার্ট', 'shirt'],
    languagePair: 'bn-en',
    categoryHint: 'Fashion',
    isActive: true,
    priority: 100,
  },
  {
    primaryTerm: 'hoodie',
    aliases: ['হুডি', 'সোয়েটশার্ট', 'জ্যাকেট', 'sweatshirt', 'jacket', 'winter wear'],
    languagePair: 'bn-en',
    categoryHint: 'Fashion',
    isActive: true,
    priority: 90,
  },
  {
    primaryTerm: 'headphones',
    aliases: ['হেডফোন', 'ইয়ারবাড', 'ইয়ারবাডস', 'ইয়ারফোন', 'earbuds', 'earphone', 'earphones', 'airpods', 'anc audio'],
    languagePair: 'bn-en',
    categoryHint: 'Accessories',
    isActive: true,
    priority: 95,
  },
  {
    primaryTerm: 'speaker',
    aliases: ['স্পিকার', 'সাউন্ড', 'ব্লুটুথ স্পিকার', 'bluetooth speaker', 'soundbox', 'audio'],
    languagePair: 'bn-en',
    categoryHint: 'Accessories',
    isActive: true,
    priority: 85,
  },
  {
    primaryTerm: 'backpack',
    aliases: ['ব্যাকপ্যাক', 'ব্যাগ', 'স্কুল ব্যাগ', 'bag', 'bags', 'laptop bag', 'travel bag', 'commuter'],
    languagePair: 'bn-en',
    categoryHint: 'Home & Living',
    isActive: true,
    priority: 90,
  },
  {
    primaryTerm: 'book',
    aliases: ['বই', 'পুস্তক', 'কিতাব', 'উপন্যাস', 'গল্প', 'books', 'boi', 'novel', 'fiction', 'story', 'literature'],
    languagePair: 'bn-en',
    categoryHint: 'Books',
    isActive: true,
    priority: 95,
  },
  {
    primaryTerm: 'motivational',
    aliases: ['মোটিভেশনাল', 'অনুপ্রেরণামূলক', 'উন্নয়নমূলক', 'self-help', 'self help', 'inspiration'],
    languagePair: 'bn-en',
    categoryHint: 'Books',
    isActive: true,
    priority: 90,
  },
  {
    primaryTerm: 'skincare',
    aliases: ['স্কিনকেয়ার', 'ত্বক', 'সৌন্দর্য', 'সাবান', 'সিরাম', 'ক্রিম', 'beauty', 'serum', 'cream', 'cleanser', 'facewash'],
    languagePair: 'bn-en',
    categoryHint: 'Beauty & Care',
    isActive: true,
    priority: 90,
  },
  {
    primaryTerm: 'fashion',
    aliases: ['ফ্যাশন', 'পোশাক', 'জামা', 'কাপড়', 'apparel', 'clothing', 'jama', 'garments'],
    languagePair: 'bn-en',
    categoryHint: 'Fashion',
    isActive: true,
    priority: 90,
  },
  {
    primaryTerm: 'electronics',
    aliases: ['ইলেকট্রনিক্স', 'গ্যাজেট', 'টেক', 'gadget', 'gadgets', 'tech', 'devices'],
    languagePair: 'bn-en',
    categoryHint: 'Electronics',
    isActive: true,
    priority: 85,
  },
  {
    primaryTerm: 'charger',
    aliases: ['চার্জার', 'অ্যাডাপ্টার', 'ক্যাবল', 'adapter', 'cable', 'fast charger', 'power adapter'],
    languagePair: 'bn-en',
    categoryHint: 'Accessories',
    isActive: true,
    priority: 85,
  },
  {
    primaryTerm: 'power bank',
    aliases: ['পাওয়ার ব্যাংক', 'পাওয়ার ব্যাংক', 'powerbank', 'portable charger'],
    languagePair: 'bn-en',
    categoryHint: 'Accessories',
    isActive: true,
    priority: 85,
  },
  {
    primaryTerm: 'sports',
    aliases: ['খেলাধুলা', 'ফুটবল', 'ক্রিকেট', 'ব্যাট', 'ফিটনেস', 'football', 'cricket', 'fitness', 'gym'],
    languagePair: 'bn-en',
    categoryHint: 'Sports',
    isActive: true,
    priority: 80,
  },
  {
    primaryTerm: 'home',
    aliases: ['ঘর', 'হোম', 'সোফা', 'আসবাব', 'লাইট', 'living', 'furniture', 'lamp', 'decor'],
    languagePair: 'bn-en',
    categoryHint: 'Home & Living',
    isActive: true,
    priority: 80,
  },
  {
    primaryTerm: 'keyboard',
    aliases: ['কীবোর্ড', 'কিবোর্ড', 'mechanical keyboard'],
    languagePair: 'bn-en',
    categoryHint: 'Accessories',
    isActive: true,
    priority: 80,
  },
  {
    primaryTerm: 'mouse',
    aliases: ['মাউস', 'ওয়্যারলেস মাউস', 'gaming mouse'],
    languagePair: 'bn-en',
    categoryHint: 'Accessories',
    isActive: true,
    priority: 80,
  },
];

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'ও',
  'এবং',
  'বা',
  'এর',
  'জন্য',
  'থেকে',
  'দিয়ে',
  'দিয়ে',
]);

export function normalizeSearchText(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFC')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Canonicalize decomposed nukta forms in Bengali
    .replace(/\u09AF\u09BC/g, '\u09DF') // য + ় -> য়
    .replace(/\u09A1\u09BC/g, '\u09DC') // ড + ় -> ড়
    .replace(/\u09A2\u09BC/g, '\u09DD') // ঢ + ় -> ঢ়
    // Normalize common Bangla spelling variants ("ওয়া" vs "ওয়া", "ওয়" vs "ওয়")
    .replace(/ওয়া/g, 'ওয়া')
    .replace(/ওয়/g, 'ওয়')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectQueryLanguage(raw: string): QueryLanguage {
  const text = raw || '';
  const hasBn = /[\u0980-\u09FF]/.test(text);
  const hasEn = /[a-zA-Z]/.test(text);
  if (hasBn && hasEn) return 'mixed';
  if (hasBn) return 'bn';
  return 'en';
}

const BN_INDEPENDENT_VOWELS: Record<string, string> = {
  অ: 'o',
  আ: 'a',
  ই: 'i',
  ঈ: 'i',
  উ: 'u',
  ঊ: 'u',
  ঋ: 'ri',
  এ: 'e',
  ঐ: 'oi',
  ও: 'o',
  ঔ: 'ou',
};

const BN_VOWEL_SIGNS: Record<string, string> = {
  'া': 'a',
  'ি': 'i',
  'ী': 'i',
  'ু': 'u',
  'ূ': 'u',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
};

const BN_CONSONANTS: Record<string, string> = {
  ক: 'k',
  খ: 'kh',
  গ: 'g',
  ঘ: 'gh',
  ঙ: 'ng',
  চ: 'ch',
  ছ: 'chh',
  জ: 'j',
  ঝ: 'jh',
  ঞ: 'n',
  ট: 't',
  ঠ: 'th',
  ড: 'd',
  ঢ: 'dh',
  ণ: 'n',
  ত: 't',
  থ: 'th',
  দ: 'd',
  ধ: 'dh',
  ন: 'n',
  প: 'p',
  ফ: 'f',
  ব: 'b',
  ভ: 'v',
  ম: 'm',
  য: 'j',
  র: 'r',
  ল: 'l',
  শ: 's',
  ষ: 'sh',
  স: 's',
  হ: 'h',
  ড়: 'r',
  ঢ়: 'rh',
  য়: 'y',
  ৎ: 't',
};

const BN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const BN_SPECIAL_WORD_TRANSLIT: Record<string, string[]> = {
  অ্যাপল: ['apple'],
  এপল: ['apple'],
  অ্যান্ড্রয়েড: ['android'],
  আইফোন: ['iphone'],
  স্যামসাং: ['samsung'],
  সামসাং: ['samsung'],
  শাওমি: ['xiaomi'],
  রিয়েলমি: ['realme'],
  অপ্পো: ['oppo'],
  ভিভো: ['vivo'],
  ওয়ানপ্লাস: ['oneplus'],
  ম্যাকবুক: ['macbook'],
  ল্যাপটপ: ['laptop'],
  স্মার্টফোন: ['smartphone'],
  স্মার্টওয়াচ: ['smartwatch'],
  ওয়াচ: ['watch'],
  মোবাইল: ['mobile'],
  হেডফোন: ['headphone', 'headphones'],
  ইয়ারবাড: ['earbud', 'earbuds'],
  ইয়ারবাডস: ['earbuds'],
  ব্যাকপ্যাক: ['backpack'],
  টি: ['t'],
  শার্ট: ['shirt'],
  টিশার্ট: ['tshirt', 't-shirt'],
  হুডি: ['hoodie'],
  স্নিকার্স: ['sneakers'],
  স্কিনকেয়ার: ['skincare'],
};

/**
 * Rule-based Bengali -> Latin transliteration tuned for brand names and product terms.
 */
export function transliterateBnToLatin(raw: string): string {
  const normalized = normalizeSearchText(raw);
  if (!normalized) return '';
  if (!/[\u0980-\u09FF]/.test(normalized)) return normalized;

  const words = normalized.split(' ');
  const outWords = words.map((word) => {
    if (BN_SPECIAL_WORD_TRANSLIT[word]) {
      return BN_SPECIAL_WORD_TRANSLIT[word][0];
    }

    // Common Bengali compound prefixes like ওয় -> w, অ্য -> a
    const prep = word
      .replace(/অ্যা/g, 'a')
      .replace(/ওয়/g, 'w')
      .replace(/য়/g, 'y');

    let out = '';
    const chars = Array.from(prep);
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      const next = chars[i + 1];

      if (BN_DIGITS[ch]) {
        out += BN_DIGITS[ch];
        continue;
      }
      if (BN_INDEPENDENT_VOWELS[ch]) {
        out += BN_INDEPENDENT_VOWELS[ch];
        continue;
      }
      if (BN_VOWEL_SIGNS[ch]) {
        out += BN_VOWEL_SIGNS[ch];
        continue;
      }
      if (ch === '্') {
        // Halant suppresses inherent vowel
        continue;
      }
      if (ch === 'ং') {
        out += 'ng';
        continue;
      }
      if (ch === 'ঃ') {
        out += 'h';
        continue;
      }
      if (ch === 'ঁ') {
        continue;
      }
      if (ch === '্য') {
        out += 'y';
        continue;
      }
      if (ch === '্র') {
        out += 'r';
        continue;
      }

      if (BN_CONSONANTS[ch]) {
        // Handle conjuncts like স্মা -> sm + a, স্ট -> st
        out += BN_CONSONANTS[ch];
        const nextIsVowelSign = next && (BN_VOWEL_SIGNS[next] || next === '্' || next === '্য' || next === '্র');
        if (!nextIsVowelSign && next && BN_CONSONANTS[next] && i < chars.length - 2) {
          // Inherent vowel inside consonant clusters only when followed by another syllable
          out += 'a';
        }
        continue;
      }

      out += ch;
    }
    return out;
  });

  return outWords.join(' ').trim();
}

export function toPhoneticSkeleton(latin: string): string {
  const clean = latin
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  if (!clean) return '';

  return clean
    .replace(/ph/g, 'f')
    .replace(/bh/g, 'v')
    .replace(/sh/g, 's')
    .replace(/chh?/g, 'c')
    .replace(/th/g, 't')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/dh/g, 'd')
    .replace(/[cqk]/g, 'k')
    .replace(/[wv]/g, 'v')
    .replace(/[jz]/g, 'j')
    .replace(/oo/g, 'u')
    .replace(/ee|ea|ie/g, 'i')
    .replace(/ai|ei|ay/g, 'i')
    .replace(/ou|ow/g, 'o')
    .replace(/(.)\1+/g, '$1') // collapse repeated chars
    .replace(/\b([a-z]{3,})e\b/g, '$1'); // drop trailing silent e
}

function tokenizeNormalized(normalized: string): string[] {
  if (!normalized) return [];
  const rawParts = normalized.split(' ').filter(Boolean);
  const tokens: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (t: string) => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    tokens.push(t);
  };

  for (const part of rawParts) {
    pushUnique(part);
    if (part.includes('-')) {
      const subParts = part.split('-').filter(Boolean);
      for (const sp of subParts) pushUnique(sp);
      const joined = subParts.join('');
      if (joined.length >= 2) pushUnique(joined);
    }
  }
  return tokens;
}

export interface ExpandedSearchQuery {
  raw: string;
  normalized: string;
  language: QueryLanguage;
  tokens: string[];
  meaningfulTokens: string[];
  phraseNoSpaces: string;
  synonymTerms: string[];
  transliteratedTerms: string[];
  phoneticSkeletons: string[];
  allCandidateTerms: string[];
}

export function buildExpandedQuery(
  rawQuery: string,
  synonymEntries: SearchSynonymEntry[] = DEFAULT_SEED_SYNONYMS,
  options?: {
    crossLanguageEnabled?: boolean;
    synonymMatchingEnabled?: boolean;
    transliterationEnabled?: boolean;
  }
): ExpandedSearchQuery {
  const crossLanguageEnabled = options?.crossLanguageEnabled !== false;
  const synonymMatchingEnabled = options?.synonymMatchingEnabled !== false;
  const transliterationEnabled = options?.transliterationEnabled !== false;

  const raw = (rawQuery || '').trim();
  const normalized = normalizeSearchText(raw);
  const language = detectQueryLanguage(raw);
  const tokens = tokenizeNormalized(normalized);
  const meaningfulTokens = tokens.filter((t) => !STOPWORDS.has(t));
  const effectiveTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;
  const phraseNoSpaces = normalized.replace(/[\s-]+/g, '');

  const synonymSet = new Set<string>();
  const translitSet = new Set<string>();
  const phoneticSet = new Set<string>();

  if (transliterationEnabled && normalized) {
    const fullTranslit = transliterateBnToLatin(normalized);
    if (fullTranslit && fullTranslit !== normalized) {
      translitSet.add(fullTranslit);
      const compactTranslit = fullTranslit.replace(/[\s-]+/g, '');
      if (compactTranslit.length >= 3) translitSet.add(compactTranslit);
    }
    for (const tok of effectiveTokens) {
      if (/[\u0980-\u09FF]/.test(tok)) {
        if (BN_SPECIAL_WORD_TRANSLIT[tok]) {
          for (const mapped of BN_SPECIAL_WORD_TRANSLIT[tok]) {
            translitSet.add(mapped);
          }
        }
        const t = transliterateBnToLatin(tok);
        if (t && t.length >= 2) translitSet.add(t);
      }
    }
    for (const latinSrc of [normalized, ...Array.from(translitSet)]) {
      if (/^[a-z0-9\s-]+$/.test(latinSrc)) {
        const skel = toPhoneticSkeleton(latinSrc);
        if (skel.length >= 3) phoneticSet.add(skel);
        for (const p of latinSrc.split(/\s+/)) {
          const ps = toPhoneticSkeleton(p);
          if (ps.length >= 3) phoneticSet.add(ps);
        }
      }
    }
  }

  if (synonymMatchingEnabled && effectiveTokens.length > 0) {
    const tokenLookup = new Set<string>([
      normalized,
      phraseNoSpaces,
      ...effectiveTokens,
      ...Array.from(translitSet),
    ]);

    for (const entry of synonymEntries) {
      if (entry.isActive === false) continue;
      const allGroupTerms = [entry.primaryTerm, ...(entry.aliases || [])]
        .map((t) => normalizeSearchText(t))
        .filter(Boolean);

      if (allGroupTerms.length === 0) continue;

      const matched = allGroupTerms.some((term) => {
        if (tokenLookup.has(term)) return true;
        const compactTerm = term.replace(/[\s-]+/g, '');
        if (compactTerm.length >= 3 && tokenLookup.has(compactTerm)) return true;
        return effectiveTokens.some(
          (tok) =>
            tok.length >= 3 &&
            (term === tok ||
              term.split(/\s+/).includes(tok) ||
              (term.length >= 4 && term.includes(tok) && tok.length >= Math.ceil(term.length * 0.6)))
        );
      });

      if (matched) {
        for (const term of allGroupTerms) {
          if (!crossLanguageEnabled) {
            const termLang = detectQueryLanguage(term);
            if (language === 'bn' && termLang === 'en') continue;
            if (language === 'en' && termLang === 'bn') continue;
          }
          if (!tokenLookup.has(term)) {
            synonymSet.add(term);
            const compact = term.replace(/[\s-]+/g, '');
            if (compact.length >= 3 && !tokenLookup.has(compact)) {
              synonymSet.add(compact);
            }
          }
        }
      }
    }
  }

  const allCandidates = new Set<string>();
  if (normalized) allCandidates.add(normalized);
  if (phraseNoSpaces.length >= 2) allCandidates.add(phraseNoSpaces);
  for (const t of effectiveTokens) {
    if (t.length >= 1) allCandidates.add(t);
  }
  for (const t of translitSet) {
    if (t.length >= 2) allCandidates.add(t);
  }
  for (const s of synonymSet) {
    if (s.length >= 2) allCandidates.add(s);
  }

  return {
    raw,
    normalized,
    language,
    tokens,
    meaningfulTokens: effectiveTokens,
    phraseNoSpaces,
    synonymTerms: Array.from(synonymSet).slice(0, 32),
    transliteratedTerms: Array.from(translitSet).slice(0, 16),
    phoneticSkeletons: Array.from(phoneticSet).slice(0, 16),
    allCandidateTerms: Array.from(allCandidates).slice(0, 40),
  };
}

export interface SearchableProductInput {
  _id?: unknown;
  name: string;
  nameBn?: string;
  sku: string;
  barcode?: string;
  shortDescription?: string;
  description?: string;
  features?: string[];
  attributes?: Record<string, string> | Map<string, string>;
  specificationGroups?: Array<{
    groupTitle?: string;
    items?: Array<{ label?: string; value?: string }>;
  }>;
  bilingualKeywords?: string[];
  metaKeywords?: string[];
  variants?: Array<{
    sku?: string;
    title?: string;
    options?: Record<string, string> | Map<string, string>;
    stockOnHand?: number;
    reservedStock?: number;
    isActive?: boolean;
  }>;
  brandId?: { name?: string; slug?: string } | string | null;
  categoryId?: { name?: string; nameBn?: string; slug?: string } | string | null;
  subcategoryId?: { name?: string; nameBn?: string; slug?: string } | string | null;
  status?: string;
  isFeatured?: boolean;
  salesCount?: number;
  ratingAverage?: number;
  availableStock?: number;
  allowBackorders?: boolean;
}

export interface ProductMatchEvaluation {
  score: number;
  matchedField:
    | 'exact_title'
    | 'exact_sku'
    | 'title'
    | 'brand'
    | 'category'
    | 'tags'
    | 'attribute'
    | 'description'
    | 'synonym'
    | 'transliteration'
    | 'none';
  matchedText: string;
  matchedVia: 'direct' | 'synonym' | 'transliteration' | 'none';
  directTokenHits: number;
  conceptHits: number;
}

function readMapOrRecordValues(obj?: Record<string, string> | Map<string, string>): string[] {
  if (!obj) return [];
  if (obj instanceof Map) {
    const list: string[] = [];
    obj.forEach((val, key) => {
      if (key) list.push(String(key));
      if (val) list.push(String(val));
    });
    return list;
  }
  const list: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key) list.push(key);
    if (val) list.push(String(val));
  }
  return list;
}

function containsWholeWordOrStrongPrefix(haystackNorm: string, needle: string): 'exact' | 'word' | 'prefix' | 'substring' | null {
  if (!haystackNorm || !needle) return null;
  if (haystackNorm === needle) return 'exact';

  const haystackWords = haystackNorm.split(/[\s-]+/).filter(Boolean);
  if (haystackWords.includes(needle)) return 'word';

  if (needle.length >= 2 && haystackWords.some((w) => w.startsWith(needle))) {
    return 'prefix';
  }
  if (needle.length >= 3 && haystackNorm.includes(needle)) {
    return 'substring';
  }
  return null;
}

function matchStrengthFactor(kind: 'exact' | 'word' | 'prefix' | 'substring' | null): number {
  if (kind === 'exact') return 1.0;
  if (kind === 'word') return 0.92;
  if (kind === 'prefix') return 0.72;
  if (kind === 'substring') return 0.55;
  return 0;
}

export function scoreProductMatch(
  product: SearchableProductInput,
  expanded: ExpandedSearchQuery,
  config: SearchEngineConfig = DEFAULT_SEARCH_ENGINE_CONFIG
): ProductMatchEvaluation {
  if (product.status && product.status !== 'published') {
    return {
      score: 0,
      matchedField: 'none',
      matchedText: '',
      matchedVia: 'none',
      directTokenHits: 0,
      conceptHits: 0,
    };
  }

  if (!expanded.normalized) {
    return {
      score: 0,
      matchedField: 'none',
      matchedText: '',
      matchedVia: 'none',
      directTokenHits: 0,
      conceptHits: 0,
    };
  }

  const weights = config.relevanceWeights || DEFAULT_RELEVANCE_WEIGHTS;

  const titleEn = normalizeSearchText(product.name || '');
  const titleBn = normalizeSearchText(product.nameBn || '');
  const titleCombined = `${titleEn} ${titleBn}`.trim();
  const titleCompact = titleCombined.replace(/[\s-]+/g, '');

  const skuNorm = normalizeSearchText(product.sku || '');
  const barcodeNorm = normalizeSearchText(product.barcode || '');
  const variantSkus = (product.variants || [])
    .filter((v) => v.isActive !== false && v.sku)
    .map((v) => normalizeSearchText(v.sku || ''));

  const brandName =
    product.brandId && typeof product.brandId === 'object'
      ? normalizeSearchText(product.brandId.name || '')
      : '';
  const brandSlug =
    product.brandId && typeof product.brandId === 'object'
      ? normalizeSearchText(product.brandId.slug || '')
      : '';
  const brandJoined = `${brandName} ${brandSlug}`.trim();

  const catObj =
    product.categoryId && typeof product.categoryId === 'object' ? product.categoryId : null;
  const subCatObj =
    product.subcategoryId && typeof product.subcategoryId === 'object' ? product.subcategoryId : null;
  const categoryJoined = normalizeSearchText(
    [catObj?.name, catObj?.nameBn, subCatObj?.name, subCatObj?.nameBn].filter(Boolean).join(' ')
  );

  const tagsJoined = normalizeSearchText(
    [
      ...(product.bilingualKeywords || []),
      ...(product.metaKeywords || []),
      ...(product.features || []),
    ].join(' ')
  );

  const specStrings: string[] = [...readMapOrRecordValues(product.attributes)];
  for (const grp of product.specificationGroups || []) {
    if (grp.groupTitle) specStrings.push(grp.groupTitle);
    for (const item of grp.items || []) {
      if (item.label) specStrings.push(item.label);
      if (item.value) specStrings.push(item.value);
    }
  }
  for (const variant of product.variants || []) {
    if (variant.isActive === false) continue;
    if (variant.title) specStrings.push(variant.title);
    specStrings.push(...readMapOrRecordValues(variant.options));
  }
  const attributesJoined = normalizeSearchText(specStrings.join(' '));

  const shortDescJoined = normalizeSearchText(product.shortDescription || '');
  const fullDescJoined = normalizeSearchText(product.description || '');
  const descJoined = `${shortDescJoined} ${fullDescJoined}`.trim();

  let bestScore = 0;
  let matchedField: ProductMatchEvaluation['matchedField'] = 'none';
  let matchedText = '';
  let matchedVia: ProductMatchEvaluation['matchedVia'] = 'none';

  const recordTier = (
    tierScore: number,
    field: ProductMatchEvaluation['matchedField'],
    text: string,
    via: ProductMatchEvaluation['matchedVia']
  ) => {
    if (tierScore > bestScore) {
      bestScore = tierScore;
      matchedField = field;
      matchedText = text;
      matchedVia = via;
    }
  };

  let additiveScore = 0;
  const matchedConceptTokens = new Set<string>();

  // 1. Exact product title match
  if (
    titleEn === expanded.normalized ||
    titleBn === expanded.normalized ||
    (expanded.phraseNoSpaces.length >= 3 && titleCompact === expanded.phraseNoSpaces)
  ) {
    const s = weights.exactTitle + 250;
    additiveScore += s;
    recordTier(s, 'exact_title', product.name, 'direct');
  } else if (
    expanded.tokens.length >= 2 &&
    expanded.normalized.length >= 4 &&
    (titleEn.includes(expanded.normalized) || titleBn.includes(expanded.normalized))
  ) {
    const s = Math.round(weights.titleKeyword * 0.45);
    additiveScore += s;
    recordTier(s, 'title', product.name, 'direct');
  }

  // 2. Exact SKU / barcode match
  if (
    skuNorm === expanded.normalized ||
    (barcodeNorm && barcodeNorm === expanded.normalized) ||
    variantSkus.some((vs) => vs === expanded.normalized)
  ) {
    const s = weights.exactSku + 200;
    additiveScore += s;
    recordTier(s, 'exact_sku', product.sku, 'direct');
  } else if (
    expanded.normalized.length >= 3 &&
    (skuNorm.includes(expanded.normalized) || variantSkus.some((vs) => vs.includes(expanded.normalized)))
  ) {
    const s = weights.exactSku * 0.85;
    additiveScore += s;
    recordTier(s, 'exact_sku', product.sku, 'direct');
  }

  // Direct query tokens across fields
  const queryTokens = expanded.meaningfulTokens;
  let directTokenHits = 0;
  let titleHits = 0;

  for (const tok of queryTokens) {
    let tokMatched = false;

    const titleHit = containsWholeWordOrStrongPrefix(titleCombined, tok);
    if (titleHit) {
      tokMatched = true;
      titleHits += 1;
      matchedConceptTokens.add(tok);
      const s = weights.titleKeyword * matchStrengthFactor(titleHit);
      additiveScore += s;
      recordTier(s, 'title', product.nameBn || product.name, 'direct');
    }

    const brandHit = containsWholeWordOrStrongPrefix(brandJoined, tok);
    if (brandHit) {
      tokMatched = true;
      matchedConceptTokens.add(tok);
      const s = weights.brand * matchStrengthFactor(brandHit);
      additiveScore += s;
      recordTier(s, 'brand', (product.brandId as { name?: string })?.name || brandName, 'direct');
    }

    const catHit = containsWholeWordOrStrongPrefix(categoryJoined, tok);
    if (catHit) {
      tokMatched = true;
      matchedConceptTokens.add(tok);
      const s = weights.category * matchStrengthFactor(catHit);
      additiveScore += s;
      recordTier(s, 'category', catObj?.name || catObj?.nameBn || '', 'direct');
    }

    const tagHit = containsWholeWordOrStrongPrefix(tagsJoined, tok);
    if (tagHit) {
      tokMatched = true;
      matchedConceptTokens.add(tok);
      const s = weights.tags * matchStrengthFactor(tagHit);
      additiveScore += s;
      recordTier(s, 'tags', (product.bilingualKeywords || [])[0] || tok, 'direct');
    }

    const attrHit = containsWholeWordOrStrongPrefix(attributesJoined, tok);
    if (attrHit) {
      tokMatched = true;
      matchedConceptTokens.add(tok);
      const s = weights.attribute * matchStrengthFactor(attrHit);
      additiveScore += s;
      recordTier(s, 'attribute', tok, 'direct');
    }

    const descHit = containsWholeWordOrStrongPrefix(descJoined, tok);
    if (descHit) {
      tokMatched = true;
      matchedConceptTokens.add(tok);
      const s = weights.description * matchStrengthFactor(descHit);
      additiveScore += s;
      recordTier(s, 'description', product.shortDescription || product.name, 'direct');
    }

    if (tokMatched) directTokenHits += 1;
  }

  // All-token title bonus
  if (queryTokens.length > 1 && titleHits === queryTokens.length) {
    additiveScore += Math.round(weights.titleKeyword * 0.5);
  }

  // Joined no-space phrase check (e.g., "smart watch" -> "smartwatch", "t shirt" -> "tshirt")
  if (expanded.phraseNoSpaces.length >= 4 && expanded.tokens.length > 1) {
    if (titleCompact.includes(expanded.phraseNoSpaces)) {
      const s = weights.titleKeyword * 0.9;
      additiveScore += s;
      recordTier(s, 'title', product.name, 'direct');
      for (const t of queryTokens) matchedConceptTokens.add(t);
    }
  }

  // 9a. Synonym matches (cross-language & alias matching)
  const synonymCorpus: Array<{
    corpus: string;
    field: ProductMatchEvaluation['matchedField'];
    multiplier: number;
    label: string;
  }> = [
    { corpus: titleCombined, field: 'title', multiplier: 1.0, label: product.name },
    { corpus: brandJoined, field: 'brand', multiplier: 0.9, label: brandName },
    { corpus: categoryJoined, field: 'category', multiplier: 0.85, label: catObj?.name || '' },
    { corpus: tagsJoined, field: 'tags', multiplier: 0.8, label: (product.bilingualKeywords || [])[0] || '' },
    { corpus: attributesJoined, field: 'attribute', multiplier: 0.65, label: 'Specs & Variants' },
    { corpus: descJoined, field: 'description', multiplier: 0.45, label: product.shortDescription || product.name },
  ];

  let bestSynonymHitForProduct = 0;
  for (const syn of expanded.synonymTerms) {
    if (syn.length < 2) continue;
    for (const target of synonymCorpus) {
      if (!target.corpus) continue;
      const hit = containsWholeWordOrStrongPrefix(target.corpus, syn);
      if (hit) {
        const synScore = weights.synonymTranslit * target.multiplier * matchStrengthFactor(hit);
        if (synScore > bestSynonymHitForProduct) {
          bestSynonymHitForProduct = synScore;
        }
        matchedConceptTokens.add(`syn:${syn}`);
        if (bestScore < synScore) {
          recordTier(synScore, 'synonym', target.label || syn, 'synonym');
        }
      }
    }
  }
  additiveScore += bestSynonymHitForProduct;

  // 9b. Transliteration & phonetic skeleton matches
  if (config.transliterationEnabled) {
    const latinCorpus = `${titleCombined} ${brandJoined} ${categoryJoined} ${tagsJoined}`
      .replace(/[^\w\s-]/g, ' ')
      .trim();
    const corpusWords = latinCorpus.split(/[\s-]+/).filter((w) => w.length >= 3);
    const corpusSkeletons = new Set(corpusWords.map((w) => toPhoneticSkeleton(w)).filter((s) => s.length >= 3));
    const compactLatin = latinCorpus.replace(/[\s-]+/g, '');
    const compactSkel = toPhoneticSkeleton(compactLatin);

    let bestTranslitScore = 0;
    for (const tr of expanded.transliteratedTerms) {
      if (tr.length < 3) continue;
      const hit = containsWholeWordOrStrongPrefix(titleCombined, tr) || containsWholeWordOrStrongPrefix(brandJoined, tr) || containsWholeWordOrStrongPrefix(categoryJoined, tr);
      if (hit) {
        const sc = weights.synonymTranslit * 0.95 * matchStrengthFactor(hit);
        if (sc > bestTranslitScore) bestTranslitScore = sc;
        matchedConceptTokens.add(`tr:${tr}`);
        recordTier(sc, 'transliteration', product.name, 'transliteration');
      }
    }

    for (const skel of expanded.phoneticSkeletons) {
      if (skel.length < 3) continue;
      if (corpusSkeletons.has(skel) || (compactSkel && skel.length >= 5 && compactSkel.includes(skel))) {
        const sc = weights.synonymTranslit * 0.78;
        if (sc > bestTranslitScore) bestTranslitScore = sc;
        matchedConceptTokens.add(`ph:${skel}`);
        recordTier(sc, 'transliteration', product.name, 'transliteration');
      }
    }

    additiveScore += bestTranslitScore;
  }

  // Multi-concept coverage bonus (e.g., "Apple Mobile" matches both brand/title "Apple" AND category/synonym "Mobile")
  const conceptHits = matchedConceptTokens.size;
  if (queryTokens.length > 1 && conceptHits >= 2) {
    additiveScore += Math.min(300, conceptHits * 90);
  }

  // Noise gate: single weak substring match on very short query or low confidence
  const minThreshold = expanded.normalized.length === 1 ? 180 : 85;
  if (additiveScore < minThreshold) {
    return {
      score: 0,
      matchedField: 'none',
      matchedText: '',
      matchedVia: 'none',
      directTokenHits,
      conceptHits,
    };
  }

  // Minor tie-breakers for sales & featured status without overriding relevance tiers
  const tieBreaker =
    (product.isFeatured ? 6 : 0) +
    Math.min(12, Number(product.salesCount || 0) * 0.2) +
    Math.min(5, Number(product.ratingAverage || 0));

  return {
    score: Math.round(additiveScore + tieBreaker),
    matchedField,
    matchedText,
    matchedVia,
    directTokenHits,
    conceptHits,
  };
}

export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * Safely splits text into highlighted and non-highlighted segments for React rendering.
 * Never outputs raw HTML strings.
 */
export function buildHighlightSegments(
  text: string,
  query: string,
  extraTerms: string[] = []
): HighlightSegment[] {
  if (!text) return [];
  const rawTerms = [
    ...normalizeSearchText(query).split(/\s+/).filter(Boolean),
    ...extraTerms.map((t) => normalizeSearchText(t)).filter(Boolean),
  ];

  const terms = Array.from(new Set(rawTerms))
    .filter((t) => t.length >= 2 || (normalizeSearchText(query).length === 1 && t.length === 1))
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);

  if (terms.length === 0) {
    return [{ text, highlight: false }];
  }

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) {
    return [{ text, highlight: false }];
  }

  const termSet = new Set(terms.map((t) => t.toLowerCase()));
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      highlight: termSet.has(part.toLowerCase()),
    }));
}

export function resolveActivePlaceholders(
  messages: SearchPlaceholderMessageItem[],
  device: 'desktop' | 'mobile'
): SearchPlaceholderMessageItem[] {
  return (messages || [])
    .filter(
      (m) =>
        m &&
        m.isEnabled !== false &&
        typeof m.text === 'string' &&
        m.text.trim().length > 0 &&
        (m.deviceScope === 'all' || !m.deviceScope || m.deviceScope === device)
    )
    .slice()
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function sanitizeEngineConfig(
  input?: Partial<SearchEngineConfig> | null
): SearchEngineConfig {
  const src = input || {};
  const rw = (src.relevanceWeights || {}) as Partial<SearchRelevanceWeights>;
  return {
    smartSearchEnabled: src.smartSearchEnabled ?? DEFAULT_SEARCH_ENGINE_CONFIG.smartSearchEnabled,
    crossLanguageEnabled: src.crossLanguageEnabled ?? DEFAULT_SEARCH_ENGINE_CONFIG.crossLanguageEnabled,
    synonymMatchingEnabled: src.synonymMatchingEnabled ?? DEFAULT_SEARCH_ENGINE_CONFIG.synonymMatchingEnabled,
    transliterationEnabled: src.transliterationEnabled ?? DEFAULT_SEARCH_ENGINE_CONFIG.transliterationEnabled,
    minQueryLength: clampNumber(src.minQueryLength, 1, 5, DEFAULT_SEARCH_ENGINE_CONFIG.minQueryLength),
    debounceMs: clampNumber(src.debounceMs, 80, 1000, DEFAULT_SEARCH_ENGINE_CONFIG.debounceMs),
    maxSuggestions: clampNumber(src.maxSuggestions, 1, 15, DEFAULT_SEARCH_ENGINE_CONFIG.maxSuggestions),
    dropdownMaxHeightPx: clampNumber(
      src.dropdownMaxHeightPx,
      200,
      720,
      DEFAULT_SEARCH_ENGINE_CONFIG.dropdownMaxHeightPx
    ),
    outOfStockBehavior:
      src.outOfStockBehavior === 'show' ||
      src.outOfStockBehavior === 'demote' ||
      src.outOfStockBehavior === 'hide'
        ? src.outOfStockBehavior
        : DEFAULT_SEARCH_ENGINE_CONFIG.outOfStockBehavior,
    relevanceWeights: {
      exactTitle: clampNumber(rw.exactTitle, 100, 3000, DEFAULT_RELEVANCE_WEIGHTS.exactTitle),
      exactSku: clampNumber(rw.exactSku, 100, 3000, DEFAULT_RELEVANCE_WEIGHTS.exactSku),
      titleKeyword: clampNumber(rw.titleKeyword, 50, 2000, DEFAULT_RELEVANCE_WEIGHTS.titleKeyword),
      brand: clampNumber(rw.brand, 50, 1500, DEFAULT_RELEVANCE_WEIGHTS.brand),
      category: clampNumber(rw.category, 50, 1500, DEFAULT_RELEVANCE_WEIGHTS.category),
      tags: clampNumber(rw.tags, 20, 1200, DEFAULT_RELEVANCE_WEIGHTS.tags),
      attribute: clampNumber(rw.attribute, 20, 1000, DEFAULT_RELEVANCE_WEIGHTS.attribute),
      description: clampNumber(rw.description, 10, 800, DEFAULT_RELEVANCE_WEIGHTS.description),
      synonymTranslit: clampNumber(rw.synonymTranslit, 20, 1000, DEFAULT_RELEVANCE_WEIGHTS.synonymTranslit),
    },
  };
}

export function sanitizePlaceholderAnimationConfig(
  input?: Partial<SearchPlaceholderAnimationConfig> | null
): SearchPlaceholderAnimationConfig {
  const src = input || {};
  return {
    enabled: src.enabled ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.enabled,
    typingSpeedMs: clampNumber(src.typingSpeedMs, 15, 300, DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.typingSpeedMs),
    erasingSpeedMs: clampNumber(src.erasingSpeedMs, 10, 250, DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.erasingSpeedMs),
    pauseAfterCompleteMs: clampNumber(
      src.pauseAfterCompleteMs,
      300,
      8000,
      DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.pauseAfterCompleteMs
    ),
    delayBeforeNextMs: clampNumber(
      src.delayBeforeNextMs,
      100,
      4000,
      DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.delayBeforeNextMs
    ),
    startDelayMs: clampNumber(src.startDelayMs, 0, 3000, DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.startDelayMs),
    loop: src.loop ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.loop,
    showCursor: src.showCursor ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.showCursor,
    cursorChar:
      typeof src.cursorChar === 'string' && src.cursorChar.trim().length > 0
        ? src.cursorChar.trim().slice(0, 2)
        : DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.cursorChar,
    cursorBlinkSpeedMs: clampNumber(
      src.cursorBlinkSpeedMs,
      200,
      1500,
      DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.cursorBlinkSpeedMs
    ),
    transitionBehavior:
      src.transitionBehavior === 'type_and_erase' ||
      src.transitionBehavior === 'fade_cycle' ||
      src.transitionBehavior === 'instant_cycle'
        ? src.transitionBehavior
        : DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.transitionBehavior,
    pauseOnFocus: src.pauseOnFocus ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.pauseOnFocus,
    resumeOnBlur: src.resumeOnBlur ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.resumeOnBlur,
    desktopEnabled: src.desktopEnabled ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.desktopEnabled,
    mobileEnabled: src.mobileEnabled ?? DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.mobileEnabled,
    fallbackStaticText:
      typeof src.fallbackStaticText === 'string' && src.fallbackStaticText.trim().length > 0
        ? src.fallbackStaticText.trim().slice(0, 140)
        : DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.fallbackStaticText,
  };
}
