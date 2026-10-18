-- CreateEnum
CREATE TYPE "poll_results_visibility" AS ENUM ('right_away', 'after_voting');

-- CreateTable
CREATE TABLE "poll" (
    "quackId" TEXT NOT NULL,
    "resultsVisibility" "poll_results_visibility" NOT NULL DEFAULT 'right_away',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_pkey" PRIMARY KEY ("quackId")
);

-- CreateTable
CREATE TABLE "poll_option" (
    "id" TEXT NOT NULL,
    "quackId" TEXT NOT NULL,
    "text" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "poll_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_vote" (
    "id" TEXT NOT NULL,
    "quackId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_quackId_position_key" ON "poll_option"("quackId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "poll_option_id_quackId_key" ON "poll_option"("id", "quackId");

-- CreateIndex
CREATE INDEX "poll_vote_optionId_idx" ON "poll_vote"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_vote_quackId_userId_key" ON "poll_vote"("quackId", "userId");

-- AddForeignKey
ALTER TABLE "poll" ADD CONSTRAINT "poll_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "poll"("quackId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "poll"("quackId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_optionId_quackId_fkey" FOREIGN KEY ("optionId", "quackId") REFERENCES "poll_option"("id", "quackId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Options in one poll are unique regardless of case. Prisma can't express an
-- index on an expression, so it is written by hand.
CREATE UNIQUE INDEX "poll_option_quackId_lower_text_key" ON "poll_option" ("quackId", LOWER("text"));
