import { PrismaService } from '@/core/prisma/prisma.service';
import { Reply } from '@/generated/prisma/client';

type CreateReplyParams = {
  quackId: string;
  text: string;
  userId: string;
  createdAt?: Date;
};

export async function createReply(
  prisma: PrismaService,
  params: CreateReplyParams,
): Promise<Reply> {
  const { quackId, text, userId, createdAt } = params;

  return await prisma.reply.create({
    data: {
      text,
      createdAt,
      quack: { connect: { id: quackId } },
      user: { connect: { id: userId } },
    },
  });
}
