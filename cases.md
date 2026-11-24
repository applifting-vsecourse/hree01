# Likes — cases

> "People want to show they like a quack without having to reply. I want a like button and a like count on every quack. Everyone can like a quack only once, and take the like back."
> — product owner

These cases are the contract for the likes feature. Tests are written from them before the implementation; each case below should map to at least one test.

## Decisions

| Question                                       | Decision                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Can I like my own quack?                       | Yes.                                                                                                                                 |
| What happens to likes when a quack is deleted? | They go with it. A placeholder (deleted quack kept for its replies) has no likes, shows no like button or count, and can't be liked. |
| Can people see who liked a quack?              | No, only the count.                                                                                                                  |
| Can replies be liked?                          | No, only quacks.                                                                                                                     |
| When does the button change?                   | Immediately on click. If the server fails, it reverts and a toast explains.                                                          |
| Is liking twice (or unliking twice) an error?  | No. Both requests succeed and leave the state as it is.                                                                              |
| Do moderators have special powers over likes?  | No. An admin likes like anyone else and can't remove other people's likes.                                                           |

Out of scope: a list of who liked a quack, liking replies, sorting or filtering the feed by likes, notifications.

## Rules (unit tests)

### Liking and unliking (backend service)

**R1. Liking a quack counts one like**

- Given a live quack with 0 likes
- When I like it
- Then it has 1 like and it is liked by me

**R2. One person, one like**

- Given a live quack I have already liked, with 1 like
- When I like it again
- Then it still has 1 like and it is still liked by me

**R3. Taking a like back**

- Given a live quack I have liked, with 1 like
- When I take my like back
- Then it has 0 likes and it is not liked by me

**R4. Taking back a like I never gave changes nothing**

- Given a live quack with 2 likes, none of them mine
- When I take my like back
- Then it still has 2 likes and it is not liked by me

**R5. Each person's like is their own**

- Given a live quack with 0 likes
- When Alice and Bob both like it
- Then it has 2 likes, it is liked by Alice and by Bob, and it is not liked by Carol

**R6. Taking back my like leaves other likes alone**

- Given a live quack liked by me and by Bob
- When I take my like back
- Then it has 1 like, it is liked by Bob and not by me

**R7. I can like my own quack**

- Given a live quack I wrote
- When I like it
- Then it has 1 like and it is liked by me

**R8. A moderator likes like everyone else**

- Given a live quack liked by Bob
- When an admin takes "their" like back
- Then Bob's like stays and the quack still has 1 like

**R9. A deleted quack can't be liked or unliked**

- Given a placeholder (a deleted quack kept for its replies)
- When I like it, or take a like back
- Then it is reported as not found, and nothing is stored

**R10. A quack that doesn't exist can't be liked**

- Given no quack with the id I send
- When I like it
- Then it is reported as not found

### Deleting quacks (backend service and data)

**R11. Deleting a quack without replies removes its likes**

- Given a live quack with no replies and 3 likes
- When its author deletes it
- Then the quack and its likes are gone

**R12. A quack that becomes a placeholder loses its likes**

- Given a live quack with replies and 3 likes
- When its author, or a moderator, deletes it
- Then it becomes a placeholder with 0 likes, and its replies stay

### Like button (frontend components)

**R13. Every live quack shows its count, even 0**

- Given a live quack with 0 likes that I haven't liked
- When the feed shows it
- Then it has a "Like" button that is not pressed and shows 0

**R14. A quack I liked looks liked**

- Given a live quack with 4 likes, one of them mine
- When the feed shows it
- Then its "Like" button is pressed and shows 4

**R15. A click changes the button right away**

- Given a live quack with 1 like that I haven't liked
- When I click "Like"
- Then the button is pressed and shows 2 before the server answers

**R16. A failed click is undone and explained**

- Given a live quack with 1 like that I haven't liked, and the server will fail
- When I click "Like"
- Then the button goes back to not pressed with 1, and a toast says the like couldn't be saved

**R17. Fast clicks end where the last click left them**

- Given a live quack with 0 likes that I haven't liked
- When I click "Like" three times quickly (like, unlike, like)
- Then the button is pressed and shows 1, and the last request sent is a like

**R18. A placeholder has no like button**

- Given a placeholder
- When the feed shows it
- Then it shows no like button and no like count

## API behaviour (integration tests)

Endpoints ([ADR 0002](docs/adr/0002-likes.md)):
`PUT /api/quacks/:id/like` likes, `DELETE /api/quacks/:id/like` takes the like back. Both return the quack's `likeCount` and `likedByMe`. Every quack in `GET /api/quacks` carries `likeCount` and `likedByMe`.

**A1. Signed-out visitors can't like**

- Given I am signed out
- When I like or unlike a quack
- Then I get 401 and nothing is stored

**A2. Liking returns the new state**

- Given I am signed in and a live quack has 0 likes
- When I send `PUT /api/quacks/:id/like`
- Then I get 200 with `likeCount: 1` and `likedByMe: true`

**A3. Liking twice is not an error**

- Given I have liked a quack
- When I send `PUT /api/quacks/:id/like` again
- Then I get 200 with `likeCount: 1` and `likedByMe: true`

**A4. Unliking returns the new state**

- Given I have liked a quack that has 1 like
- When I send `DELETE /api/quacks/:id/like`
- Then I get 200 with `likeCount: 0` and `likedByMe: false`

**A5. Unliking twice is not an error**

- Given I haven't liked a quack that has 0 likes
- When I send `DELETE /api/quacks/:id/like`
- Then I get 200 with `likeCount: 0` and `likedByMe: false`

**A6. The feed shows each quack's count and my own state**

- Given quack Q1 is liked by me and Bob, and quack Q2 by nobody
- When I load `GET /api/quacks`
- Then Q1 has `likeCount: 2, likedByMe: true` and Q2 has `likeCount: 0, likedByMe: false`
- And when Carol loads it, Q1 has `likeCount: 2, likedByMe: false`

**A7. Counts are the same in Mine and in search results**

- Given my quack "café quack" is liked by Bob
- When I load `GET /api/quacks?mine=true`, and `GET /api/quacks?q=café`
- Then in both it has `likeCount: 1, likedByMe: false`

**A8. Liking doesn't change the order of the feed**

- Given an older quack and a newer quack
- When the older one gets liked
- Then `GET /api/quacks` still lists the newer one first

**A9. Liking a quack that doesn't exist**

- Given no quack with the id
- When I send `PUT /api/quacks/:id/like`
- Then I get 404

**A10. Liking or unliking a placeholder**

- Given a placeholder
- When I send `PUT` or `DELETE /api/quacks/:id/like`
- Then I get 404

**A11. A placeholder carries no likes**

- Given a quack with replies and 2 likes
- When its author deletes it and I load `GET /api/quacks`
- Then the placeholder has `likeCount: 0` and `likedByMe: false`

**A12. Simultaneous likes are all counted**

- Given a live quack with 0 likes
- When five users like it at the same time, and one of them sends the like twice at once
- Then it has 5 likes

**A13. Quacks with a poll or replies are liked normally**

- Given a quack with a poll, and a quack with replies
- When I like each of them
- Then each has `likeCount: 1, likedByMe: true`, and the poll and the replies are unchanged

## End-to-end flows

**E1. Like, see it stick, take it back**

- Given I am signed in and a quack by someone else has 0 likes
- When I click its "Like" button
- Then the button is pressed and shows 1
- When I reload the page
- Then the button is still pressed and shows 1
- When I click it again
- Then it is not pressed and shows 0, also after a reload

**E2. Someone else sees my like in the count, not as theirs**

- Given I have liked a quack, so it shows 1
- When another user signs in and opens the feed
- Then they see the quack with 1 like and a "Like" button that is not pressed
