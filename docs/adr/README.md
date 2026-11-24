# Architecture decision records

Decisions that are hard to undo and affect more of the app than the feature that introduced them. Check this list before changing the data model or the structure of the app; add a record when you make such a decision.

| #                                                  | Title                                                                     | Status   | Summary                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](0001-deleted-quacks-become-placeholders.md) | Deleted quacks with replies become placeholders with their content erased | Accepted | A quack that others replied to is never hard-deleted: its text, mood and poll are erased, the row stays for its replies, and it goes once the last reply is gone.                               |
| [0002](0002-likes.md)                              | Likes are rows in a `Like` table, counted when quacks are read            | Accepted | One row per person per quack with primary key `(quackId, userId)`, so the database enforces "only once"; the count and `likedByMe` are computed on read, and likes go with the quack's content. |
