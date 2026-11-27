import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExpandedQuery,
  buildHighlightSegments,
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SEED_PLACEHOLDERS,
  DEFAULT_SEED_SYNONYMS,
  detectQueryLanguage,
  normalizeSearchText,
  resolveActivePlaceholders,
  sanitizeEngineConfig,
  sanitizePlaceholderAnimationConfig,
  scoreProductMatch,
  toPhoneticSkeleton,
  transliterateBnToLatin,
  type SearchableProductInput,
} from './searchHelpers.ts';
import { expandCrossLingualTokens } from './crossLingualSearch.ts';

const sampleCatalog: SearchableProductInput[] = [
  {
    _id: 'p-iphone',
    name: 'Apple iPhone 16 Pro Max 256GB',
    nameBn: 'অ্যাপল আইফোন ১৬ প্রো ম্যাক্স স্মার্টফোন',
    sku: 'APL-IP16PM-256',
    barcode: '8801000016',
    brandId: { name: 'Apple', slug: 'apple' },
    categoryId: { name: 'Smartphones', nameBn: 'স্মার্টফোন ও মোবাইল', slug: 'smartphones' },
    bilingualKeywords: ['iphone', 'আইফোন', 'মোবাইল', 'smartphone', 'apple mobile'],
    metaKeywords: ['ios', '5g flagship'],
    features: ['A18 Pro Chip', '48MP Triple Camera'],
    attributes: { Storage: '256GB', Display: '6.9-inch OLED', Color: 'Desert Titanium' },
    shortDescription: 'Flagship Apple mobile phone with Titanium chassis.',
    description: 'Official Apple smartphone featuring A18 Pro chip and ProMotion display.',
    variants: [{ sku: 'APL-IP16PM-BLK', title: 'Black Titanium 256GB', options: { Color: 'Black' }, stockOnHand: 8, isActive: true }],
    status: 'published',
    availableStock: 10,
    salesCount: 45,
    ratingAverage: 4.9,
  },
  {
    _id: 'p-samsung',
    name: 'Samsung Galaxy S24 Ultra',
    nameBn: 'স্যামসাং গ্যালাক্সি এস২৪ আল্ট্রা',
    sku: 'SAM-S24U-512',
    brandId: { name: 'Samsung', slug: 'samsung' },
    categoryId: { name: 'Smartphones', nameBn: 'স্মার্টফোন ও মোবাইল', slug: 'smartphones' },
    bilingualKeywords: ['samsung', 'মোবাইল', 'ফোন', 'galaxy'],
    shortDescription: 'AI-powered Android mobile phone with S-Pen.',
    description: 'Snapdragon flagship smartphone with 200MP camera.',
    status: 'published',
    availableStock: 12,
    salesCount: 38,
    ratingAverage: 4.8,
  },
  {
    _id: 'p-laptop',
    name: 'MacBook Air M3 13-inch Laptop',
    nameBn: 'ম্যাকবুক এয়ার এম৩ ল্যাপটপ',
    sku: 'APL-MBA-M3',
    brandId: { name: 'Apple', slug: 'apple' },
    categoryId: { name: 'Laptops', nameBn: 'ল্যাপটপ ও কম্পিউটার', slug: 'laptops' },
    bilingualKeywords: ['macbook', 'laptop', 'ল্যাপটপ', 'notebook'],
    shortDescription: 'Ultra-thin Apple notebook powered by M3 chip.',
    description: 'Lightweight laptop computer for creators and engineers.',
    status: 'published',
    availableStock: 7,
    salesCount: 25,
    ratingAverage: 4.9,
  },
  {
    _id: 'p-watch',
    name: 'Amazfit GTR 4 Smartwatch',
    nameBn: 'অ্যামাজফিট স্মার্টওয়াচ',
    sku: 'AMZ-GTR4-BLK',
    brandId: { name: 'Amazfit', slug: 'amazfit' },
    categoryId: { name: 'Wearables', nameBn: 'স্মার্ট ঘড়ি', slug: 'wearables' },
    bilingualKeywords: ['smartwatch', 'স্মার্ট ওয়াচ', 'স্মার্ট ওয়াচ', 'ঘড়ি'],
    shortDescription: 'AMOLED fitness tracking smart watch with dual-band GPS.',
    description: 'Water-resistant smartwatch with 14-day battery life.',
    status: 'published',
    availableStock: 14,
    salesCount: 31,
  },
  {
    _id: 'p-shoes',
    name: 'Nike Air Zoom Pegasus Running Shoes',
    nameBn: 'নাইকি রানিং জুতা',
    sku: 'NIK-PEG-41',
    brandId: { name: 'Nike', slug: 'nike' },
    categoryId: { name: 'Footwear', nameBn: 'জুতা ও স্নিকার্স', slug: 'footwear' },
    bilingualKeywords: ['shoes', 'sneakers', 'জুতা', 'স্নিকার্স'],
    shortDescription: 'Responsive cushioning sneakers for daily running.',
    description: 'Breathable mesh athletic shoes.',
    status: 'published',
    availableStock: 20,
    salesCount: 60,
  },
  {
    _id: 'p-tshirt',
    name: 'Heavyweight Organic Cotton T-Shirt',
    nameBn: 'অর্গানিক কটন টি-শার্ট',
    sku: 'NOV-TSH-101',
    brandId: { name: 'Novara Essentials', slug: 'novara-essentials' },
    categoryId: { name: 'Fashion', nameBn: 'পোশাক ও ফ্যাশন', slug: 'fashion' },
    bilingualKeywords: ['t-shirt', 'tshirt', 'টি শার্ট', 'টি-শার্ট', 'টিশার্ট'],
    shortDescription: 'Combed 220gsm breathable cotton crew-neck tee.',
    description: 'Premium everyday t-shirt available in multiple colors.',
    status: 'published',
    availableStock: 40,
    salesCount: 80,
  },
  {
    _id: 'p-draft',
    name: 'Unpublished Prototype Mobile Phone',
    nameBn: 'অপ্রকাশিত মোবাইল',
    sku: 'DRAFT-MOB-01',
    brandId: { name: 'Apple', slug: 'apple' },
    categoryId: { name: 'Smartphones', nameBn: 'স্মার্টফোন', slug: 'smartphones' },
    status: 'draft',
    availableStock: 5,
  },
];

test('Bengali Unicode, spelling variant, and English whitespace normalization', () => {
  assert.equal(normalizeSearchText('  স্মার্ট ওয়াচ  '), 'স্মার্ট ওয়াচ');
  assert.equal(normalizeSearchText('আই\u200Bফোন  ১৬'), 'আইফোন ১৬');
  assert.equal(normalizeSearchText('টি-শার্ট   কটন'), 'টি-শার্ট কটন');
  assert.equal(normalizeSearchText('  Apple   iPhone!! '), 'apple iphone');
  assert.equal(detectQueryLanguage('মোবাইল'), 'bn');
  assert.equal(detectQueryLanguage('Mobile'), 'en');
  assert.equal(detectQueryLanguage('Apple মোবাইল'), 'mixed');
});

test('Bengali-to-Latin transliteration and phonetic skeleton handle brands & terms', () => {
  assert.equal(transliterateBnToLatin('আইফোন'), 'iphone');
  assert.equal(transliterateBnToLatin('ল্যাপটপ'), 'laptop');
  assert.equal(transliterateBnToLatin('স্যামসাং'), 'samsung');
  assert.equal(toPhoneticSkeleton('iphone'), toPhoneticSkeleton('ifone'));
  assert.equal(toPhoneticSkeleton('smartwatch'), toPhoneticSkeleton('smartvatch'));
});

test('Bidirectional Bengali & English cross-language smart search pairs', () => {
  const scenarios: Array<{ query: string; expectedIds: string[] }> = [
    { query: 'মোবাইল', expectedIds: ['p-iphone', 'p-samsung'] },
    { query: 'Mobile', expectedIds: ['p-iphone', 'p-samsung'] },
    { query: 'আইফোন', expectedIds: ['p-iphone'] },
    { query: 'iPhone', expectedIds: ['p-iphone'] },
    { query: 'ল্যাপটপ', expectedIds: ['p-laptop'] },
    { query: 'Laptop', expectedIds: ['p-laptop'] },
    { query: 'স্মার্ট ওয়াচ', expectedIds: ['p-watch'] },
    { query: 'Smart Watch', expectedIds: ['p-watch'] },
    { query: 'জুতা', expectedIds: ['p-shoes'] },
    { query: 'Shoes', expectedIds: ['p-shoes'] },
    { query: 'টি শার্ট', expectedIds: ['p-tshirt'] },
    { query: 'T-shirt', expectedIds: ['p-tshirt'] },
  ];

  for (const { query, expectedIds } of scenarios) {
    const expanded = buildExpandedQuery(query, DEFAULT_SEED_SYNONYMS);
    const matchedIds = sampleCatalog
      .map((p) => ({ id: String(p._id), eval: scoreProductMatch(p, expanded) }))
      .filter((r) => r.eval.score > 0)
      .sort((a, b) => b.eval.score - a.eval.score)
      .map((r) => r.id);

    for (const id of expectedIds) {
      assert.ok(
        matchedIds.includes(id),
        `Expected query "${query}" to match product "${id}", got [${matchedIds.join(', ')}]`
      );
    }
    assert.equal(matchedIds.includes('p-draft'), false, 'Draft products must never appear');
  }
});

test('Multi-word cross-concept query "Apple Mobile" ranks Apple smartphones above Apple laptops', () => {
  const expanded = buildExpandedQuery('Apple Mobile', DEFAULT_SEED_SYNONYMS);
  const iphoneScore = scoreProductMatch(sampleCatalog[0], expanded);
  const samsungScore = scoreProductMatch(sampleCatalog[1], expanded);
  const laptopScore = scoreProductMatch(sampleCatalog[2], expanded);

  assert.ok(iphoneScore.score > samsungScore.score, 'Apple iPhone should outscore Samsung for "Apple Mobile"');
  assert.ok(iphoneScore.score > laptopScore.score, 'Apple iPhone should outscore MacBook for "Apple Mobile"');
});

test('9-tier relevance ranking strictly prioritizes Exact Title > Exact SKU > Title > Brand > Category > Tags > Attribute > Description', () => {
  const expanded = buildExpandedQuery('nova', DEFAULT_SEED_SYNONYMS);
  const candidates: Array<{ tier: string; product: SearchableProductInput }> = [
    {
      tier: 'exact_title',
      product: { _id: '1', name: 'Nova', sku: 'SKU-1', status: 'published' },
    },
    {
      tier: 'exact_sku',
      product: { _id: '2', name: 'Wireless Earbuds Pro', sku: 'NOVA', status: 'published' },
    },
    {
      tier: 'title',
      product: { _id: '3', name: 'Nova Wireless Speaker System', sku: 'SKU-3', status: 'published' },
    },
    {
      tier: 'brand',
      product: { _id: '4', name: 'Studio Monitor', sku: 'SKU-4', brandId: { name: 'Nova', slug: 'nova' }, status: 'published' },
    },
    {
      tier: 'category',
      product: { _id: '5', name: 'Desk Lamp', sku: 'SKU-5', categoryId: { name: 'Nova Series', slug: 'nova-series' }, status: 'published' },
    },
    {
      tier: 'tags',
      product: { _id: '6', name: 'Travel Mug', sku: 'SKU-6', bilingualKeywords: ['nova'], status: 'published' },
    },
    {
      tier: 'attribute',
      product: { _id: '7', name: 'Desk Stand', sku: 'SKU-7', attributes: { Edition: 'Nova' }, status: 'published' },
    },
    {
      tier: 'description',
      product: { _id: '8', name: 'Phone Cable', sku: 'SKU-8', description: 'Designed for Nova docks.', status: 'published' },
    },
  ];

  const scored = candidates.map((c) => ({
    tier: c.tier,
    eval: scoreProductMatch(c.product, expanded, DEFAULT_SEARCH_ENGINE_CONFIG),
  }));

  for (let i = 0; i < scored.length - 1; i += 1) {
    assert.ok(
      scored[i].eval.score > scored[i + 1].eval.score,
      `Expected ${scored[i].tier} (${scored[i].eval.score}) > ${scored[i + 1].tier} (${scored[i + 1].eval.score})`
    );
  }
});

test('Single-character noise exclusion rejects weak substring matches', () => {
  const expanded = buildExpandedQuery('z', DEFAULT_SEED_SYNONYMS);
  const weakProduct: SearchableProductInput = {
    _id: 'weak-1',
    name: 'Classic Cotton Shirt',
    sku: 'SH-100',
    description: 'Features a hidden zipper pocket.',
    status: 'published',
  };
  const result = scoreProductMatch(weakProduct, expanded);
  assert.equal(result.score, 0);
});

test('Safe JSX highlight segment builder splits terms cleanly without HTML injection', () => {
  const segments = buildHighlightSegments('Apple iPhone 16 Pro Max (অ্যাপল আইফোন)', 'আইফোন', ['iphone']);
  const highlighted = segments.filter((s) => s.highlight).map((s) => s.text.toLowerCase());
  assert.ok(highlighted.includes('iphone'));
  assert.ok(highlighted.includes('আইফোন'));
  assert.equal(segments.map((s) => s.text).join(''), 'Apple iPhone 16 Pro Max (অ্যাপল আইফোন)');
});

test('resolveActivePlaceholders filters by isEnabled, deviceScope, and displayOrder', () => {
  const list = [
    ...DEFAULT_SEED_PLACEHOLDERS,
    { text: 'Disabled Prompt', language: 'en' as const, isEnabled: false, displayOrder: 0, deviceScope: 'all' as const },
  ];
  const desktop = resolveActivePlaceholders(list, 'desktop');
  const mobile = resolveActivePlaceholders(list, 'mobile');

  assert.equal(desktop.some((m) => m.text === 'Disabled Prompt'), false);
  assert.equal(desktop.some((m) => m.deviceScope === 'mobile'), false);
  assert.equal(mobile.some((m) => m.deviceScope === 'desktop'), false);
  assert.ok(desktop.some((m) => m.deviceScope === 'desktop'));
  assert.ok(mobile.some((m) => m.deviceScope === 'mobile'));
  for (let i = 0; i < desktop.length - 1; i += 1) {
    assert.ok(desktop[i].displayOrder <= desktop[i + 1].displayOrder);
  }
});

test('Config sanitizers clamp out-of-range numeric bounds and expandCrossLingualTokens preserves compatibility', () => {
  const engine = sanitizeEngineConfig({
    debounceMs: 10,
    maxSuggestions: 999,
    relevanceWeights: { ...DEFAULT_SEARCH_ENGINE_CONFIG.relevanceWeights, exactTitle: 99999 },
  });
  assert.equal(engine.debounceMs, 80);
  assert.equal(engine.maxSuggestions, 15);
  assert.equal(engine.relevanceWeights.exactTitle, 3000);

  const anim = sanitizePlaceholderAnimationConfig({
    ...DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
    typingSpeedMs: 1,
    erasingSpeedMs: 999,
    cursorChar: '  |||  ',
  });
  assert.equal(anim.typingSpeedMs, 15);
  assert.equal(anim.erasingSpeedMs, 250);
  assert.equal(anim.cursorChar, '||');

  const legacyExpanded = expandCrossLingualTokens('মোবাইল', [
    { primaryTerm: 'mobile', aliases: ['মোবাইল', 'phone'] },
  ]);
  assert.ok(legacyExpanded.includes('mobile'));
  assert.ok(legacyExpanded.includes('phone'));
});
