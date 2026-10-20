import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/db/server';

export type RequestUser = { id: string; email: string; isAdmin: boolean };

/** The signed-in user, as stamped onto the request by middleware.ts. */
export function requestUser( request: NextRequest | Request ): RequestUser | null {
  const id = request.headers.get( 'x-user-id' );
  if ( ! id ) return null;
  return {
    id,
    email: request.headers.get( 'x-user-email' ) ?? '',
    isAdmin: request.headers.get( 'x-is-admin' ) === '1',
  };
}

export const unauthorized = () => NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

/**
 * The public origin the visitor used (preview alias, lftcrwd.space.fast, or a custom domain).
 * Spacefast forwards the original host; only hosts we serve are accepted.
 */
export function publicOrigin( request: NextRequest ): string {
  const host = ( request.headers.get( 'x-forwarded-host' ) ?? request.headers.get( 'host' ) ?? '' ).split( ',' )[ 0 ].trim().toLowerCase();
  const allowed = /^(lftcrwd(--[a-z0-9-]+)?\.space\.fast|(app\.)?lftcrwd\.com|localhost(:\d+)?)$/.test( host );
  if ( allowed ) return `${ host.startsWith( 'localhost' ) ? 'http' : 'https' }://${ host }`;
  return ( getEnv( 'NEXT_PUBLIC_SITE_URL' ) ?? 'https://lftcrwd.space.fast' ).trim().replace( /\/$/, '' );
}
