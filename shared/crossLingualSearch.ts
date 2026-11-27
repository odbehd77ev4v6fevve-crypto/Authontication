import {
  buildExpandedQuery,
  DEFAULT_SEED_SYNONYMS,
  type SearchSynonymEntry,
} from './searchHelpers.ts';

export function expandCrossLingualTokens(
  rawQuery: string,
  synonymEntries: Array<
    Pick<SearchSynonymEntry, 'primaryTerm' | 'aliases'> & Partial<SearchSynonymEntry>
  > = DEFAULT_SEED_SYNONYMS
): string[] {
  const normalizedEntries: SearchSynonymEntry[] = synonymEntries.map((entry) => ({
    ...entry,
    isActive: entry.isActive ?? true,
  }));
  const expanded = buildExpandedQuery(rawQuery, normalizedEntries, {
    crossLanguageEnabled: true,
    synonymMatchingEnabled: true,
    transliterationEnabled: true,
  });
  return Array.from(
    new Set([
      ...expanded.tokens,
      ...expanded.synonymTerms,
      ...expanded.transliteratedTerms,
    ])
  );
}

