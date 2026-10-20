import { NextRequest, NextResponse } from 'next/server';
import { db, getEnv } from '@/lib/db/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// /api/auth/* skips the middleware gate, so this route checks the session cookie itself.
async function session( request: NextRequest ) {
  return verifySession( request.cookies.get( SESSION_COOKIE )?.value, getEnv( 'SESSION_SECRET' ) );
}

/** The signed-in user, shaped like a Supabase user so existing components keep working. */
export async function GET( request: NextRequest ) {
  const s = await session( request );
  if ( ! s ) return NextResponse.json( { user: null } );
  const { data: u } = await db.from( 'users' ).select( 'id, email, name, avatar_url, is_admin, archived, created_at' ).eq( 'id', s.uid ).maybeSingle();
  if ( ! u || u.archived ) return NextResponse.json( { user: null } );
  return NextResponse.json( {
    user: {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      user_metadata: { name: u.name, avatar_url: u.avatar_url, is_admin: Boolean( u.is_admin ) },
      app_metadata: { is_admin: Boolean( u.is_admin ) },
    },
  } );
}

/** Update the signed-in user's own display name (replaces supabase.auth.updateUser). */
export async function PATCH( request: NextRequest ) {
  const s = await session( request );
  if ( ! s ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
  const body = await request.json().catch( () => ( {} ) ) as { data?: { name?: unknown; avatar_url?: unknown } };
  const patch: Record<string, string | null> = {};
  if ( typeof body.data?.name === 'string' ) patch.name = body.data.name.trim().slice( 0, 200 ) || null;
  // avatar_url is set by /api/avatar when a photo is uploaded; it isn't client-editable.
  if ( ! Object.keys( patch ).length ) return NextResponse.json( { ok: true } );
  const { error } = await db.from( 'users' ).update( patch ).eq( 'id', s.uid );
  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
