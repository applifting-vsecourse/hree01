import { Quack } from '@/modules/quack/domain/quack';
import { matchesSearchTerms, parseSearchTerms } from './quack-search';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'Feeding naïve ducks by the café pond',
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

const matches = (query: string, quack = aQuack()): boolean =>
  matchesSearchTerms(quack, parseSearchTerms(query));

describe('parseSearchTerms', () => {
  it('returns no terms for a blank query', () => {
    expect(parseSearchTerms('   ')).toEqual([]);
  });

  it('normalizes case and diacritics and drops a leading @', () => {
    expect(parseSearchTerms('  Café  @Duck ')).toEqual(['cafe', 'duck']);
  });
});

describe('matchesSearchTerms', () => {
  it('ignores case and diacritics', () => {
    expect(matches('CAFE')).toBe(true);
    expect(matches('naive')).toBe(true);
  });

  it('matches part of a word', () => {
    expect(matches('feed')).toBe(true);
  });

  it('matches the author name and username', () => {
    expect(matches('caffeinated duck')).toBe(true);
    expect(matches('@caffeinatedduck')).toBe(true);
  });

  it('requires every term, each anywhere in text or author', () => {
    expect(matches('duck pond')).toBe(true);
    expect(matches('duck swan')).toBe(false);
  });

  it('does not match when no field contains the term', () => {
    expect(matches('goose')).toBe(false);
  });
});
