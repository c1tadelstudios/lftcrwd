import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/auth-server';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

function signOut( request: NextRequest ) {
  const res = NextResponse.redirect( new URL( '/login', publicOrigin( request ) ), 303 );
  res.cookies.delete( { name: SESSION_COOKIE, path: '/' } );
  return res;
}

export const GET = signOut;
export const POST = signOut;
