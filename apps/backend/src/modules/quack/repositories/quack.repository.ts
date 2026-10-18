import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Poll, PollStats } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

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

  async getQuacks(): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
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

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: quackInclude,
    });
    return mapPrismaQuackToDomain(quack);
  }
}
