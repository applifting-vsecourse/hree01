import { PrismaService } from '@/core/prisma/prisma.service';
import { PollResultsVisibility } from '@/modules/quack/domain/poll';

type CreatePollParams = {
  quackId: string;
  options: string[];
  resultsVisibility?: PollResultsVisibility;
  closedAt?: Date;
  /** Who voted for which option, by the option's index in `options`. */
  votes?: { userId: string; option: number }[];
};

export async function createPoll(
  prisma: PrismaService,
  params: CreatePollParams,
): Promise<void> {
  const { quackId, options, resultsVisibility, closedAt, votes = [] } = params;

  const poll = await prisma.poll.create({
    data: {
      quackId,
      resultsVisibility,
      closedAt,
      options: {
        create: options.map((text, position) => ({ text, position })),
      },
    },
    include: { options: { orderBy: { position: 'asc' } } },
  });

  await prisma.pollVote.createMany({
    data: votes.map(({ userId, option }) => ({
      quackId,
      userId,
      optionId: poll.options[option].id,
    })),
  });
}
