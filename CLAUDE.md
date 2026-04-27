# lftcrwd

Crowd-sourced fitness. Find someone to lift with.

## What it is
A Tinder-style workout partner matching app. Users set availability status and get matched with nearby people who want to lift. Mutual match required before any contact — safety first.

## Product true north
Help people find real workout partners — travelers needing a same-day gym partner, or locals building a consistent training crew. Safety is non-negotiable: mutual match before any contact, gender preference filter controls who sees you and who can match with you.

## Tech stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4
- Supabase (auth, database, realtime)
- PWA mobile-first, iOS-aligned dark mode

## Availability states
- `here_now` — at a gym right now
- `looking` — want to lift today, nearby
- `scheduling` — looking for a recurring partner
- `offline` — not available

## Colors
- Background: #000000
- Cards: #1c1c1e
- Primary: #0a84ff (blue)
- Match/success: #30d158 (green)
- here_now badge: #30d158
- looking badge: #ff9500
- scheduling badge: #0a84ff
- offline: white/20

## Key directories
- app/ — Next.js App Router pages
- components/ — shared UI components
- lib/ — supabase client, types, helpers
- migrations/ — SQL migration files
