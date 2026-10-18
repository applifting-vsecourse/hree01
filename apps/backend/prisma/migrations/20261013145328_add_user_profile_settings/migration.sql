-- AlterTable
ALTER TABLE "user" ADD COLUMN     "bio" VARCHAR(160),
ADD COLUMN     "defaultMood" "quack_mood";

-- Normalize usernames the way BetterAuth's username plugin stores them: the
-- typed form goes to "displayUsername", "username" is lowercased so uniqueness
-- is case-insensitive. The seed used to write mixed-case usernames directly.
UPDATE "user"
SET "displayUsername" = COALESCE("displayUsername", "username"),
    "username" = LOWER("username")
WHERE "username" IS NOT NULL;
