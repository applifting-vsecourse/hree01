# Plan: polls in quacks

Implements [story.md](story.md). Branch `feature/polls` is based on `feature/user-settings` (it builds on `QuackForm`, `MoodSelect` and the API error fix there); rebase onto `main` once that branch is merged.

## Data model (Prisma)

```prisma
enum PollResultsVisibility {
  immediately
  after_vote
  @@map("poll_results_visibility")
}

model Poll {
  id                String                @id @default(cuid())
  quack             Quack                 @relation(fields: [quackId], references: [id], onDelete: Cascade)
  quackId           String                @unique          // 1 quack : 0..1 poll
  resultsVisibility PollResultsVisibility @default(immediately)
  closedAt          DateTime?                              // null = open; closing is permanent
  createdAt         DateTime              @default(now())
  options           PollOption[]
  votes             PollVote[]
  @@map("poll")
}

model PollOption {
  id       String     @id @default(cuid())
  poll     Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId   String
  text     String     @db.VarChar(80)
  position Int                                             // display order
  votes    PollVote[]
  @@unique([pollId, position])
  @@unique([id, pollId])                                   // target for the vote's composite FK
  @@map("poll_option")
}

model PollVote {
  id        String     @id @default(cuid())
  poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  pollId    String
  option    PollOption @relation(fields: [optionId, pollId], references: [id, pollId], onDelete: Cascade)
  optionId  String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  @@unique([pollId, userId])                               // one person, one vote, enforced by the DB
  @@index([optionId])
  @@map("poll_vote")
}
```

Why it looks like this:

- **One vote per person is enforced by the database** through `@@unique([pollId, userId])`, not by code. Two concurrent clicks can't create two votes.
- **A vote can't point to another poll's option.** The composite foreign key `[optionId, pollId]` guarantees it. It costs one line and rules out a whole class of bugs.
- **A vote is changed in place, not deleted and recreated.** Its `createdAt` and `updatedAt` then give the report what it needs directly.
- **Counts are never stored; the server computes them on every read.** A stored count could drift from the actual votes, and the story requires the numbers to be right for everyone.
- **Case-insensitive option uniqueness is enforced by validation only,** not by the database. Options are created once, in a single transaction, so there is no race to guard against.

## Endpoints

| Method   | Path                       | What it does                                                                                                                      | Errors                                        |
| -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `POST`   | `/api/quacks`              | Accepts an optional `poll: { options: string[], resultsVisibility }`. The quack, poll and options are created in one transaction. | 400                                           |
| `GET`    | `/api/quacks`              | Each quack also has `poll: PollView \| null`.                                                                                     | —                                             |
| `PUT`    | `/api/polls/:pollId/vote`  | Body `{ optionId }`. Creates or moves the vote (upsert) and returns `PollView`.                                                   | 400 option from another poll, 404, 409 closed |
| `DELETE` | `/api/polls/:pollId/vote`  | Removes the vote and returns `PollView`.                                                                                          | 404, 409 closed                               |
| `POST`   | `/api/polls/:pollId/close` | Closes the poll; only the author may. Returns `PollView`.                                                                         | 403, 404                                      |

```ts
PollView = {
  id, resultsVisibility, isClosed, isAuthor,
  myOptionId: string | null,
  resultsVisible: boolean,
  totalVotes: number | null,                         // null while hidden
  options: { id, text, votes: number | null }[],     // ordered by position
}
```

Key decisions:

- **The server decides whether results are visible.** While results are hidden, the counts are not sent at all (`null`); otherwise they could be read in DevTools. The rule: results are visible if the poll is `immediately`, the viewer has voted, or the poll is closed. It is a pure function with unit tests.
- **Voting and closing are safe to repeat.** Repeating `PUT` or `DELETE` gives the same result, so "Try again" and late responses can't break anything. Every response returns the current poll state, so the client doesn't have to reload the whole feed after a vote.
- **The feed loads in three queries regardless of how many polls it contains:** quacks with polls and options, a `groupBy` of counts per option, and the viewer's own votes.
- **Search is unchanged.** The question is the quack's text, which search already covers.

## Frontend (all in the `quack` feature; a poll is part of a quack)

- **Display:** `PollView` in the zod schema and a `Poll` component inside `QuackItem`. Options are buttons with `aria-pressed`. It shows the count, percentage, "Your vote" marker, total votes, the "Closed" state and "Results appear after you vote".
- **Voting:** a `useVote` hook with an optimistic update:
  - The immediate change is written into every quack list in the cache, including search results.
  - On error the previous state comes back, and the poll shows "Your vote didn't go through" with a "Try again" button.
  - When the request settles, the server's state is shown.
  - Mutations on the same poll run in order (`scope: { id: pollId }`), so the server receives clicks in the order they happened and the last one wins.
- **Closing:** `ClosePollDialog` built on the kit's `dialog`. Only the author sees the button.
- **Creating:** `PollEditor` inside `QuackForm`, using `useFieldArray`. It has "Add poll", "Add option", remove buttons for options, and a "Show results" choice. The choice uses the kit's `radio-group`, added with the shadcn CLI. The limits are shared constants, the same as in the DTO.

## Order

1. **Schema, migration, domain types, and a seed with sample polls** (open, results after voting, closed). From here on, every later step has data to build on.
2. **Reading polls:** repository with three queries, the results-visibility function, and `GET /api/quacks` extended with `poll`. Unit tests for visibility.
3. **Voting and closing:** `PUT`/`DELETE` vote and `close` endpoints, with service tests (closed poll, option from another poll, closing by someone other than the author).
4. **Creating a poll:** nested DTO (2–10 options, trimmed, max 80 characters, case-insensitive uniqueness) and the transaction. At this point **the backend is done** and can be exercised end to end in Swagger.
5. **Frontend: read-only `Poll` display,** on the seeded data. Tests for all three states (results visible, hidden, closed).
6. **Frontend: voting,** with the optimistic update, rollback, error message and "Try again". Tests include failures.
7. **Frontend: close dialog.**
8. **Frontend: `PollEditor` in the form.** It comes last because the earlier steps can be built against the seed, and the editor is the largest piece of UI.
9. **Pass through the review checklist, and add the SQL query for the weekly report** to the backend README.

Each step ends with passing tests and can be committed on its own. Steps 1–4 and 5–8 could be two separate PRs if smaller reviews are preferred.

## Known deviation from CLAUDE.md

Errors on a specific option (empty, duplicate, too long) are caught by client validation and shown at that option. If the server alone found the same error, it would appear in the `Alert` above the form rather than at the option. Mapping Nest's nested validation errors to individual fields would take a lot of work for a case that doesn't happen in practice, since the client validates with the same rules.
