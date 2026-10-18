export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_OPTION_MAX_LENGTH = 80;

export const POLL_RESULTS_VISIBILITIES = [
  'right_away',
  'after_voting',
] as const;

export type PollResultsVisibility = (typeof POLL_RESULTS_VISIBILITIES)[number];

export type PollOption = {
  id: string;
  text: string;
};

/** A poll as stored: no counts, no viewer. Keyed by its quack. */
export type Poll = {
  quackId: string;
  resultsVisibility: PollResultsVisibility;
  closedAt: Date | null;
  /** Ordered by position. */
  options: PollOption[];
};

/** Vote counts for one poll, plus the viewer's own vote. */
export type PollStats = {
  votesByOption: ReadonlyMap<string, number>;
  myOptionId: string | null;
};

/**
 * A poll as one viewer sees it. While results are hidden from this viewer the
 * counts are null, so they can't be read from the response either.
 */
export type PollView = {
  resultsVisibility: PollResultsVisibility;
  isClosed: boolean;
  isAuthor: boolean;
  myOptionId: string | null;
  resultsVisible: boolean;
  totalVotes: number | null;
  options: { id: string; text: string; votes: number | null }[];
};

export const EMPTY_POLL_STATS: PollStats = {
  votesByOption: new Map(),
  myOptionId: null,
};

export const toPollView = (
  poll: Poll,
  stats: PollStats,
  viewer: { isAuthor: boolean },
): PollView => {
  const isClosed = poll.closedAt !== null;
  // Hidden only for an open "after voting" poll the viewer hasn't voted in.
  const resultsVisible =
    poll.resultsVisibility === 'right_away' ||
    stats.myOptionId !== null ||
    isClosed;

  const options = poll.options.map((option) => ({
    id: option.id,
    text: option.text,
    votes: resultsVisible ? (stats.votesByOption.get(option.id) ?? 0) : null,
  }));

  return {
    resultsVisibility: poll.resultsVisibility,
    isClosed,
    isAuthor: viewer.isAuthor,
    myOptionId: stats.myOptionId,
    resultsVisible,
    totalVotes: resultsVisible
      ? options.reduce((sum, option) => sum + (option.votes ?? 0), 0)
      : null,
    options,
  };
};
