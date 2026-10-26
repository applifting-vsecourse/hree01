# Moderators remove any quack

As a moderator, I want to remove any quack, so that nasty quacks don't stay in the feed when their author won't delete them.

## Acceptance criteria

### Who is a moderator

- Every account with the `admin` role is a moderator. Today that is `admin@example.com` from the seed. There is no new role and no way to grant or revoke the role in the app.

### Server

- `DELETE /api/quacks/:quackId` deletes the quack when the caller is its author **or** an admin. Anyone else gets 403 with "You can only delete your own quacks", exactly as today; a missing quack is 404, a signed-out caller 401.
- The rule lives in the service, so it holds for direct API calls, not just the UI.
- A removed quack goes with its poll, options and votes, the same as when the author deletes it.
- When an admin removes **someone else's** quack, the server logs one line with the event name, the moderator's id, the author's id, the quack's id and the time. The quack's text is not logged. An admin deleting their own quack is an ordinary delete and is not logged.

### UI

- On their own quacks, everyone (admins included) keeps the trash-can delete with the "Delete this quack?" dialog.
- On someone else's quack, an admin sees a small ghost button with a shield icon and the text "Remove". Other users see no action, as today.
- "Remove" opens a confirmation dialog:
  - Title: "Remove @username's quack?"
  - Text: "You're removing it as a moderator. It disappears from the feed for everyone, together with its poll and votes. This can't be undone."
  - Buttons: "Keep it" and a destructive "Remove".
- After removal the quack disappears from every list (All, Mine, search results) and a toast says "Quack removed". If it fails, the dialog stays open with the API's message.

## Out of scope

- Notifying the author.
- An undo, a moderation history page or a list of removed quacks.
- Editing quacks, hiding instead of deleting, reporting quacks, banning users.
