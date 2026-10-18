import { Poll, PollStats, toPollView } from './poll';

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  quackId: 'q1',
  resultsVisibility: 'right_away',
  closedAt: null,
  options: [
    { id: 'o1', text: 'The café by the pond' },
    { id: 'o2', text: 'Bakery on the corner' },
    { id: 'o3', text: 'Leftover crusts' },
  ],
  ...overrides,
});

const stats = (
  votes: Record<string, number>,
  myOptionId: string | null = null,
): PollStats => ({
  votesByOption: new Map(Object.entries(votes)),
  myOptionId,
});

const viewer = { isAuthor: false };

describe('toPollView', () => {
  it('shows counts and the total for a "right away" poll, zero for options nobody picked', () => {
    const view = toPollView(aPoll(), stats({ o1: 1, o2: 2 }), viewer);

    expect(view.resultsVisible).toBe(true);
    expect(view.totalVotes).toBe(3);
    expect(view.options.map((option) => option.votes)).toEqual([1, 2, 0]);
  });

  it('keeps options in the order given', () => {
    const view = toPollView(aPoll(), stats({}), viewer);

    expect(view.options.map((option) => option.id)).toEqual(['o1', 'o2', 'o3']);
  });

  it('hides counts of an "after voting" poll from someone who has not voted', () => {
    const view = toPollView(
      aPoll({ resultsVisibility: 'after_voting' }),
      stats({ o1: 4 }),
      viewer,
    );

    expect(view.resultsVisible).toBe(false);
    expect(view.totalVotes).toBeNull();
    expect(view.options.every((option) => option.votes === null)).toBe(true);
  });

  it('shows counts of an "after voting" poll once the viewer has voted', () => {
    const view = toPollView(
      aPoll({ resultsVisibility: 'after_voting' }),
      stats({ o1: 4, o2: 1 }, 'o2'),
      viewer,
    );

    expect(view.resultsVisible).toBe(true);
    expect(view.myOptionId).toBe('o2');
    expect(view.totalVotes).toBe(5);
  });

  it('shows counts of a closed poll to everyone, whatever its setting', () => {
    const view = toPollView(
      aPoll({
        resultsVisibility: 'after_voting',
        closedAt: new Date('2026-01-01T12:00:00Z'),
      }),
      stats({ o3: 2 }),
      viewer,
    );

    expect(view.isClosed).toBe(true);
    expect(view.resultsVisible).toBe(true);
    expect(view.totalVotes).toBe(2);
  });

  it('does not reveal hidden counts to the author', () => {
    const view = toPollView(
      aPoll({ resultsVisibility: 'after_voting' }),
      stats({ o1: 4 }),
      { isAuthor: true },
    );

    expect(view.isAuthor).toBe(true);
    expect(view.resultsVisible).toBe(false);
  });
});
