import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { NewPoll, Poll, PollStats } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

export type SetVoteResult = 'ok' | 'not_found' | 'closed' | 'invalid_option';
export type ClosePollResult = 'ok' | 'not_found' | 'forbidden';

// Loaded with every quack, so the feed gets its polls in the same query.
const quackInclude = {
  user: true,
  poll: { include: { options: { orderBy: { position: 'asc' } } } },
} as const;

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
  },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        // the form the author typed; `username` itself is stored lowercased
        username: quack.user.displayUsername ?? quack.user.username ?? '',
      }
    : undefined,
  poll: quack.poll ? mapPrismaPollToDomain(quack.poll) : null,
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getQuacks(filter: { authorId?: string } = {}): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: { userId: filter.authorId },
      include: quackInclude,
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

  /** The quack's author, or null when there is no such quack. */
  async getQuackAuthorId(quackId: string): Promise<string | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: { userId: true },
    });
    return quack?.userId ?? null;
  }

  /**
   * Deletes the quack; the poll, its options and votes go with it (cascade).
   * Returns false when it was already gone. Who may delete is the service's call.
   */
  async deleteQuack(quackId: string): Promise<boolean> {
    const { count } = await this.prisma.quack.deleteMany({
      where: { id: quackId },
    });
    return count > 0;
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
      include: quackInclude,
    });
    return mapPrismaQuackToDomain(quack);
  }
}
