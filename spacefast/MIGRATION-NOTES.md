# Migration notes: Vercel + Supabase → Spacefast

Working log from moving **lftcrwd** (Next.js 16.2 App Router, Supabase Postgres + Auth + Storage, deployed on Vercel) fully onto **Spacefast**: hosting, database, sign-in and file storage. Source material for a public guide. No secrets or personal data here; placeholders are in `<angle brackets>`.

Status: code migrated on branch `spacefast`, verified locally; live cutover pending.

---

## 0. Starting point

| Piece | Before | After |
|---|---|---|
| Hosting | Vercel (GitHub integration, auto-deploy `main`) | Spacefast Space, connected to the same GitHub repo |
| Database | Supabase Postgres 17, row-level security (RLS) | Space database: **MariaDB 11.8**, reached as `env.DB` |
| Sign-in | Supabase Auth, email one-time codes | App's own **Google OAuth** + signed session cookie |
| Files | Supabase Storage buckets | Space storage binding `env.STORAGE` |

Plan for several days of work for an app this size (~5,000 lines touching Supabase, ~12 tables). Hosting alone took an afternoon; the database and auth are the real work.

## 1. Get the app building on Spacefast (hosting only)

1. Create a Space and connect the GitHub repo (Builds page). Install the Spacefast GitHub App on the account/org that owns the repo.
2. Spacefast builds Next.js automatically from **Next 16.2+** using a pinned OpenNext. Older Next needs a static export.
3. Copy environment variables into the Space. Leave out Vercel-only variables (`VERCEL_*`, Vercel KV/Blob, etc.).
4. **Gotcha — `NEXT_PUBLIC_*` values are baked in at build time.** After changing one, rebuild: `sf builds retry <latest bld_…> --yes` re-runs the build and picks up current settings.
5. **Gotcha — write-only secrets.** A variable saved as secret can't be read back by anyone; keep your own copy.
6. A Space is private by default. Making it public applies to the **live** version only; branch previews stay private.

## 2. Access for an agent / CLI

- Agent access uses a **handoff link** minted at `my.spacefast.com/start` (15 min, single use). **Switch to the right team first** — a link minted under another team only grants that team.
- The resulting API key may not include `access.manage` (can't create share links); open private previews yourself while signed in.
- `git push` over HTTPS needs a token or `gh auth login`; GitHub rejects account passwords.

## 3. Back up the Supabase project first

- API export (no DB password needed): with the service role key, page through every table via PostgREST, list users via `/auth/v1/admin/users`, download every Storage object.
- Real dump (needs the database password; reset it in Supabase if unknown — the app's API keys are unaffected):
  - No local Postgres tools? Use Docker: `docker run --rm -e PGPASSWORD=… postgres:17 pg_dump "<conn>" …`
  - Use the **Session pooler** host. For our project that was `aws-1-<region>.pooler.supabase.com` (the `aws-0` host answered "tenant not found"); the direct `db.<ref>.supabase.co` host is IPv6-only. User is `postgres.<project-ref>`.
  - Too many failed passwords can get your IP blocked by the pooler — stop after one failure.
  - Dump separately: `--schema=public --schema-only`, `--schema=public --data-only`, `auth.users`/`auth.identities` data, `storage.buckets` data, and the storage RLS policies (from `pg_policies`).
- **Gotcha — free Supabase projects pause after ~1 week idle.** A paused project's hostname stops resolving (NXDOMAIN), which looks like the project was deleted. Restore it from the dashboard.
- **Gotcha — repo migrations had drifted** from the live schema (tables created by hand, a migration never applied). Convert from the live dump, not the repo's SQL files.

## 4. Reaching the Space database from Next.js

The OpenNext Cloudflare context is on a global symbol; no extra package or config was needed:

```ts
const env = (globalThis as any)[Symbol.for('__cloudflare-context__')]?.env ?? {};
const { results } = await env.DB.prepare('select 1 as ok, version() as v').all();
// → [{ ok: 1, v: '11.8.9-MariaDB-log' }]
```

- `env.DB` is D1-shaped (`prepare(sql).bind(...).all()`), `?` placeholders, but the engine is **MariaDB**, not SQLite.
- No connection string is exposed, by design. Admin access is the dashboard's **db console** (phpMyAdmin).
- Mark DB routes `export const dynamic = 'force-dynamic'`.
- Tip: deploy a tiny probe route first that reports `hasDB`, binding names and a `select 1`, before rewriting anything.

## 5. Converting the schema (Postgres → MariaDB)

| Postgres | MariaDB |
|---|---|
| `uuid DEFAULT gen_random_uuid()` | `CHAR(36) DEFAULT (UUID())` (we generate ids in the app so writes can return the row) |
| `timestamptz DEFAULT now()` | `DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)`, always UTC |
| `jsonb` | `JSON` |
| `boolean` | `BOOLEAN` (comes back as 0/1 — normalize) |
| `numeric` | `DECIMAL(p,s)` (comes back as a string — normalize) |
| `CHECK (x = ANY (ARRAY[...]))` | `CHECK (x IN (...))` |
| FK to `auth.users` | FK to your own `users` table |
| `ON CONFLICT (...) DO UPDATE` | `INSERT ... ON DUPLICATE KEY UPDATE` |

- **Gotcha — `ON DUPLICATE KEY` fires on ANY unique key**, not just the one you meant. Never let a browser-supplied `id` into an upsert.
- Validate the converted schema against the same engine locally: `docker run mariadb:11.8`.
- Import: Spacefast has no import command; use the db console's **Import** (schema file first, then data).
- Python 3.9's `fromisoformat` rejects Postgres's 1–5 digit fractional seconds — pad to 6.

## 6. Replacing Supabase Auth

- Spacefast's built-in app sign-in (Google/Gravatar/Spacefast) is exposed to Zero apps; a Next.js app gets **no identity headers** (verified with a probe — only Spacefast's own access cookie). So the app does its own Google OAuth.
- Google Cloud Console: create an **OAuth client of type "Web application"** (a "Desktop" client won't accept redirect URIs). Add one redirect URI per hostname, including the branch preview alias.
- Flow: `/api/auth/google` (state cookie) → Google → `/api/auth/google/callback` (exchange code server-side, read the ID token's verified email) → look up `users` by email → set an HMAC-signed session cookie (Web Crypto, works in middleware).
- Invite-only: inviting a client = inserting their email into `users`.
- Middleware verifies the cookie and stamps `x-user-id` / `x-is-admin` for API routes (strip any client-sent copies first).

## 7. Replacing row-level security

The app queried Supabase **from the browser**, relying on RLS. With no browser-reachable database, we kept the call shape and moved the rules server-side:

- A small query builder with Supabase's chain (`from().select().eq().order().maybeSingle()`, `insert/update/upsert/delete`).
- In the browser it POSTs the query description to `/api/db`; the server checks table and column names against an allow-list, forces `user_id = <you>` on reads/writes for owned tables, blocks the `users` table, and runs it with bound parameters.
- Server routes use the same builder directly with full access.
- Result: the 800-line components barely changed.
- Audit while you're there: two routes trusted a `userId` sent by the browser (any user could read others' photos and check-ins).

## 8. Files

- Space storage limit: **5 MiB per file**. Phone photos are often bigger — we shrink in the browser (canvas → JPEG, ≤2400px) before upload.
- Files are served through authenticated routes instead of signed URLs.
- `env.STORAGE` method names: _to confirm with the probe (assumed R2-style put/get/delete)._

## 9. Previews and testing

- Push a branch → Spacefast builds a **private preview** at `<space>--br-<branch>.space.fast`; only the production branch goes live.
- Keep Vercel + Supabase serving users until the cutover.

## 10. Cutover (to do)

- [ ] Load schema + data via db console
- [ ] Sign in on preview, verify data
- [ ] Confirm storage, re-upload photos
- [ ] Remove probe route, merge to `main`
- [ ] Point the custom domain at Spacefast
- [ ] Final data sync just before switching DNS
- [ ] Retire Vercel and Supabase after a quiet week
