# 2. Likes are rows in a `Like` table, counted when quacks are read

## Status

Accepted (2026-11-24). Not implemented yet; introduced by the likes feature ([cases.md](../../cases.md)).

## Context

The product owner wants a like button and a like count on every quack: "Everyone can like a quack only once, and take the like back." The agreed cases ([cases.md](../../cases.md)) add:

- Every quack in the feed, in Mine and in search results shows its like count and whether **I** liked it (`likedByMe`).
- Liking twice, or taking back a like you never gave, is not an error and changes nothing.
- Simultaneous likes are all counted, and never twice for the same person.
- Likes belong to live content only. [ADR 0001](0001-deleted-quacks-become-placeholders.md) already puts likes on the "deleted with the content" side: a hard-deleted quack loses its likes, and a quack that becomes a placeholder has its likes erased with its text, mood and poll.
- Nobody sees who liked a quack, only how many people did. Only quacks can be liked, not replies.

How likes are stored decides whether "only once" can be enforced at all, and what every read of the feed costs.

## Decision

A new table `like` with one row per person per liked quack:

- Columns: `quackId`, `userId`, `createdAt`.
- **Primary key `(quackId, userId)`.** The database enforces "one person, one like", so concurrent or repeated requests can't create a second row. No surrogate `id`: nothing refers to a single like.
- `quack` relation with `onDelete: Cascade`: hard-deleting a quack removes its likes.
- `user` relation with `onDelete: Cascade`: a user's likes go with their account.
- Index on `userId` (the primary key already covers lookups by `quackId`).

Behaviour on top of it:

- **Liking** is an insert that ignores an existing row (`upsert` / `ON CONFLICT DO NOTHING`); **taking a like back** is a `deleteMany` by `(quackId, userId)`. Both are idempotent, and both answer with the quack's current count and `likedByMe`.
- **Both refuse placeholders** (and missing quacks) as not found: the quack must be live (`deletedAt IS NULL`) in the same transaction as the write.
- **The count is computed when quacks are read**, the same way `replyCount` is today (`_count`). `likedByMe` is fetched for the whole page in one query for the signed-in user, like poll votes.
- **Turning a quack into a placeholder deletes its likes** in the same transaction that erases its text, mood and poll.

## Options considered

- **`Like` table with a unique pair, counted on read (chosen).** The only option where the database itself guarantees "only once", and it answers `likedByMe` directly. It follows the pattern already used for replies and poll votes.
- **A `likeCount` column on `quack` only** — rejected. It can't tell who liked a quack, so it can neither enforce "only once" nor show `likedByMe` nor check that an unlike undoes a real like. It also loses for good the information of who liked what, so moving to a table later would start from empty.
- **`Like` table plus a denormalised `likeCount` on `quack`**, kept in step in the same transaction — rejected for now. Reading the feed would skip the count, but the counter becomes a second source of truth that can drift: it may only change when a row really appears or disappears (so repeated likes don't add up), concurrent likes contend for the quack's row, and every way of deleting likes (placeholders, cascades, future features) must remember to adjust it. At our volumes counting on read is cheap, and the counter can be added later on top of the table without migrating data.

Within the chosen option:

- **Surrogate `id` plus a unique constraint on `(quackId, userId)`** — rejected. It adds a column nothing uses; the pair already identifies a like.
- **Keeping likes on placeholders, hidden** — rejected. The product owner decided likes go with the deleted content, and ADR 0001 says data that only makes sense on live content is deleted with it.

## Consequences

- **Every query that returns quacks must include the count and `likedByMe`.** The feed, Mine and search share one repository include and mapping, so this is one place in the backend; the domain type, `QuackResponseDto` and the frontend zod schema gain `likeCount` and `likedByMe`.
- **Reading quacks needs the viewer.** `likedByMe` depends on who asks, so repository methods that return quacks take the signed-in user's id.
- **The delete code has one more thing to erase.** Turning a quack into a placeholder must delete its likes; a test guards it, since a forgotten delete would leave likes on a placeholder with nothing to show them.
- **Like and unlike are idempotent `PUT` and `DELETE` on `/api/quacks/:id/like`.** Clients (and the optimistic UI) can retry or double-click without errors or double counting.
- **Sorting or filtering by likes** (not planned) would need a count per quack in SQL; with many likes that is the point to reconsider the denormalised counter.
- **Showing who liked a quack** (not planned) needs no schema change: the rows already hold it. Exposing it is a product and privacy decision, not a storage one.
- **Changing this later is cheap.** The table is the source of truth; a counter, a "liked at" listing or likes on replies (a separate table or a nullable target) can be added without losing data.
