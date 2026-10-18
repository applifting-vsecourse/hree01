# Polls in quacks

As someone asking the group a question (like where to go for lunch), I want to attach answer options to my quack and let people vote, so that everyone sees correct counts without anyone tallying replies by hand.

## Acceptance criteria

### Creating a poll

- The new-quack form has an "Add poll" button. It adds two empty option fields. "Add option" adds more, up to 10, and each option can be removed down to 2. The whole poll can be removed.
- The quack's text is the question, with the same rules as today: required, at most 280 characters.
- Each option is trimmed, required and at most 80 characters, and no two options may be the same (ignoring case). Both client and server validate this, and the error appears under the specific option.
- A "Show results" choice offers **Right away** (default) or **After voting**.
- A poll can have a mood like any quack. Polls and options can't be edited after posting.

### Voting

- Any signed-in user can vote, including the author. One person has one vote per poll, and the database enforces this.
- Clicking an option votes for it. Clicking another option moves the vote, and clicking your own option again removes it.
- Voting feels instant: the selection updates immediately on click, and so do the counts when they are visible. On an "After voting" poll the results appear once the server responds, since the counts aren't known before then. If rapid clicks overlap, the last click wins. Once the server responds, its numbers are shown.
- If a vote fails, the poll goes back to its previous state. Under the poll it says "Your vote didn't go through" with a "Try again" button.
- Options are buttons with `aria-pressed`. Your own vote is marked with an icon and the text "Your vote".

### Results

- Each option shows its vote count and percentage, and the poll shows the total number of votes. Percentages are whole numbers, so they may add up to 99 or 101 %.
- With **After voting**, people who haven't voted see only the options and "Results appear after you vote". Removing your vote hides the results again.
- The server counts the votes. Counts refresh after your own vote and when the tab regains focus. There are no live updates.
- Nobody, not even the author, can see who voted for what.

### Closing

- Only the author sees "Close poll". Closing is confirmed in a dialog and is permanent.
- A closed poll is marked "Closed". No one can vote or change a vote, and everyone sees the results, whichever results setting the poll had.

### Search

- Search finds a poll by its question (the quack text), not by its options.

### Measurement

- Polls and votes are stored with the time each vote was created and last changed. A developer prepares a weekly report on request, straight from the database: polls created, distinct poll authors, distinct voters, and average votes per poll. No new logging, no dashboard.
- A removed vote is deleted, so someone who voted and then removed their vote doesn't appear in the report.

## Out of scope

Multiple choices per person, deadlines, reopening a poll, voter names, live updates, editing a poll, images in options.

## Open for the PO

What weekly numbers would convince the PO that polls are worth developing further. It doesn't affect the implementation.
