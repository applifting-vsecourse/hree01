# Search the feed

As someone who remembers a word from a quack or who wrote it, I want to type something into a search field and see only the matching quacks, so that I can quickly find a quack I saw earlier.

## Acceptance criteria

### Searching

- A search field with a visible label sits above the feed.
- The feed filters as the user types (debounced by about 300 ms). Searching starts from 1 character.
- The search covers the quack's text, the author's name and the author's @username.
- A query with several words matches only quacks that contain every one of them, anywhere in the text or the author. For example, "duck pond" finds a quack by Caffeinated Duck that mentions a pond.
- Matching ignores letter case and diacritics and also works on part of a word: "caf" and "CAFE" both find "Café".
- Results keep the feed's order: newest first.
- An empty field, or one containing only spaces, shows the whole feed.
- A query is at most 100 characters. Both the client and the server enforce the limit, and the client shows the error under the field.

### State and navigation

- The query is in the URL (`/quacks?q=…`). It survives a reload and can be shared as a link. The Back button works.
- The field has a clear button with an `aria-label`.
- When nothing matches, the feed shows a sentence saying no quack matches, and a button to clear the search.
- Loading and error states (with a way to retry) work the same as in the feed.
- If the user posts a quack while a search is active, the search stays active. The new quack appears only if it matches the query.

### Measurement

- The server does the filtering (`GET /api/quacks?q=…`), not the browser.
- The backend writes every non-empty search to a structured log: user ID, time and number of results. The query text itself is not stored.
- From the log you can get **the number of unique users who searched in a week**, relative to active users, and **the share of searches with 0 results**. A developer prepares the report when the PO asks for it. No dashboard.

## Out of scope

Highlighting matches, searching by mood, date filters, suggestions and paginating results.

## Open for the PO

What share of users would convince the PO that search is worth developing further. It doesn't affect the implementation, but it is worth deciding before the numbers are in.
