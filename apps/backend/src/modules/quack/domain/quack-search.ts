import { Quack } from '@/modules/quack/domain/quack';

// Case- and diacritics-insensitive: "CAFE" and "cafe" both match "Café".
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Splits a search query into normalized terms. A leading "@" is dropped so
 * "@CaffeinatedDuck" matches the username the same way "CaffeinatedDuck" does.
 * Returns an empty array for a blank query.
 */
export const parseSearchTerms = (query: string): string[] =>
  normalize(query)
    .split(/\s+/)
    .map((term) => term.replace(/^@+/, ''))
    .filter((term) => term.length > 0);

/**
 * A quack matches when every term appears (as a substring) in its text,
 * its author's name or its author's username.
 */
export const matchesSearchTerms = (quack: Quack, terms: string[]): boolean => {
  const fields = [
    quack.text,
    quack.user?.name ?? '',
    quack.user?.username ?? '',
  ].map(normalize);
  return terms.every((term) => fields.some((field) => field.includes(term)));
};
