import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function sessionSecret(): string | undefined {
  const ctx = ( globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined> )[
    Symbol.for( '__cloudflare-context__' )
  ];
  const v = ctx?.env?.SESSION_SECRET;
  return typeof v === 'string' ? v : process.env.SESSION_SECRET;
}

export async function middleware( request: NextRequest ) {
  const { pathname } = request.nextUrl;

  // Identity headers are only ever set here; never trust a client-supplied value.
  const requestHeaders = new Headers( request.headers );
  requestHeaders.delete( 'x-user-id' );
  requestHeaders.delete( 'x-user-email' );
  requestHeaders.delete( 'x-is-admin' );

  // ── Public routes ─────────────────────────────────────────────────────────
  // Icons and the web app manifest must load without signing in (browser tab, Add to Home Screen).
  const isAppAsset = pathname === '/manifest.webmanifest' || /^\/(icon|apple-icon|favicon|apple-touch-icon|web-app-manifest)[^/]*$/.test( pathname );
  if ( isAppAsset || pathname.startsWith( '/login' ) || pathname.startsWith( '/api/auth' ) ) {
    return NextResponse.next( { request: { headers: requestHeaders } } );
  }

  const session = await verifySession( request.cookies.get( SESSION_COOKIE )?.value, sessionSecret() );

  if ( ! session ) {
    if ( pathname.startsWith( '/api/' ) ) {
      return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    }
    return NextResponse.redirect( new URL( '/login', request.url ) );
  }

  // Stamp identity so API routes don't need to re-parse cookies.
  requestHeaders.set( 'x-user-id', session.uid );
  requestHeaders.set( 'x-user-email', session.email );
  requestHeaders.set( 'x-is-admin', session.adm ? '1' : '0' );

  // ── Trainer / admin routes ────────────────────────────────────────────────
  if (
    pathname.startsWith( '/trainer' ) ||
    pathname.startsWith( '/api/trainer' ) ||
    pathname.startsWith( '/api/feedback' )
  ) {
    if ( ! session.adm ) {
      if ( pathname.startsWith( '/api/' ) ) {
        return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
      }
      return NextResponse.redirect( new URL( '/login', request.url ) );
    }
  }

  return NextResponse.next( { request: { headers: requestHeaders } } );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)$).*)'],
};
