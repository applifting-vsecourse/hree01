# Plan: polls in quacks

Implements [story.md](story.md). Branch `feature/polls` is based on `feature/user-settings` (it builds on `QuackForm`, `MoodSelect` and the API error fix there); rebase onto `main` once that branch is merged.

## Data model (Prisma)

```prisma
enum PollResultsVisibility {
  right_away
  after_voting
  @@map("poll_results_visibility")
}

model Poll {
  quack             Quack                 @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId           String                @id              // 1 quack : 0..1 poll, so the quack's id is the poll's id
  resultsVisibility PollResultsVisibility @default(right_away)
  closedAt          DateTime?                              // null = open; closing is permanent
  createdAt         DateTime              @default(now())
  options           PollOption[]
  votes             PollVote[]
  @@map("poll")
}

model PollOption {
  id       String     @id @default(cuid())
  poll     Poll       @relation(fields: [quackId], references: [quackId], onDelete: Cascade)
  quackId  String
  text     String     @db.VarChar(80)
  position Int                                             // display order
  votes    PollVote[]
  @@unique([quackId, position])
  @@unique([id, quackId])                                  // target for the vote's composite FK
  @@map("poll_option")
}

model PollVote {
  id        String     @id @default(cuid())
  poll      Poll       @relation(fields: [quackId], references: [quackId], onDelete: Cascade)
  quackId   String
  option    PollOption @relation(fields: [optionId, quackId], references: [id, quackId], onDelete: Cascade)
  optionId  String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  @@unique([quackId, userId])                              // one person, one vote, enforced by the DB
  @@index([optionId])
  @@map("poll_vote")
}
```

The migration also gets one hand-written line, since Prisma can't express an index on an expression:

```sql
CREATE UNIQUE INDEX "poll_option_quackId_lower_text_key" ON "poll_option" ("quackId", LOWER("text"));
```

Why it looks like this:

- **One vote per person is enforced by the database** through `@@unique([quackId, userId])`, not by code. Two concurrent clicks can't create two votes.
- **A vote can't point to another poll's option.** The composite foreign key `[optionId, quackId]` guarantees it. It costs one line and rules out a whole class of bugs.
- **A poll has no id of its own.** It is 1:1 with its quack, so `quackId` is the primary key. That drops a redundant id and unique constraint, and the API talks about the quack the client already knows.
- **Enum values match the UI labels** ("Right away", "After voting"), so code, API and story use the same words.
- **A vote is changed in place, not deleted and recreated.** Its `createdAt` and `updatedAt` then give the report what it needs directly. A removed vote is deleted, so the report doesn't see people who voted and then removed their vote; that is acceptable for a first measurement.
- **Counts are never stored; the server computes them on every read.** A stored count could drift from the actual votes, and the story requires the numbers to be right for everyone.
- **Case-insensitive option uniqueness is also enforced by the database**, through the expression index above. Validation catches it first with a readable message; the index protects against writes that bypass validation (seed, future code).

The proposed model was checked with `prisma validate`.

## Endpoints

| Method   | Path                              | What it does                                                                                                                      | Errors                                        |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `POST`   | `/api/quacks`                     | Accepts an optional `poll: { options: string[], resultsVisibility }`. The quack, poll and options are created in one transaction. | 400                                           |
| `GET`    | `/api/quacks`                     | Each quack also has `poll: PollView \| null`.                                                                                     | —                                             |
| `PUT`    | `/api/quacks/:quackId/vote`       | Body `{ optionId }`. Creates or moves the vote and returns `PollView`.                                                            | 400 option from another poll, 404, 409 closed |
| `DELETE` | `/api/quacks/:quackId/vote`       | Removes the vote and returns `PollView`.                                                                                          | 404, 409 closed                               |
| `POST`   | `/api/quacks/:quackId/poll/close` | Closes the poll; only the author may. Returns `PollView`.                                                                         | 403, 404                                      |

```ts
PollView = {
  resultsVisibility, isClosed, isAuthor,
  myOptionId: string | null,
  resultsVisible: boolean,
  totalVotes: number | null,                         // null while hidden
  options: { id, text, votes: number | null }[],     // ordered by position
}
```

Key decisions:

- **The server decides whether results are visible.** While results are hidden, the counts are not sent at all (`null`); otherwise they could be read in DevTools. The rule: results are visible if the poll is `right_away`, the viewer has voted, or the poll is closed. It is a pure function with unit tests.
- **Voting and closing can't race each other.** Both run in a transaction that first locks the poll's row (`SELECT … FOR UPDATE`), then checks `closedAt`, then writes. Without the lock, a vote that checked "open" just before the author closed the poll would still be written, and the results of a closed poll would change.
- **Voting and closing are safe to repeat.** Repeating `PUT` or `DELETE` gives the same result, so "Try again" and late responses can't break anything. Closing an already closed poll returns it unchanged. Every response returns the current poll state, so the client doesn't have to reload the whole feed after a vote.
- **Database errors map to API errors.** A first vote from two tabs at once can hit the unique index (`P2002`): retry the write once. An option from another poll is rejected by the composite foreign key (`P2003`); the service checks it first so the 400 has a readable message.
- **The feed loads in three queries regardless of how many polls it contains:** quacks with polls and options, a `groupBy` of counts per option, and the viewer's own votes.
- **Percentages are whole numbers,** each rounded on its own, so they can add up to 99 or 101 %.
- **Search is unchanged.** The question is the quack's text, which search already covers.

## Frontend (all in the `quack` feature; a poll is part of a quack)

- **Display:** `PollView` in the zod schema and a `Poll` component inside `QuackItem`. Options are buttons with `aria-pressed`. It shows the count, percentage, "Your vote" marker, total votes, the "Closed" state and "Results appear after you vote".
- **Voting:** a `useVote` hook with an optimistic update. Mutations on the same poll run in order (`scope: { id: quackId }`), so the server receives clicks in the order they happened and the last one wins. TanStack runs `onMutate` immediately on click even while the request waits in that queue (checked in `@tanstack/query-core`), which shapes the rules below:
  - **On click:** cancel in-flight quack-list queries (so a focus refetch can't overwrite the click with stale data), then write the change into every quack list in the cache, including search results. The selection always changes immediately. Counts change immediately only if they are visible; on an "After voting" poll the results appear with the server's response, because the client doesn't have the counts until then.
  - **On response:** write the server's `PollView` only if no newer click on the same poll is still pending. Otherwise an intermediate response would flash the old choice over the newer one.
  - **On error:** no snapshot rollback. With queued clicks, a snapshot taken before click A would also wipe the still-pending click B. Instead, show "Your vote didn't go through" with "Try again" under the poll and refetch the feed; the server's state is the "previous state".
  - **After the last pending click on a poll settles:** invalidate the quack lists, so other people's votes come in too.
- **Closing:** `ClosePollDialog` built on the kit's `dialog`. Only the author sees the button.
- **Creating:** `PollEditor` inside `QuackForm`, using `useFieldArray`. It has "Add poll", "Add option", remove buttons for options, and a "Show results" choice. The choice uses the kit's `radio-group`, added with the shadcn CLI. The limits are shared constants, the same as in the DTO.

## Order

1. **Schema, migration (including the expression index), domain types, and a seed with sample polls** (open, results after voting, closed). From here on, every later step has data to build on.
2. **Reading polls:** repository with three queries, the results-visibility function, and `GET /api/quacks` extended with `poll`. Unit tests for visibility.
3. **Voting and closing:** `PUT`/`DELETE` vote and `close` endpoints with the row lock, with service tests (closed poll, option from another poll, closing by someone other than the author, `P2002` retry).
4. **Creating a poll:** nested DTO (2–10 options, trimmed, max 80 characters, case-insensitive uniqueness) and the transaction. At this point **the backend is done** and can be exercised end to end in Swagger.
5. **Frontend: read-only `Poll` display,** on the seeded data. Tests for all three states (results visible, hidden, closed) and percentage rounding.
6. **Frontend: voting,** following the rules above. Tests include a failed vote, two quick clicks where the first one fails, and an "After voting" poll revealing results on response.
7. **Frontend: close dialog.**
8. **Frontend: `PollEditor` in the form.** It comes last because the earlier steps can be built against the seed, and the editor is the largest piece of UI.
9. **Pass through the review checklist, and add the SQL query for the weekly report** to the backend README.

Each step ends with passing tests and can be committed on its own. Steps 1–4 and 5–8 could be two separate PRs if smaller reviews are preferred.

## Known deviation from CLAUDE.md

Errors on a specific option (empty, duplicate, too long) are caught by client validation and shown at that option. If the server alone found the same error, it would appear in the `Alert` above the form rather than at the option. Mapping Nest's nested validation errors to individual fields would take a lot of work for a case that doesn't happen in practice, since the client validates with the same rules.
