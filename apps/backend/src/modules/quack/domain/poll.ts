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
