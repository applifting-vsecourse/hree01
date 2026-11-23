-- CreateEnum
CREATE TYPE "quack_deleted_by" AS ENUM ('author', 'moderator');

-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" "quack_deleted_by",
ALTER COLUMN "text" DROP NOT NULL;

-- A quack is either live (has text) or a placeholder (text and mood erased,
-- deletedAt/deletedBy set). Prisma can't express this, so it lives here.
-- Every existing row has text and no deletedAt, so it passes.
ALTER TABLE "quack" ADD CONSTRAINT "quack_placeholder_consistent" CHECK (
  ("deletedAt" IS NULL AND "deletedBy" IS NULL AND "text" IS NOT NULL)
  OR
  ("deletedAt" IS NOT NULL AND "deletedBy" IS NOT NULL AND "text" IS NULL AND "mood" IS NULL)
);

-- CreateTable
CREATE TABLE "reply" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "quackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reply_quackId_createdAt_idx" ON "reply"("quackId", "createdAt");

-- CreateIndex
CREATE INDEX "reply_userId_idx" ON "reply"("userId");

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
