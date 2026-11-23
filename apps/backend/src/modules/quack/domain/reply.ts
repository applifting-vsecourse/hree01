import { QuackAuthor } from '@/modules/quack/domain/quack';

/** A reply to a quack. One level deep: replies have no replies of their own. */
export type Reply = {
  id: string;
  text: string;
  quackId: string;
  userId: string;
  createdAt: Date;
  user: QuackAuthor;
};
