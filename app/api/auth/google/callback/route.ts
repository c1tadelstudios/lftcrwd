import { NextRequest, NextResponse } from 'next/server';
import { db, getEnv } from '@/lib/db/server';
import { publicOrigin } from '@/lib/auth-server';
import { SESSION_COOKIE, signSession, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'lftcrwd_oauth_state';

type GoogleClaims = {
  aud?: string; sub?: string; email?: string; email_verified?: boolean | string;
  name?: string; picture?: string; exp?: number;
};

function decodeJwtPayload( jwt: string ): GoogleClaims {
  const part = jwt.split( '.' )[ 1 ] ?? '';
  const json = atob( part.replace( /-/g, '+' ).replace( /_/g, '/' ) + '==='.slice( ( part.length + 3 ) % 4 ) );
  return JSON.parse( new TextDecoder().decode( Uint8Array.from( json, c => c.charCodeAt( 0 ) ) ) );
}

// Step 2 of Google sign-in: Google sends the visitor back here with a code.
export async function GET( request: NextRequest ) {
  const origin = publicOrigin( request );
  const fail = ( reason: string ) => {
    const res = NextResponse.redirect( new URL( `/login?error=${ reason }`, origin ) );
    res.cookies.delete( { name: OAUTH_STATE_COOKIE, path: '/api/auth/google' } );
    return res;
  };

  const code = request.nextUrl.searchParams.get( 'code' );
  const state = request.nextUrl.searchParams.get( 'state' );
  const expected = request.cookies.get( OAUTH_STATE_COOKIE )?.value;
  if ( request.nextUrl.searchParams.get( 'error' ) ) return fail( 'cancelled' );
  if ( ! code || ! state || ! expected || state !== expected ) return fail( 'state' );

  const clientId = getEnv( 'GOOGLE_CLIENT_ID' );
  const clientSecret = getEnv( 'GOOGLE_CLIENT_SECRET' );
  const secret = getEnv( 'SESSION_SECRET' );
  if ( ! clientId || ! clientSecret || ! secret ) return fail( 'config' );

  // Exchange the code directly with Google over TLS. Per Google's guidance, an ID token received
  // this way (not via the browser) can be trusted without separately checking its signature.
  const tokenRes = await fetch( 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams( {
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: `${ origin }/api/auth/google/callback`, grant_type: 'authorization_code',
    } ),
  } );
  if ( ! tokenRes.ok ) {
    console.error( '[auth] token exchange failed', tokenRes.status, await tokenRes.text() );
    return fail( 'google' );
  }
  const { id_token: idToken } = await tokenRes.json() as { id_token?: string };
  if ( ! idToken ) return fail( 'google' );

  const claims = decodeJwtPayload( idToken );
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  if ( claims.aud !== clientId || ! claims.email || ! claims.sub || ! verified ) return fail( 'google' );
  const email = claims.email.toLowerCase();

  // Only people already in the users table (you, or clients you invited) can sign in.
  const { data: user } = await db.from( 'users' ).select( '*' ).eq( 'email', email ).maybeSingle();
  if ( ! user || user.archived ) return fail( 'not_invited' );
  if ( user.google_sub && user.google_sub !== claims.sub ) return fail( 'account_mismatch' );

  await db.from( 'users' ).update( {
    google_sub: claims.sub,
    last_login_at: new Date().toISOString(),
    ...( user.name ? {} : { name: claims.name ?? null } ),
    ...( user.avatar_url ? {} : { avatar_url: claims.picture ?? null } ),
  } ).eq( 'id', user.id );

  const token = await signSession( { uid: user.id, email, adm: Boolean( user.is_admin ) }, secret );
  const res = NextResponse.redirect( new URL( '/', origin ) );
  res.cookies.set( SESSION_COOKIE, token, sessionCookieOptions );
  res.cookies.delete( { name: OAUTH_STATE_COOKIE, path: '/api/auth/google' } );
  return res;
}
