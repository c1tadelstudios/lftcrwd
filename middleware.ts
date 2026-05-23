import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

export async function middleware( request: NextRequest ) {
  const { pathname } = request.nextUrl;

  // ── Public routes ─────────────────────────────────────────────────────────
  if (
    pathname.startsWith( '/login' ) ||
    pathname.startsWith( '/auth' ) ||
    pathname.startsWith( '/api/auth' ) ||
    pathname.startsWith( '/auth/confirm' )
  ) {
    return NextResponse.next();
  }

  // ── All protected routes ───────────────────────────────────────────────────
  const requestHeaders = new Headers( request.headers );
  requestHeaders.delete( 'x-user-id' ); // strip any client-supplied value

  const response = NextResponse.next( { request: { headers: requestHeaders } } );
  const supabase = createMiddlewareClient( request, response );
  const { data: { session } } = await supabase.auth.getSession();

  if ( ! session ) {
    if ( pathname.startsWith( '/api/trainer' ) ) {
      return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    }
    return NextResponse.redirect( new URL( '/login', request.url ) );
  }

  // Stamp user ID so API routes don't need to re-parse cookies.
  requestHeaders.set( 'x-user-id', session.user.id );

  // ── Archived user check ───────────────────────────────────────────────────
  if ( session.user?.email?.startsWith( '_archived' ) ) {
    return NextResponse.redirect( new URL( '/api/auth/signout', request.url ) );
  }

  // ── Trainer / admin routes ────────────────────────────────────────────────
  if (
    pathname.startsWith( '/trainer' ) ||
    pathname.startsWith( '/api/trainer' ) ||
    pathname.startsWith( '/api/feedback' )
  ) {
    const isAdmin =
      session.user?.user_metadata?.is_admin === true ||
      session.user?.app_metadata?.is_admin === true;

    if ( ! isAdmin ) {
      if ( pathname.startsWith( '/api/trainer' ) ) {
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
