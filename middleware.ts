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
  const response = NextResponse.next();
  const supabase = createMiddlewareClient( request, response );
  const { data: { session } } = await supabase.auth.getSession();

  if ( ! session ) {
    if ( pathname.startsWith( '/api/trainer' ) ) {
      return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    }
    return NextResponse.redirect( new URL( '/login', request.url ) );
  }

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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)$).*)'],
};
