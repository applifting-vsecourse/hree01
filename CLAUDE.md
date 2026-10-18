# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

In this repo the CLI also imports `cn` from an npm package called `cn` and adds that package to `package.json` and `pnpm-lock.yaml`. Point the import back at `@/lib/utils`, and revert both files (`radix-ui` is already installed, so the component needs no new dependency).

### Forms follow the settings form

[`ProfileForm`](apps/frontend/src/features/profile/components/ProfileForm.tsx) is the reference. On top of the form rules in [`DESIGN.md`](DESIGN.md):

- **Limits live in one place per side.** The zod schema uses the same constants and messages as the DTO, so client and server never disagree about what is valid.
- **A server error about one field goes to that field.** Return it with a specific status (e.g. 409), then `form.setError(field, { message }, { shouldFocus: true })`. What the user typed stays. Only errors that belong to no field go in the `Alert` above the form.
- **Use the message the API returns.** The API client copies the API's message onto the error (`error.message`); never re-read `error.response`, because ky v2 has already consumed the body.
- **Edit forms start from saved data and treat the last save as the baseline.** Mount the form only once the data has loaded, keyed by its id, so a background refetch can't wipe unsaved edits. On success, `form.reset(saved)`, then show a toast. "Discard changes" is `form.reset()`.
- **After saving, refresh everything that shows the data.** If the change shows up in another feature (a name in the header, an author in the feed), invalidate those queries too. Don't import across features to do it.
- **Test the review checklist, not just the happy path:** Enter submits, an empty required field gets focus and an error written out in words, a server field error lands on its field with the input kept, and discard restores the saved values.

### Everything in the repo is in English

The team may talk to you in another language (often Czech). Answer in that language, but everything you write into the repo is English: UI copy, code, comments, test data, commit messages, and docs such as user stories. Translate requirements as you implement them; don't carry the conversation's language into files.

Test data that needs accented characters (e.g. diacritics-insensitive matching) uses English words that have them — "café", "naïve" — not words from the conversation's language. Proper names stay as they are.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it. Don't start a second instance, don't restart it, don't run `pnpm dev`.

Don't reach for the browser to check your own work. Tests and type-checks are the evidence; open the running app when asked to, not on your own initiative.
