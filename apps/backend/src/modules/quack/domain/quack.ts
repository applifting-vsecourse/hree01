import { Poll, PollView } from '@/modules/quack/domain/poll';

export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;

export type QuackMood = (typeof QUACK_MOODS)[number];

/** Limits and messages for the text of a quack and of a reply. */
export const QUACK_TEXT_MAX_LENGTH = 280;
export const quackTextMessages = {
  empty: 'Write something first',
  tooLong: `Keep it under ${QUACK_TEXT_MAX_LENGTH} characters`,
} as const;

/**
 * Who deleted a quack that stays as a placeholder for its replies. An admin
 * deleting their own quack is the author; only someone else's is moderation.
 */
export const QUACK_DELETED_BY = ['author', 'moderator'] as const;

export type QuackDeletedBy = (typeof QUACK_DELETED_BY)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

/**
 * A quack is live, or a placeholder kept for its replies: `deletedBy` set,
 * `text` and `mood` null, no poll (docs/adr/0001).
 */
export type Quack = {
  id: string;
  text: string | null;
  mood: QuackMood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedBy: QuackDeletedBy | null;
  replyCount: number;
  user?: QuackAuthor;
  poll: Poll | null;
};

export const isPlaceholder = (quack: Pick<Quack, 'deletedBy'>): boolean =>
  quack.deletedBy !== null;

/** A quack as one viewer sees it: its poll carries that viewer's vote. */
export type FeedQuack = Omit<Quack, 'poll'> & { poll: PollView | null };
