import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  Reply as PrismaReply,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { LikeState } from '@/modules/quack/domain/like';
import { NewPoll, Poll, PollStats } from '@/modules/quack/domain/poll';
import {
  Quack,
  QuackAuthor,
  QuackDeletedBy,
  QuackMood,
} from '@/modules/quack/domain/quack';
import { Reply } from '@/modules/quack/domain/reply';
import { Injectable } from '@nestjs/common';

export type SetVoteResult = 'ok' | 'not_found' | 'closed' | 'invalid_option';
export type ClosePollResult = 'ok' | 'not_found' | 'forbidden';
/** `placeholder`: it had replies, so its content was erased and the row kept. */
export type DeleteQuackResult = 'deleted' | 'placeholder' | 'not_found';
export type CreateReplyResult =
  | { status: 'ok'; reply: Reply }
  | { status: 'not_found' }
  | { status: 'quack_deleted' };

// Loaded with every quack, so the feed gets its polls, reply and like counts
// and the viewer's own like in the same query. Counts are computed on every
// read, never stored (docs/adr/0002).
const quackInclude = (viewerId: string) =>
  ({
    user: true,
    poll: { include: { options: { orderBy: { position: 'asc' } } } },
    _count: { select: { replies: true, likes: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) as const;

const mapPrismaUserToAuthor = (user: PrismaUser): QuackAuthor => ({
  id: user.id,
  name: user.name,
  // the form the author typed; `username` itself is stored lowercased
  username: user.displayUsername ?? user.username ?? '',
});

const mapPrismaReplyToDomain = (
  reply: PrismaReply & { user: PrismaUser },
): Reply => ({
  id: reply.id,
  text: reply.text,
  quackId: reply.quackId,
  userId: reply.userId,
  createdAt: reply.createdAt,
  user: mapPrismaUserToAuthor(reply.user),
});

const mapPrismaPollToDomain = (
  poll: PrismaPoll & { options: PrismaPollOption[] },
): Poll => ({
  quackId: poll.quackId,
  resultsVisibility: poll.resultsVisibility,
  closedAt: poll.closedAt,
  options: poll.options.map((option) => ({
    id: option.id,
    text: option.text,
  })),
});

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & {
    user?: PrismaUser;
    poll?: (PrismaPoll & { options: PrismaPollOption[] }) | null;
    _count?: { replies: number; likes: number };
    likes?: { userId: string }[];
  },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  deletedBy: quack.deletedBy,
  replyCount: quack._count?.replies ?? 0,
  user: quack.user ? mapPrismaUserToAuthor(quack.user) : undefined,
  poll: quack.poll ? mapPrismaPollToDomain(quack.poll) : null,
  likeCount: quack._count?.likes ?? 0,
  likedByMe: (quack.likes?.length ?? 0) > 0,
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The feed, newest first. Placeholders (deleted quacks kept for their
   * replies) are included unless `liveOnly` is set. `viewerId` is whoever is
   * looking: each quack says whether they like it.
   */
  async getQuacks(
    filter: { authorId?: string; liveOnly?: boolean },
    viewerId: string,
  ): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: {
        userId: filter.authorId,
        deletedAt: filter.liveOnly ? null : undefined,
      },
      include: quackInclude(viewerId),
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  /**
   * Vote counts and the viewer's own votes for the given polls, in two
   * queries however many polls there are. Counts are computed from the votes
   * on every read, never stored, so they can't drift.
   */
  async getPollStats(
    quackIds: string[],
    viewerId: string,
  ): Promise<Map<string, PollStats>> {
    if (quackIds.length === 0) return new Map();

    const [counts, myVotes] = await Promise.all([
      this.prisma.pollVote.groupBy({
        by: ['quackId', 'optionId'],
        where: { quackId: { in: quackIds } },
        _count: { _all: true },
      }),
      this.prisma.pollVote.findMany({
        where: { quackId: { in: quackIds }, userId: viewerId },
        select: { quackId: true, optionId: true },
      }),
    ]);

    const stats = new Map(
      quackIds.map((quackId) => [
        quackId,
        {
          votesByOption: new Map<string, number>(),
          myOptionId: null as string | null,
        },
      ]),
    );
    for (const { quackId, optionId, _count } of counts) {
      stats.get(quackId)?.votesByOption.set(optionId, _count._all);
    }
    for (const { quackId, optionId } of myVotes) {
      const pollStats = stats.get(quackId);
      if (pollStats) pollStats.myOptionId = optionId;
    }
    return stats;
  }

  async getPoll(
    quackId: string,
  ): Promise<{ poll: Poll; authorId: string } | null> {
    const poll = await this.prisma.poll.findUnique({
      where: { quackId },
      include: {
        options: { orderBy: { position: 'asc' } },
        quack: { select: { userId: true } },
      },
    });
    return poll
      ? { poll: mapPrismaPollToDomain(poll), authorId: poll.quack.userId }
      : null;
  }

  /**
   * Sets (or with `optionId: null` removes) the user's vote. The poll's row is
   * locked first, so a vote can't slip in after the poll is closed, and votes
   * on one poll are applied one at a time — two tabs can't race on a first vote.
   */
  async setVote(
    quackId: string,
    userId: string,
    optionId: string | null,
  ): Promise<SetVoteResult> {
    return this.prisma.$transaction(async (tx) => {
      const [poll] = await tx.$queryRaw<{ closedAt: Date | null }[]>`
        SELECT "closedAt" FROM "poll" WHERE "quackId" = ${quackId} FOR UPDATE`;
      if (!poll) return 'not_found';
      if (poll.closedAt) return 'closed';

      if (optionId === null) {
        await tx.pollVote.deleteMany({ where: { quackId, userId } });
        return 'ok';
      }

      const option = await tx.pollOption.findFirst({
        where: { id: optionId, quackId },
        select: { id: true },
      });
      if (!option) return 'invalid_option';

      await tx.pollVote.upsert({
        where: { quackId_userId: { quackId, userId } },
        create: { quackId, userId, optionId },
        update: { optionId },
      });
      return 'ok';
    });
  }

  /** Closes the poll for good. Closing a closed poll changes nothing. */
  async closePoll(quackId: string, userId: string): Promise<ClosePollResult> {
    return this.prisma.$transaction(async (tx) => {
      // Same lock as voting, so a vote and the close can't interleave.
      const [poll] = await tx.$queryRaw<
        { closedAt: Date | null; authorId: string }[]
      >`
        SELECT p."closedAt", q."userId" AS "authorId"
        FROM "poll" p JOIN "quack" q ON q."id" = p."quackId"
        WHERE p."quackId" = ${quackId}
        FOR UPDATE OF p`;
      if (!poll) return 'not_found';
      if (poll.authorId !== userId) return 'forbidden';
      if (!poll.closedAt) {
        await tx.poll.update({
          where: { quackId },
          data: { closedAt: new Date() },
        });
      }
      return 'ok';
    });
  }

  /**
   * The quack's author, or null when there is no such quack or it is already
   * a placeholder: a deleted quack can't be deleted again.
   */
  async getQuackAuthorId(quackId: string): Promise<string | null> {
    const quack = await this.prisma.quack.findFirst({
      where: { id: quackId, deletedAt: null },
      select: { userId: true },
    });
    return quack?.userId ?? null;
  }

  /**
   * Deletes the quack. Without replies the row goes, and the poll, its options
   * and votes with it (cascade). With replies it becomes a placeholder: text,
   * mood and poll are erased, the row stays for the replies (docs/adr/0001).
   * Who may delete is the service's call.
   *
   * The quack's row is locked first (posting a reply locks it too), so a
   * reply can't land between counting the replies and deleting the row.
   */
  async deleteQuack(
    quackId: string,
    deletedBy: QuackDeletedBy,
  ): Promise<DeleteQuackResult> {
    return this.prisma.$transaction(async (tx) => {
      const [quack] = await tx.$queryRaw<{ deletedAt: Date | null }[]>`
        SELECT "deletedAt" FROM "quack" WHERE "id" = ${quackId} FOR UPDATE`;
      if (!quack || quack.deletedAt) return 'not_found';

      const replyCount = await tx.reply.count({ where: { quackId } });
      if (replyCount === 0) {
        await tx.quack.delete({ where: { id: quackId } });
        return 'deleted';
      }

      // Likes go with the content (docs/adr/0002); the row lock above keeps a
      // like from landing between this and the update.
      await tx.poll.deleteMany({ where: { quackId } });
      await tx.like.deleteMany({ where: { quackId } });
      await tx.quack.update({
        where: { id: quackId },
        data: { text: null, mood: null, deletedAt: new Date(), deletedBy },
      });
      return 'placeholder';
    });
  }

  /**
   * Likes a live quack as the user; liking it again changes nothing. Returns
   * its likes as the user now sees them, or null when there is no live quack.
   */
  async likeQuack(quackId: string, userId: string): Promise<LikeState | null> {
    return this.writeLike(quackId, userId, (tx) =>
      // ON CONFLICT DO NOTHING: the primary key makes a repeat (or a racing
      // duplicate) a no-op instead of an error or a second like.
      tx.like.createMany({ data: { quackId, userId }, skipDuplicates: true }),
    );
  }

  /**
   * Takes the user's like back; without one this changes nothing. Returns the
   * quack's likes as the user now sees them, or null when there is no live quack.
   */
  async unlikeQuack(
    quackId: string,
    userId: string,
  ): Promise<LikeState | null> {
    return this.writeLike(quackId, userId, (tx) =>
      tx.like.deleteMany({ where: { quackId, userId } }),
    );
  }

  /**
   * Runs a like write on a live quack and reads back its likes. The quack's
   * row is share-locked: likes don't wait for each other, but deleting the
   * quack (which locks it for update) can't erase its likes in between.
   */
  private async writeLike(
    quackId: string,
    userId: string,
    write: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<LikeState | null> {
    return this.prisma.$transaction(async (tx) => {
      const [quack] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "quack"
        WHERE "id" = ${quackId} AND "deletedAt" IS NULL
        FOR SHARE`;
      if (!quack) return null;

      await write(tx);
      const likeCount = await tx.like.count({ where: { quackId } });
      const mine = await tx.like.count({ where: { quackId, userId } });
      return { likeCount, likedByMe: mine > 0 };
    });
  }

  /** The quack's replies, oldest first, or null when there is no such quack. */
  async getReplies(quackId: string): Promise<Reply[] | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: {
        replies: {
          include: { user: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return quack ? quack.replies.map(mapPrismaReplyToDomain) : null;
  }

  /** Replies to a live quack. Locks it, so it can't be deleted meanwhile. */
  async createReply(data: {
    quackId: string;
    userId: string;
    text: string;
  }): Promise<CreateReplyResult> {
    return this.prisma.$transaction(async (tx) => {
      const [quack] = await tx.$queryRaw<{ deletedAt: Date | null }[]>`
        SELECT "deletedAt" FROM "quack" WHERE "id" = ${data.quackId} FOR UPDATE`;
      if (!quack) return { status: 'not_found' } as const;
      if (quack.deletedAt) return { status: 'quack_deleted' } as const;

      const reply = await tx.reply.create({
        data: {
          text: data.text,
          quack: { connect: { id: data.quackId } },
          user: { connect: { id: data.userId } },
        },
        include: { user: true },
      });
      return { status: 'ok', reply: mapPrismaReplyToDomain(reply) } as const;
    });
  }

  /** The reply's author, or null when the quack has no such reply. */
  async getReplyAuthorId(
    quackId: string,
    replyId: string,
  ): Promise<string | null> {
    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, quackId },
      select: { userId: true },
    });
    return reply?.userId ?? null;
  }

  /**
   * Deletes the reply for good. When it was the last reply under a
   * placeholder, the placeholder goes too. Returns false when the reply was
   * already gone. Who may delete is the service's call.
   */
  async deleteReply(quackId: string, replyId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Same lock as deleting the quack and posting a reply.
      const [quack] = await tx.$queryRaw<{ deletedAt: Date | null }[]>`
        SELECT "deletedAt" FROM "quack" WHERE "id" = ${quackId} FOR UPDATE`;
      if (!quack) return false;

      const { count } = await tx.reply.deleteMany({
        where: { id: replyId, quackId },
      });
      if (count === 0) return false;

      if (quack.deletedAt) {
        const remaining = await tx.reply.count({ where: { quackId } });
        if (remaining === 0) await tx.quack.delete({ where: { id: quackId } });
      }
      return true;
    });
  }

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
    poll: NewPoll | null;
  }): Promise<Quack> {
    const { poll } = createQuackData;
    // One nested create: the quack, its poll and the options are written
    // together or not at all.
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
        poll: poll
          ? {
              create: {
                resultsVisibility: poll.resultsVisibility,
                options: {
                  create: poll.options.map((text, position) => ({
                    text,
                    position,
                  })),
                },
              },
            }
          : undefined,
      },
      include: quackInclude(createQuackData.userId),
    });
    return mapPrismaQuackToDomain(quack);
  }
}
