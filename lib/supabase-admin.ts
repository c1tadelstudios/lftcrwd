// Server-only full-access data client (formerly the Supabase service-role client).
// Backed by the Spacefast Space database; see lib/db/server.ts. Only use in API routes.
import { db } from '@/lib/db/server';

export const supabaseAdmin = db;
