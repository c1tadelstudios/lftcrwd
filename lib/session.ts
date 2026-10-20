// Signed session cookie for lftcrwd's own Google sign-in. Works in middleware and route handlers
// (Web Crypto only). The cookie holds { uid, email, adm, exp }, HMAC-SHA256 signed with SESSION_SECRET.

export const SESSION_COOKIE = 'lftcrwd_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Session = { uid: string; email: string; adm: boolean; exp: number };

const enc = new TextEncoder();

function b64url( bytes: Uint8Array ): string {
  let s = '';
  bytes.forEach( b => { s += String.fromCharCode( b ); } );
  return btoa( s ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );
}

function fromB64url( s: string ): Uint8Array<ArrayBuffer> {
  const b = atob( s.replace( /-/g, '+' ).replace( /_/g, '/' ) + '==='.slice( ( s.length + 3 ) % 4 ) );
  const out = new Uint8Array( new ArrayBuffer( b.length ) );
  for ( let i = 0; i < b.length; i++ ) out[ i ] = b.charCodeAt( i );
  return out;
}

async function key( secret: string ) {
  return crypto.subtle.importKey( 'raw', enc.encode( secret ), { name: 'HMAC', hash: 'SHA-256' }, false, [ 'sign', 'verify' ] );
}

export async function signSession( s: Omit<Session, 'exp'>, secret: string ): Promise<string> {
  const payload: Session = { ...s, exp: Math.floor( Date.now() / 1000 ) + SESSION_MAX_AGE };
  const body = b64url( enc.encode( JSON.stringify( payload ) ) );
  const sig = new Uint8Array( await crypto.subtle.sign( 'HMAC', await key( secret ), enc.encode( body ) ) );
  return `${ body }.${ b64url( sig ) }`;
}

export async function verifySession( token: string | undefined, secret: string | undefined ): Promise<Session | null> {
  if ( ! token || ! secret ) return null;
  const [ body, sig ] = token.split( '.' );
  if ( ! body || ! sig ) return null;
  try {
    const ok = await crypto.subtle.verify( 'HMAC', await key( secret ), fromB64url( sig ), enc.encode( body ) );
    if ( ! ok ) return null;
    const s = JSON.parse( new TextDecoder().decode( fromB64url( body ) ) ) as Session;
    if ( typeof s.uid !== 'string' || typeof s.exp !== 'number' || s.exp < Date.now() / 1000 ) return null;
    return s;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
};
