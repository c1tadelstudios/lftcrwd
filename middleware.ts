import { NextRequest, NextResponse } from 'next/server';

// Decode JWT payload without verification — claims only, no network.
function parseJwtPayload( token: string ): Record<string, unknown> | null {
  try {
    const base64Url = token.split( '.' )[ 1 ];
    const base64    = base64Url.replace( /-/g, '+' ).replace( /_/g, '/' );
    return JSON.parse( Buffer.from( base64, 'base64' ).toString( 'utf-8' ) );
  } catch {
    return null;
  }
}

// Read the Supabase session JWT from cookies without using the Supabase client.
// Supabase SSR may split large cookies into sb-*-auth-token.0, .1, etc.
function getJwtPayload( request: NextRequest ): Record<string, unknown> | null {
  const cookies = request.cookies.getAll();

  const chunks = cookies
    .filter( c => /^sb-.+-auth-token(\.\d+)?$/.test( c.name ) )
    .sort( ( a, b ) => a.name.localeCompare( b.name ) );

  if ( ! chunks.length ) return null;

  const raw = chunks.map( c => c.value ).join( '' );

  try {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse( raw );
    } catch {
      parsed = JSON.parse( decodeURIComponent( raw ) );
    }

    const accessToken = parsed?.access_token;
    if ( typeof accessToken !== 'string' ) return null;

    const payload = parseJwtPayload( accessToken );
    if ( ! payload ) return null;

    // Treat expired tokens as unauthenticated — pages handle refresh.
    if ( typeof payload.exp === 'number' && payload.exp < Math.floor( Date.now() / 1000 ) ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function middleware( request: NextRequest ) {
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

  // ── All protected routes — decode JWT from cookie, zero network calls ──────
  const payload = getJwtPayload( request );

  if ( ! payload ) {
    if ( pathname.startsWith( '/api/trainer' ) ) {
      return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    }
    return NextResponse.redirect( new URL( '/login', request.url ) );
  }

  // ── Archived user check ───────────────────────────────────────────────────
  const email = payload.email as string | undefined;
  if ( email?.startsWith( '_archived' ) ) {
    return NextResponse.redirect( new URL( '/api/auth/signout', request.url ) );
  }

  // ── Trainer / admin routes ────────────────────────────────────────────────
  if (
    pathname.startsWith( '/trainer' ) ||
    pathname.startsWith( '/api/trainer' ) ||
    pathname.startsWith( '/api/feedback' )
  ) {
    const userMeta = payload.user_metadata as Record<string, unknown> | undefined;
    const appMeta  = payload.app_metadata  as Record<string, unknown> | undefined;
    const isAdmin  = userMeta?.is_admin === true || appMeta?.is_admin === true;

    if ( ! isAdmin ) {
      if ( pathname.startsWith( '/api/trainer' ) ) {
        return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
      }
      return NextResponse.redirect( new URL( '/login', request.url ) );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)$).*)'],
};
