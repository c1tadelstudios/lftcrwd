import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/db/server';
import { publicOrigin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'lftcrwd_oauth_state';

// Step 1 of Google sign-in: send the visitor to Google with a one-time state value.
export async function GET( request: NextRequest ) {
  const clientId = getEnv( 'GOOGLE_CLIENT_ID' );
  const origin = publicOrigin( request );
  if ( ! clientId ) return NextResponse.redirect( new URL( '/login?error=config', origin ) );

  const state = crypto.randomUUID();
  const url = new URL( 'https://accounts.google.com/o/oauth2/v2/auth' );
  url.searchParams.set( 'client_id', clientId );
  url.searchParams.set( 'redirect_uri', `${ origin }/api/auth/google/callback` );
  url.searchParams.set( 'response_type', 'code' );
  url.searchParams.set( 'scope', 'openid email profile' );
  url.searchParams.set( 'state', state );
  url.searchParams.set( 'prompt', 'select_account' );

  const res = NextResponse.redirect( url );
  res.cookies.set( OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/google', maxAge: 600 } );
  return res;
}
