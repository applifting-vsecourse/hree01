import { Poll, PollView } from '@/modules/quack/domain/poll';

export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;

export type QuackMood = (typeof QUACK_MOODS)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type Quack = {
  id: string;
  text: string;
  mood: QuackMood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
  poll: Poll | null;
};

/** A quack as one viewer sees it: its poll carries that viewer's vote. */
export type FeedQuack = Omit<Quack, 'poll'> & { poll: PollView | null };
