import { NextRequest, NextResponse } from 'next/server';
import { applyOwnership, runSpec } from '@/lib/db/server';
import { DbError } from '@/lib/db/schema';
import { requestUser, unauthorized } from '@/lib/auth-server';
import type { QuerySpec } from '@/lib/db/query';

export const dynamic = 'force-dynamic';

// Runs a query described by the browser query builder (lib/db/browser.ts) for the signed-in user.
// applyOwnership() is the replacement for Postgres row-level security.
export async function POST( request: NextRequest ) {
  const user = requestUser( request );
  if ( ! user ) return unauthorized();

  let spec: QuerySpec;
  try {
    spec = await request.json();
    if ( ! spec || typeof spec.table !== 'string' || ! Array.isArray( spec.filters ) || ! Array.isArray( spec.order ) ) {
      throw new DbError( 'Malformed query' );
    }
    spec = applyOwnership( spec, user );
  } catch ( e ) {
    const err = e instanceof DbError ? e : new DbError( 'Malformed query' );
    return NextResponse.json( { data: null, error: { message: err.message, code: err.code } }, { status: err.status } );
  }

  return NextResponse.json( await runSpec( spec ) );
}
