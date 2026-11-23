# 1. Deleted quacks with replies become placeholders with their content erased

## Status

Accepted (2026-11-10). Not implemented yet; introduced by the replies feature ([replies.story.md](../../replies.story.md)).

## Context

Until now, deleting a quack was a hard delete: the row went, and its poll, options and votes went with it by cascade. Nothing else in the app pointed at a quack, so that was enough.

Replies change this. A reply belongs to the person who wrote it, not to the author of the quack it answers. The product owner set two requirements that pull in opposite directions:

- When an author deletes a quack that already has replies, the replies must not disappear.
- When anyone deletes their quack, its content must really leave the app — not just be hidden.

A hard delete breaks the first requirement; hiding the row breaks the second. Whatever we pick sets how _every_ quack row can look, so it affects every place that reads quacks, not just replies.

## Decision

Deleting a quack depends on whether anyone has responded to it:

- **No replies:** hard delete, exactly as before.
- **Replies exist:** the row stays as a **placeholder**. In one transaction its `text` and `mood` are set to `NULL`, its poll (with options and votes) is deleted, and `deletedAt` and `deletedBy` (`author` | `moderator`) are set. `userId` is kept. Replies stay attached to the placeholder.
- **The last reply under a placeholder is deleted:** the placeholder is deleted in the same transaction.

The database enforces it:

- `Reply.quack` uses `onDelete: Restrict`, so a quack that has replies can't be hard-deleted by mistake.
- A `CHECK` constraint on `quack` allows only two states: live (`text` set, `deletedAt`/`deletedBy` null) or placeholder (`text` and `mood` null, `deletedAt`/`deletedBy` set).

## Options considered

- **Placeholder with erased content (chosen).** The only option that meets both requirements: replies keep their context, and the deleted text is gone from the database.
- **Hard delete, replies kept with `quackId` set to NULL** — rejected. The orphaned replies would have nowhere to be shown, and the link to the quack they answered would be lost for good.
- **Soft delete that keeps the text hidden** (`deletedAt` only) — rejected. Breaks "the content must really leave the app".
- **Block deleting a quack that has replies** — rejected. Breaks both requirements: an author would be unable to remove their own content.

Within the chosen option:

- **`userId` set to NULL on the placeholder** — rejected. It would make the author nullable in every type, DTO and permission check for one state, and the owner could never be traced again. A user id and a timestamp are kept as metadata; the content is not.
- **Placeholders kept forever** — rejected. The feed would fill with empty "This quack was deleted" rows.
- **One placeholder text, no `deletedBy`** — rejected. People in the discussion couldn't tell moderation from the author's own decision.

## Consequences

- **A quack row can be a placeholder.** `Quack.text` is nullable. All code that reads quacks must handle placeholders: the repository mapping, the domain type, `QuackResponseDto`, the frontend zod schema and `QuackItem`.
  - The feed shows placeholders.
  - Mine and search exclude them.
  - A placeholder can't be deleted again (404).
- **"Delete" no longer always means "the row is gone."** Code that counts or lists quacks must decide whether placeholders belong. The usual answer is "only where their replies need them".
- **New features that point at a quack must decide which side they are on.**
  - Content owned by other people stays when the quack is deleted: it joins replies in keeping a placeholder alive (examples: quoting a quack).
  - Data that only makes sense on live content is deleted with it (examples: likes, bookmarks, votes).
  - This must be decided in the feature's design, not discovered in the delete code.
- **Deleting a user account** (not a feature today) can't simply cascade. `Restrict` blocks deleting that user's quacks that others replied to, so an account-deletion feature must turn them into placeholders first.
- **Moderation** writes `deletedBy = moderator` when an admin deletes someone else's quack, so the outcome is visible in the data as well as in the server log.
- **Undoing this later is hard.** Once placeholders exist in production, going back to a non-nullable `text` means deleting them, and their replies with them, or giving them invented text.
