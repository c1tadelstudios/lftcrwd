# lftcrwd

A coaching platform built for personal trainers and their clients. Coaches manage programs, track compliance, and communicate. Clients log workouts, meals, and progress.

**App:** [app.lftcrwd.com](https://app.lftcrwd.com) · **Website:** [lftcrwd.com](https://lftcrwd.com) · **Changelog:** [lftcrwd.com/changelog](https://lftcrwd.com/changelog/)

---

## How it's built

| Part | Technology | Where |
|---|---|---|
| Website (front end) | WordPress | [lftcrwd.com](https://lftcrwd.com) — Home, Features, Changelog |
| App (back end) | Next.js 16 (App Router) on Node.js, Tailwind CSS 4 | [Spacefast](https://spacefast.com) — app.lftcrwd.com |
| Database | Spacefast Space database (MariaDB 11.8) | Spacefast |
| File storage | Spacefast storage (progress photos, profile photos) | Spacefast |
| Sign-in | Google (OAuth), invite-only | Google Cloud |
| Email | Resend | — |

The app moved from Vercel + Supabase to Spacefast in October 2026 (v1.1.0). The step-by-step migration guide is public: **[Migration from Vercel and Supabase to Spacefast](https://github.com/c1tadelstudios/spacefast/blob/main/migration-from-vercel-and-supabase-to-spacefast.md)**. Working notes are in [`spacefast/MIGRATION-NOTES.md`](spacefast/MIGRATION-NOTES.md).

---

## Screenshots

Coming soon.

---

## Features

### For coaches

**Dashboard**
- Two-column desktop layout: fixed client list sidebar + scrollable content area
- Mobile: iOS-style client list with avatar, active-today indicator, and a stat line per client
- Weekly compliance % per client (workouts completed vs. 5 expected)
- "Needs attention" badge — amber pill when a client has been quiet for 3+ days

**Client management**
- Invite clients by email — adds them to the client list and sends a branded onboarding email via Resend; they sign in with the Google account for that email
- Re-invite at any time (also restores an archived client)
- Remove a client (archived — their data is kept)

**Client detail view — three tabs**
- **Activity** — recent sessions, compliance heatmap, cardio history, meals log, weight trend chart, per-exercise overload charts
- **Program** — markdown workout plan editor, meal plan editor with per-meal calorie targets, direct message thread
- **Photos** — date-stamped grid of the client's progress photos with lightbox viewer

**Session notes**
- Emoji quick-reactions (👍 🔥 💪 ✅) that prefill a message to the client
- Custom note textarea — sends via the trainer message API

**Branding**
- Set a custom business name and tagline
- Appears on the client's Today dashboard header and in onboarding emails

### For clients

**Today dashboard**
- Live SVG completion ring tracking five daily goals: Protein / Water / Creatine / Cardio / Workout
- "All done today" state when all goals are hit
- One-tap workout CTA showing the next day from their assigned program
- Onboarding welcome screen for new clients (dismissed once)

**Workout logging**
- Log exercises by day with sets, reps, and weight
- Hypertrophy rest timer with screen wake lock (screen stays on between sets)
- Trainer-assigned program rendered inline as a reference

**Nutrition tracking**
- Log protein (g), water (oz), creatine toggle, cardio (Treadmill / Stepper / Bike / Rower, plus what you listened to), steps, and weight
- Everything saves in real time

**Meal plan**
- View the trainer-assigned plan — toggle each meal done
- Custom meal titles parsed from the trainer's markdown

**Progress**
- Weight trend chart over time
- Per-exercise max weight chart (progressive overload tracking)
- Progress photo uploads — 3-column date-stamped grid, lightbox viewer
- Photos are stored privately on Spacefast; only the client and the coach can view them. Large phone photos are resized in the browser to fit the 5 MB per-file limit.

**Messaging**
- Direct chat thread with the trainer
- Unread dot on the nav icon when a new trainer message arrives; clears on visit

**Profile & export**
- Profile photo (upload, or Gravatar) with initials fallback
- Export workout history as Markdown, CSV, Word, or PDF — all client-side, no dependencies

---

## Deploying

The app deploys from GitHub to a Spacefast Space: **pushing `main` deploys to production**; any other branch builds a private preview at `https://<space>--br-<branch>.space.fast`.

### 1. Create the Space

Create a Space on [Spacefast](https://spacefast.com) and connect this repository from its **Builds** page. Spacefast builds Next.js 16.2+ automatically.

### 2. Set environment variables

See [`.env.example`](.env.example). Mark the keys and secrets as **secret** in the Space (write-only — keep your own copy).

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | Signs the sign-in cookie. A long random string. |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth web client id |
| `GOOGLE_CLIENT_SECRET` | yes | Google OAuth web client secret |
| `NEXT_PUBLIC_SITE_URL` | yes | Public app URL, e.g. `https://app.lftcrwd.com` (used for links in emails) |
| `RESEND_API_KEY` | optional | Invite emails |
| `LINEAR_API_KEY`, `LINEAR_PROJECT_ID`, `LINEAR_TEAM_ID`, `LINEAR_LABEL_COACH_REPORT` | optional | In-app issue reporting from the trainer dashboard |

`NEXT_PUBLIC_*` values are baked in at build time — rebuild after changing them.

### 3. Create the database tables

In the Spacefast dashboard: your Space → **Database → Open db console**. In phpMyAdmin, **select the Space's existing database in the sidebar** (don't create a new one), then **Import** [`spacefast/schema.sql`](spacefast/schema.sql).

### 4. Set up Google sign-in

In [Google Cloud Console](https://console.cloud.google.com):
1. **OAuth consent screen** — External. While in Testing, add each person who may sign in as a test user.
2. **Credentials → Create OAuth client ID → Web application**, with one authorized redirect URI per hostname:
   - `https://<your-space>.space.fast/api/auth/google/callback`
   - `https://<your-space>--br-<branch>.space.fast/api/auth/google/callback` (branch previews)
   - `https://app.lftcrwd.com/api/auth/google/callback` (custom domain)

### 5. Add the first trainer

Sign-in is invite-only: only emails in the `users` table can sign in. Add yourself as the admin in the db console's SQL tab:

```sql
INSERT INTO users (email, name, is_admin) VALUES ('you@example.com', 'Your Name', TRUE);
```

Sign in with Google using that email; the "Coach area" appears in your profile. Invite clients from the trainer dashboard.

### 6. Custom domain (optional)

Space → **Domains → Add domain**, then create the records it lists at your DNS host (A records and one verification TXT record; remove any old CNAME on that name).

---

## Developing

- **Day to day:** push a branch and test on its private preview — the database and storage only exist on Spacefast.
- **Locally:** `npm install && npm run dev` runs the UI, but data calls need the Space's `env.DB` binding and fail locally. `npm run build` and `npx tsc --noEmit` work offline and catch most errors before pushing.
- **Database changes:** add the SQL to `spacefast/schema.sql` and run it in the db console. The app checks table and column names against [`lib/db/schema.ts`](lib/db/schema.ts) — add new columns there too.

---

## Auth and permissions

| Role | Sign-in | Access |
|---|---|---|
| **Trainer** | Google, with `is_admin = TRUE` in `users` | `/trainer/*` — all clients' data via "Coach area" in profile |
| **Client** | Google, invited by email | Their own data only |

- Google sign-in sets an HMAC-signed session cookie; [`middleware.ts`](middleware.ts) checks it on every request and passes the user to API routes.
- The browser reads and writes data through one endpoint, `/api/db`, which enforces ownership: clients can only touch rows with their own `user_id`, and the `users` table is off-limits. This replaces the row-level security the app had on Supabase.
- This is a single-trainer setup by default — there is no multi-trainer role system.

---

## Project structure

```
app/
  api/
    auth/             # Google sign-in, session (/me), sign out
    db/               # Browser data endpoint with ownership checks
    avatar/           # Profile photo upload and serving
    progress-photos/  # Progress photo upload, list, delete, serving
    trainer/          # Trainer-only APIs (clients, invites, plans, messages)
  login/              # Sign in with Google
  trainer/            # Trainer portal pages
  workout/            # Client workout logger
  nutrition/          # Client meal view
  progress/           # Client progress photos and weight
  messages/           # Client ↔ trainer chat
  profile/            # Client profile and settings
components/           # Shared React components
lib/
  db/
    query.ts          # Query builder (Supabase-style call shape)
    browser.ts        # Browser client → /api/db
    server.ts         # Runs queries on the Space database; ownership rules
    schema.ts         # Allowed tables and columns
  supabase.ts         # Name kept for existing imports — now the Spacefast data client
  supabase-admin.ts   # Server-side full-access data client
  session.ts          # Signed session cookie
  storage.ts          # Spacefast storage (upload / get / delete)
  image.ts            # In-browser photo resizing
  email.ts            # Resend invite emails
hooks/                # Custom React hooks
middleware.ts         # Route protection
spacefast/
  schema.sql          # Database schema — import once in the db console
  build_import.py     # Converts a Supabase backup into a MariaDB import
  MIGRATION-NOTES.md  # Notes from the Vercel + Supabase → Spacefast move
migrations/, supabase/, supabase-schema.sql   # Legacy Supabase SQL, kept for reference only
```

---

## License

[GNU Affero General Public License v3.0](LICENSE)

You are free to use, modify, and distribute this software. If you run a modified version as a network service, you must make the source code of your modifications available under the same license.
