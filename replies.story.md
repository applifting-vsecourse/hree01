# Replies to quacks

As someone reacting to a quack, I want to reply to it and see the replies under it, so that everyone can tell who is answering what — instead of posting a new quack that starts with "@name".

Replies belong to the people who wrote them: when an author deletes a quack that already has replies, the replies stay. And when anyone deletes their quack, its content really leaves the app — it is not just hidden.

## Acceptance criteria

### Seeing replies

- Every quack in the feed has a "Reply" button with the number of replies ("3 replies"; "Reply" when there are none). The count is computed by the server on every read, never stored.
- Clicking it expands the replies under the quack, oldest first, with the reply form below them. Clicking again collapses them. Replies are loaded only when expanded (`GET /api/quacks/:quackId/replies`).
- Each reply shows its author's name and username, the time and the text — like a quack, but without mood or poll.
- Replies are one level deep: you reply to a quack, not to a reply.
- Replies and counts refresh after your own action and when the tab regains focus. There are no live updates.

### Writing a reply

- Any signed-in user can reply to any live quack, including their own, and regardless of whether its poll is closed.
- The text is trimmed, required and at most 280 characters — the same constants and messages as a quack, shared by the DTO and the zod schema. Replies have no mood and no poll.
- The author is taken from the session, never from the request body.
- Enter submits. An empty reply focuses the field with an error written out in words. On success the field clears, the reply appears at the bottom of the list and the count goes up.
- Replying to a deleted quack (a placeholder) is refused with 409 "This quack was deleted"; a quack that doesn't exist is 404. The UI shows no reply form under a placeholder.
- Replies can't be edited.

### Deleting a reply

- The author deletes their own reply; an admin (moderator) can delete any reply. Anyone else gets 403. The rule lives in the service.
- Deleting a reply is permanent and removes it from the database. It is confirmed in a dialog in the same style as deleting a quack.
- When an admin removes someone else's reply, the server logs one line with the event name, the moderator's id, the author's id, the reply's id, the quack's id and the time. The text is not logged.
- Deleting the last reply under a placeholder also deletes the placeholder, in the same transaction.

### Deleting a quack that has replies

- A quack **without** replies is deleted exactly as today, together with its poll, options and votes.
- A quack **with** replies becomes a placeholder: its text and mood are erased from the database, its poll (with options and votes) is deleted, and it records when and by whom it was deleted. The replies stay where they are.
- The placeholder stays in the feed at the quack's original position. It shows no author, text, mood or poll — only "This quack was deleted", or "This quack was removed by a moderator" when an admin removed someone else's quack — and its replies below.
- "Removed by a moderator" applies only when an admin deletes **someone else's** quack. An admin deleting their own quack is an ordinary delete.
- The delete dialog (author's and moderator's) for a quack with replies says: "Its text disappears for everyone, together with its poll and votes. Its replies stay visible under a placeholder. This can't be undone." ("It disappears from the feed" would no longer be true.) Title and buttons are unchanged.
- A placeholder has no delete action. Deleting it through the API returns 404 "Quack not found".

### Existing features

- **All:** shows live quacks and placeholders that have replies.
- **Mine:** shows only my live quacks — no placeholders, no replies.
- **Search:** searches only the text of live quacks. Placeholders and replies never match.
- **Polls:** unchanged on live quacks. A placeholder has no poll.

## Out of scope

- Replying to a reply (threads) — the model leaves room for it, see Decisions.
- A detail page or shareable link for one quack's discussion.
- Searching replies, a "My replies" list.
- Notifying the quack's author about a new reply.
- Deleting a user account (no such feature exists today) — see "What happens when a quack is deleted".

## Decisions

1. **Replies are one level deep.**
   Rejected: unlimited threads — recursive queries, deep indentation that breaks on mobile, and once deep trees exist in production we couldn't go back. Rejected: exactly two levels — a depth limit only the service can enforce, two kinds of lists in the UI.

2. **A reply is a separate `Reply` model, not a `Quack` with a `parentId`.**
   The structure enforces the rules: a reply has no columns for a mood, a poll or its own replies, and feed, Mine and search don't change. Rejected: replies as quacks — every quack query would need `parentId IS NULL`, and one forgotten filter silently puts replies in the feed; "one level" and "no poll on a reply" would only be enforced in code.
   **Threads stay possible:** add a nullable `parentReplyId` self-relation on `Reply`. That migration only adds a nullable column; existing replies become first-level replies with no backfill.

3. **A deleted quack with replies becomes a placeholder whose content is erased** ([ADR 0001](docs/adr/0001-deleted-quacks-become-placeholders.md)). It is the only option that meets both requirements: replies stay in context, and the text is gone from the database.
   Rejected: hard delete with `quackId` set to NULL on replies — the orphaned replies would have nowhere to be shown and would lose their context for good. Rejected: soft delete that keeps the text hidden — breaks "the content must really leave the app".

4. **The placeholder keeps `userId`, and it disappears with its last reply.** `userId` stays required, so domain types, DTOs, Mine and permissions don't change, and the server still knows who owns it (it isn't deletable twice, it is kept out of Mine, the moderation log has the author). Keeping the fact that someone once posted at a given time is metadata, not content.
   Rejected: setting `userId` to NULL — a nullable author everywhere in the code for one state, and the owner could never be traced again. Rejected: keeping placeholders forever — the feed fills with empty "This quack was deleted" rows.

5. **Replies are expanded inline in the feed and loaded on demand.** Matches "visible under it", needs no new route, and the feed doesn't load replies nobody reads. A detail page can be added later with the same API.
   Rejected: a detail page (`/quacks/$quackId`) — a new route and navigating back and forth; the feed alone wouldn't show replies under the quack. Rejected: always showing all replies in the feed — the feed, Mine and search would load every reply.

6. **The placeholder records who deleted it (`deletedBy`: `author` | `moderator`)** and shows "removed by a moderator", so the replies under it make sense.
   Rejected: the same placeholder text for both — simpler, but the people in the discussion couldn't tell moderation from the author's own decision.

7. **Reply counts are computed, not stored** (`_count` on every read), like poll votes — they can't drift.

8. **The database refuses to hard-delete a quack that has replies** (`onDelete: Restrict` on `Reply.quack`). If the service ever takes the wrong branch, the delete fails instead of silently destroying other people's replies.

## Proposed schema

```prisma
enum QuackDeletedBy {
  author
  moderator

  @@map("quack_deleted_by")
}

model Quack {
  id        String          @id @default(cuid())
  text      String?         @db.Text // null once deleted (placeholder)
  mood      QuackMood?
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime        @default(now())
  updatedAt DateTime        @default(now()) @updatedAt
  deletedAt DateTime? // set = placeholder: deleted, kept only for its replies
  deletedBy QuackDeletedBy?
  poll      Poll?
  replies   Reply[]

  @@index([userId])
  @@map("quack")
}

model Reply {
  id        String   @id @default(cuid())
  text      String   @db.Text
  // Restrict: a quack with replies is never hard-deleted, it becomes a placeholder
  quack     Quack    @relation(fields: [quackId], references: [id], onDelete: Restrict)
  quackId   String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime @default(now())

  @@index([quackId, createdAt]) // a quack's replies in order, and their count
  @@index([userId])
  @@map("reply")
}

model User {
  // …existing fields…
  replies Reply[]
}
```

The migration also adds a check that Prisma can't express, so the three placeholder columns can't disagree:

```sql
ALTER TABLE "quack" ADD CONSTRAINT "quack_placeholder_consistent" CHECK (
  ("deletedAt" IS NULL AND "deletedBy" IS NULL AND "text" IS NOT NULL)
  OR
  ("deletedAt" IS NOT NULL AND "deletedBy" IS NOT NULL AND "text" IS NULL AND "mood" IS NULL)
);
```

### Can everything the user sees be read with simple queries?

Yes:

- **Feed (All):** `quack.findMany` ordered by `createdAt desc`, including `user`, `poll.options` and `_count.replies`. Poll stats as today, only for quacks that have a poll.
- **Mine:** the same with `where: { userId: <session>, deletedAt: null }`.
- **Search:** in memory as today, skipping quacks with `deletedAt` set.
- **Replies of a quack:** `reply.findMany({ where: { quackId }, include: { user: true }, orderBy: { createdAt: 'asc' } })` — served by the `(quackId, createdAt)` index.
- **Post a reply:** in one transaction, `SELECT "deletedAt" FROM "quack" WHERE "id" = $1 FOR UPDATE` (missing → 404, set → 409), then `reply.create`. The lock stops a reply slipping in while the quack is being deleted.
- **Delete a quack:** in one transaction, lock the quack row, count its replies; none → `quack.delete` (poll cascades); some → `poll.deleteMany` and `quack.update` setting `text`/`mood` to null and `deletedAt`/`deletedBy`.
- **Delete a reply:** in one transaction, lock the parent quack, `reply.delete`; if the quack is a placeholder and no replies are left, `quack.delete`.

### Is anything stored twice?

- The reply count is **not** stored — it is counted on read.
- Reply authors are referenced by `userId`, not copied, so a name change shows up everywhere.
- `deletedAt` and `deletedBy` overlap: both say "this is a placeholder". `deletedAt` keeps the time and `deletedBy` the reason. They are always written together in one update, and the check constraint above rejects any row where they (or the erased text and mood) disagree.

### What happens to related rows when a quack is deleted?

- **No replies:** the quack row is deleted; `Poll` → `PollOption` → `PollVote` go with it by cascade, as today.
- **With replies:** the quack row stays as a placeholder with `text` and `mood` erased; the poll is deleted explicitly (its options and votes cascade); the replies are untouched. A hard delete would be refused by the `Restrict` foreign key.
- **Last reply under a placeholder deleted:** the placeholder is deleted in the same transaction.
- **A user account deleted** (not possible in the app today, only directly in the database): `User → Reply` cascades, so that user's replies go. `User → Quack` cascades too, but `Restrict` blocks it for quacks other people replied to, so the user delete fails rather than destroying others' replies. A future account-deletion story must turn those quacks into placeholders first.

### Will the migration run on a production database with data?

Yes, with no backfill:

- `CREATE TYPE "quack_deleted_by"` — new type.
- `ALTER TABLE "quack" ALTER COLUMN "text" DROP NOT NULL` — metadata only, every existing row stays valid.
- `ADD COLUMN "deletedAt"`, `ADD COLUMN "deletedBy"` — nullable, no default, so no table rewrite (Postgres 11+).
- `ADD CONSTRAINT "quack_placeholder_consistent" CHECK (…)` — scans `quack` once under a lock; every existing row has text and no `deletedAt`, so it passes. On a very large table it can be split into `NOT VALID` plus a later `VALIDATE CONSTRAINT` to avoid the long lock.
- `CREATE TABLE "reply"` with its foreign keys and indexes — a new, empty table.

The currently deployed code keeps working on the migrated database until the new code ships: placeholders only appear once the new delete logic runs. Going back is easy until then; once placeholders exist, restoring `text NOT NULL` would mean deleting them first.

## Where it lands in the code

- **Backend, `modules/quack`:** `Reply` domain type; repository methods for listing, creating and deleting replies and the new delete-quack transaction; `QuacksService.deleteQuack` gains the placeholder branch; new endpoints `GET` / `POST /api/quacks/:quackId/replies` and `DELETE /api/quacks/:quackId/replies/:replyId`; `QuackResponseDto` gets nullable `text`, `deletedBy` and `replyCount`; `CreateReplyDto` shares the quack's text limits. Seed adds a few replies, including one placeholder.
- **Frontend, `features/quack`:** zod schemas for replies and the changed quack; reply query keys and mutations; `QuackItem` renders placeholders and the "Reply" toggle; new `ReplyList`, `ReplyItem`, `ReplyForm`, `DeleteReplyButton`; the delete dialogs get the extra sentence.
- **Tests:** service rules (permissions, placeholder vs hard delete, last reply removes the placeholder, 409 on a placeholder), form checklist (Enter submits, empty field focused with an error), and an e2e test for replying and deleting a quack that has replies.
