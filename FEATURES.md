# lftcrwd — Feature Reference

Built for online coaches and their clients. Coaches manage, clients log.

---

## Architecture

| Component | Path | Stack |
|-----------|------|-------|
| **App** | `~/development/lftcrwd/` | Next.js App Router + Tailwind + Supabase |
| **Live** | `https://app.lftcrwd.com` | Vercel |
| **Email** | Resend — `hello@lftcrwd.com` | Magic links + invite emails |
| **Auth** | Supabase Auth — OTP for clients, password for trainer | |

---

## Coach Features

### Trainer Dashboard
Two-column layout on desktop: fixed left sidebar (client list, invite form, sign out) + scrollable content. Mobile shows a compact iOS-style client list with avatar, active-today green dot, and a stat line per client.

### Client Management
- Invite clients by email — generates a Supabase magic link and sends a branded onboarding email via Resend
- Re-invite an existing client at any time (sends a fresh magic link)
- Remove a client via the Danger Zone on their detail page (soft delete — data is kept)

### Client Detail View
Segmented control with three tabs:
- **Activity** — recent sessions, compliance heatmap, cardio history, meals, weight trend, exercise overload charts
- **Program** — meal plan editor (markdown + per-meal calorie targets), workout plan editor, direct chat
- **Photos** — date-stamped grid of the client's progress photos (uploaded by client, viewable in lightbox)

Mobile summary card above the tabs (mobile only): today's workout/protein/cardio, this week's workouts, last weight, amber warning if 3+ days since last activity.

### Coach Session Notes
In the session detail modal (Activity tab): emoji quick-reactions (👍 🔥 💪 ✅) that prefill a message, plus a custom note textarea. Sends via the existing trainer message API — client sees it in their chat thread.

### Trainer Compliance Signals
- **Weekly compliance %** on the client list: workouts this week / 5 expected
- **"Needs attention" badge**: amber `Xd quiet` pill next to a client's name when no activity for 3+ days

### Report Issue → Linear
AlertCircle button in the trainer sidebar (desktop) and at the bottom of the trainer dashboard (mobile). Opens a form with area (8 options), severity (4 levels), and description. Creates a Linear issue in the "lftcrwd Beta" project tagged "Coach Report".

### Branding
Set a custom business name and tagline that appear on the client's Today dashboard header and in invite emails. Collapsed behind a toggle row by default.

---

## Client Features

### Today Dashboard
- SVG completion ring showing goals complete (Protein / Water / Creatine / Cardio / Workout) with live progress arc
- "All done today 🎉" state when all goals hit
- Workout CTA — shows next day from the program, one-tap to start
- Onboarding welcome screen for brand-new clients (dismissed once, remembered in localStorage)

### Workout Logging
Log exercises by day with sets, reps, weight, and rest timer. Hypertrophy timer toggle. Custom trainer program displayed if assigned (markdown rendered).

### Nutrition Tracking
Track protein (g), water (oz/gallon), creatine toggle, cardio (Treadmill / Stepper / Bike / Rower with type-specific fields), steps, and weight. All saves in real time to Supabase.

### Meal Plan
View the trainer-assigned meal plan. Toggle each meal done. Custom meal titles parsed from trainer's markdown.

### Progress
- Weight trend chart and per-exercise max weight over time (progressive overload)
- Progress photo upload — 3-column grid, date-stamped, lightbox viewer
- Photos stored in the private `progress-photos` Supabase Storage bucket; served via signed URLs

### Messaging
Direct chat between client and trainer. Trainer messages show with a green unread dot on the Profile nav icon (mobile + desktop); dot clears on visiting `/messages`. Client messages shown in green (#30d158), trainer in dark grey.

### Profile & Export
Avatar (Gravatar / initials), recent sessions, workout export (Markdown / CSV / Word / PDF — client-side, no dependencies), sign out.

---

## Email

### Client Invite / Onboarding Email
Triggered when the coach invites a new client. Sends from `hello@lftcrwd.com` via Resend. Includes:
- Business name in subject line
- Magic login link ("Get Started →" CTA)
- Feature overview (workout logging, nutrition, progress)
- 24-hour expiry notice

---

## Design System

- **Background:** `#000000` (pure black)
- **Cards:** `#111111`
- **Accent:** `#30d158` (iOS green) — all CTAs, active states, highlights
- **Error:** `#ff453a` (iOS red)
- **Font:** `-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui`
- **Touch targets:** minimum 44×44px
- **Buttons:** `h-[50px]`, `rounded-[14px]`, `font-semibold text-[17px]`

---

## Templates / Pages

| Route | Description |
|-------|-------------|
| `/` | Today dashboard — daily goals, completion ring, workout CTA |
| `/workout` | Workout logger with trainer program |
| `/nutrition` | Meal tracking and plan |
| `/progress` | Weight/overload charts + progress photo upload |
| `/messages` | Client-trainer chat thread |
| `/profile` | Avatar, export, sign out |
| `/login` | Email OTP login |
| `/trainer` | Trainer dashboard — client list, invite, branding |
| `/trainer/[userId]` | Individual client — activity, program, chat |
| `/trainer/login` | Trainer password login |
