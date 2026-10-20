// Browser-side stand-in for the Supabase client. Queries go to /api/db (which enforces
// ownership), the user comes from /api/auth/me, and avatar uploads go to /api/avatar.

import { QueryBuilder, type QuerySpec, type QueryResult } from './query';

export type AppUser = {
  id: string;
  email: string;
  created_at?: string;
  user_metadata: { name?: string | null; full_name?: string | null; avatar_url?: string | null; is_admin?: boolean };
  app_metadata: { is_admin?: boolean };
};

async function runRemote( spec: QuerySpec ): Promise<QueryResult> {
  try {
    const res = await fetch( '/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify( spec ),
      credentials: 'same-origin',
    } );
    const body = await res.json().catch( () => null ) as QueryResult | null;
    if ( ! body ) return { data: null, error: { message: `Request failed (${ res.status })` } };
    return body;
  } catch ( e ) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } };
  }
}

let userPromise: Promise<AppUser | null> | null = null;
let userFetchedAt = 0;

function loadUser( force = false ): Promise<AppUser | null> {
  if ( ! force && userPromise && Date.now() - userFetchedAt < 30_000 ) return userPromise;
  userFetchedAt = Date.now();
  userPromise = fetch( '/api/auth/me', { credentials: 'same-origin' } )
    .then( r => ( r.ok ? r.json() : { user: null } ) )
    .then( ( b: { user: AppUser | null } ) => b.user )
    .catch( () => null );
  return userPromise;
}

export const browserClient = {
  from: <T = any>( table: string ) => new QueryBuilder<T>( table, runRemote ),

  auth: {
    async getUser() {
      const user = await loadUser();
      return { data: { user }, error: user ? null : { message: 'Not signed in' } };
    },
    async getSession() {
      const user = await loadUser();
      return { data: { session: user ? { user } : null }, error: null };
    },
    async updateUser( attrs: { data?: { name?: string; avatar_url?: string } } ) {
      const res = await fetch( '/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( attrs ),
        credentials: 'same-origin',
      } );
      const user = await loadUser( true );
      return { data: { user }, error: res.ok ? null : { message: 'Could not update your profile' } };
    },
    async signOut() {
      userPromise = Promise.resolve( null );
      await fetch( '/api/auth/signout', { method: 'POST', credentials: 'same-origin', redirect: 'manual' } ).catch( () => null );
      return { error: null };
    },
  },

  storage: {
    // Only the avatars bucket was used from the browser; it now lives behind /api/avatar.
    from( _bucket: 'avatars' ) {
      return {
        async upload( _path: string, file: File, _opts?: unknown ) {
          const form = new FormData();
          form.append( 'file', file );
          const res = await fetch( '/api/avatar', { method: 'POST', body: form, credentials: 'same-origin' } );
          const body = await res.json().catch( () => ( {} ) ) as { url?: string; error?: string };
          lastAvatarUrl = body.url ?? null;
          return { data: body.url ? { path: body.url } : null, error: res.ok ? null : { message: body.error ?? 'Upload failed' } };
        },
        getPublicUrl( _path: string ) {
          return { data: { publicUrl: lastAvatarUrl ?? '' } };
        },
      };
    },
  },
};

let lastAvatarUrl: string | null = null;
