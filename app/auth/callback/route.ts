import { NextResponse } from 'next/server';

// Old Supabase magic-link landing page. Sign-in is now Google; send any old link to the login screen.
export function GET( request: Request ) {
  return NextResponse.redirect( new URL( '/login', request.url ) );
}
