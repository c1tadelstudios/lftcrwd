# lftcrwd

A coaching platform built for personal trainers and their clients. Coaches manage programs, track compliance, and communicate. Clients log workouts, meals, and progress.

**Live:** [app.lftcrwd.com](https://app.lftcrwd.com)

---

## What it does

**For coaches:**
- Invite clients by email (magic link onboarding via Supabase + Resend)
- Assign workout and meal plans (markdown editor)
- Track client compliance — workout streaks, activity heatmaps, "quiet for X days" alerts
- View progress photos, weight trends, cardio history, and exercise overload charts
- Send session notes and messages directly to clients

**For clients:**
- Today dashboard with a live completion ring (Protein / Water / Creatine / Cardio / Workout)
- Workout logger with sets, reps, weight, and a hypertrophy rest timer
- Meal plan viewer and daily macro logging
- Progress photo uploads with a date-stamped grid
- Direct message thread with their coach

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

# Trainer portal password
APP_PASSWORD=choose-a-strong-password

# Session signing secret (32+ random characters)
SESSION_SECRET=your-random-secret

# Resend — for invite emails (optional)
RESEND_API_KEY=re_your_key

# Public URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The trainer portal is at `/trainer/login`.

---

## Auth model

| Role | Auth method | Access |
|---|---|---|
| **Trainer** | Password (`APP_PASSWORD` env var) | `/trainer/*` — all client data |
| **Client** | Magic link (email OTP via Supabase) | Their own data only |

This is a single-trainer setup. One `APP_PASSWORD` controls trainer access. Multi-trainer support is not currently implemented.

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
