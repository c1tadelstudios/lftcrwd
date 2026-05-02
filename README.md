# lftcrwd

A coaching platform built for personal trainers and their clients. Coaches manage programs, track compliance, and communicate. Clients log workouts, meals, and progress.

**Live:** [app.lftcrwd.com](https://app.lftcrwd.com)

---

## Screenshots

| Trainer Dashboard | Client Today | Workout Logger |
|---|---|---|
| ![Trainer Dashboard](screenshots/trainer-dashboard.png) | ![Client Today](screenshots/client-today.png) | ![Workout Logger](screenshots/workout-logger.png) |

| Client Detail | Progress | Messages |
|---|---|---|
| ![Client Detail](screenshots/client-detail.png) | ![Progress](screenshots/progress.png) | ![Messages](screenshots/messages.png) |

---

## Features

### For coaches

**Dashboard**
- Two-column desktop layout: fixed client list sidebar + scrollable content area
- Mobile: iOS-style client list with avatar, active-today indicator, and a stat line per client
- Weekly compliance % per client (workouts completed vs. 5 expected)
- "Needs attention" badge — amber pill when a client has been quiet for 3+ days

**Client management**
- Invite clients by email — sends a branded magic link onboarding email via Resend
- Re-invite at any time with a fresh link
- Remove a client (soft delete — data is kept)

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

---

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
- Log protein (g), water (oz), creatine toggle, cardio (Treadmill / Stepper / Bike / Rower), steps, and weight
- All saves in real time to Supabase

**Meal plan**
- View the trainer-assigned plan — toggle each meal done
- Custom meal titles parsed from the trainer's markdown

**Progress**
- Weight trend chart over time
- Per-exercise max weight chart (progressive overload tracking)
- Progress photo uploads — 3-column date-stamped grid, lightbox viewer
- Photos stored in a private Supabase Storage bucket, served via signed URLs

**Messaging**
- Direct chat thread with the trainer
- Unread dot on the nav icon when a new trainer message arrives; clears on visit

**Profile & export**
- Gravatar avatar with initials fallback
- Export workout history as Markdown, CSV, Word, or PDF — all client-side, no dependencies

---

## Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4
- **Database & Auth:** Supabase (PostgreSQL + magic link auth)
- **Email:** Resend
- **Deployment:** Vercel

---

## Running locally

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/lftcrwd.git
cd lftcrwd
npm install
```

### 2. Set up Supabase

Create a project at [supabase.com](https://supabase.com). In the Supabase dashboard → SQL Editor, run `supabase-schema.sql` to create all tables, or apply migrations from the `migrations/` directory in order.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend — for invite emails (optional)
RESEND_API_KEY=re_your_key

# Linear — for in-app issue reporting from the trainer dashboard (optional)
# Get these from your Linear workspace: Settings → API (key) and the relevant project/team/label IDs
LINEAR_API_KEY=lin_api_your_key
LINEAR_PROJECT_ID=your-project-id
LINEAR_TEAM_ID=your-team-id
LINEAR_LABEL_COACH_REPORT=your-label-id

# Public URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in at `/login` — the "Coach area" appears in the profile for admin accounts.

---

## Auth model

| Role | Auth method | Access |
|---|---|---|
| **Trainer** | Magic link (same as clients) + `is_admin` flag in Supabase | `/trainer/*` — all client data via "Coach area" in profile |
| **Client** | Magic link (email OTP via Supabase) | Their own data only |

Both roles log in the same way — via magic link at `/login`. The difference is the `is_admin` flag on the Supabase user account.

**To set up a trainer account:**
1. Create the trainer's account by inviting them (or having them sign in via `/login`)
2. In the Supabase dashboard → Authentication → Users → find the trainer's account
3. Edit their user and set `is_admin: true` in the **User Metadata** field:
   ```json
   { "is_admin": true }
   ```
4. The "Coach area" link will appear in their profile, giving access to `/trainer`

This is a single-trainer setup by default — there is no multi-trainer role system.

---

## Project structure

```
app/
  (auth)/             # Magic link confirm, login
  api/                # API routes (auth, trainer, feedback)
  trainer/            # Trainer portal pages
  workout/            # Client workout logger
  nutrition/          # Client meal view
  progress/           # Client progress photos and weight
  messages/           # Client ↔ trainer chat
  profile/            # Client profile and settings
components/           # Shared React components
lib/
  supabase.ts         # Browser Supabase client and DB helpers
  supabase-server.ts  # Server-side Supabase client
  supabase-admin.ts   # Admin client (service role)
  plan.ts             # Static plan data
hooks/                # Custom React hooks
middleware.ts         # Route protection
migrations/           # Database migrations
supabase-schema.sql   # Full schema — apply once to a new project
```

---

## License

[GNU Affero General Public License v3.0](LICENSE)

You are free to use, modify, and distribute this software. If you run a modified version as a network service, you must make the source code of your modifications available under the same license.
