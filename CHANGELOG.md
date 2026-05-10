# lftcrwd Changelog

All notable changes to lftcrwd — the coaching platform for online coaches and their clients.

---

## v1.0.1 — 2026-05-10

- Fix: message notification dot no longer persists after visiting the Messages page (race condition between Nav's checkUnread and the localStorage lastSeen timestamp)

---

## v1.0.0 — 2026-04-26

- Initial public release
- Trainer-client coaching platform: workouts, meals, progress, messages, check-ins
- Screen wake lock during hypertrophy rest timer

## v0.2.0-beta — 2026-04-25

- Nav restructure: replaced Nutrition tab with Messages; unread dot moved to Messages icon
- Today page: removed weight from Log section (weight lives on Progress), added Meals quick link near top of page
- Profile page: removed duplicate Trainer Messages section (Messages has its own tab now)
- Rename: "Nutrition" → "Meals" across all user-facing labels (page title, link, trainer views)
- Versioning: added to `package.json` (`0.2.0-beta`), version displayed on Profile page; CHANGELOG now uses version headers

---

## v0.1.0-beta — 2026-04-25

- Fix invite link expired error: `/auth/confirm` now detects `#error=otp_expired` hash and shows "Link expired — ask your coach to send a new one" instead of raw "No auth tokens found" message

## 2026-04-25 (4)

- Progress photos (client): upload button on Progress page → stored in `progress-photos` Supabase bucket; date-stamped grid with lightbox viewer
- Progress photos (trainer): Photos tab on client detail page showing the client's full upload history
- Report Issue on mobile: added to trainer dashboard mobile view (same area/severity/description form as desktop sidebar)
- Fix Report Issue: switched from `labelNames` to `labelIds` — "Coach Report" label now exists in Linear and issues flow correctly

## 2026-04-25 (3)

- Unread message dot: green dot on Profile nav icon (mobile + desktop) when trainer sends a new message; clears on visiting /messages
- Messages retheme: switched from orange to lftcrwd green (#30d158) for client message bubbles, input focus ring, and send button
- Coach session notes: emoji quick-reaction row (👍 🔥 💪 ✅) + custom note textarea in session detail modal; sends via existing trainer message API
- Session note state resets on each new session open

## 2026-04-25 (2)

- Mobile summary card: 2-col card above segmented control on client detail page (mobile only) — today's workout/protein/cardio, this week's workouts, last weight, warning if 3+ days quiet
- Compliance %: trainer client list now shows weekly compliance (workouts this week / 5 expected) instead of raw count
- Needs attention badge: amber "Xd quiet" pill next to client name when no activity for 3+ days
- Report Issue: AlertCircle button in trainer sidebar → form with area, severity, description → creates Linear issue in lftcrwd Beta project tagged Coach Report

## 2026-04-25 (1)

- Invite email: switched from silent Supabase user creation to magic-link generation + branded Resend email (lib/email.ts) with onboarding content, feature highlights, and a "Get Started" CTA
- Re-invite: sending a second invite to an existing client now generates a fresh magic link instead of erroring
- Onboarding empty state: new clients see a welcome screen on first login instead of a blank dashboard; dismissed via "Let's go" and remembered in localStorage
- Completion ring: replaced the plain goals counter on the Today dashboard with an SVG progress ring, live progress arc, and "X left today / All done 🎉" label
- Linear project created: "lftcrwd Beta" for tracking bugs, UX issues, and coach-reported feedback during beta (starts 2026-04-28)

## 2026-04-24

- Mobile trainer client list: replaced wall-of-cards with compact iOS-style grouped list — avatar with active-today dot, name + inline stat line (workouts · protein/weight), summary header showing active count
- Removed archive from list view (destructive action, rarely needed inline)

## 2026-04-24

- Client detail page: iOS segmented control with BarChart2/Dumbbell icons replacing plain text tabs
- Activity tab: 3-column desktop layout (sessions / compliance+cardio+meals / weight+progress)
- Program tab: Meal plan + Workout plan stay 2-col; Chat moves to full-width row below
- Desktop: back link and 'Trainer View' label hidden (sidebar handles navigation context)
- Quick stats: card tiles with dark background on desktop; surface-less on mobile

## 2026-04-24

- Trainer desktop workstation: two-column layout with fixed sidebar (client list, active-today indicators, invite form, sign out) and scrollable content panel
- AppShell component: trainer routes bypass root layout padding/margin so the trainer layout owns its own structure
- Trainer overview page: desktop shows stats summary (total clients, active today, weekly sessions) + branding; mobile view unchanged

## 2026-04-15

- Added workout export to profile: date range picker, format selector (Markdown, Excel/CSV, Word, PDF/Print), zero new dependencies — all client-side
- Collapsed trainer chat in profile to a compact link row with last message preview; full chat remains at /messages
- Removed bulk/cut/recomp/weight-loss category feature — deleted category selector UI, API route, and all related state
- Rebrand to Nike-style theme: pure black backgrounds, `#111111` cards, `#30d158` green accent — replaces all orange (`#ff9500`) and iOS dark gray (`#1c1c1e`)
- Removed cardio section from workout screen

## 2026-04-15 (1)

- Default weight is now 15 lbs when no previous session data exists (instead of empty)
- Added iOS-style Hypertrophy Timer toggle below the days row — defaults to OFF; timer only auto-starts when enabled

---
