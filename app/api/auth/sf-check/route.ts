import { NextRequest, NextResponse } from 'next/server';

// Temporary Spacefast probe for the migration spike: can the app reach the Space database
// (env.DB), and does the platform pass any signed-in-user identity to the app?
// Reports names and yes/no only — never env values, cookies or tokens. Delete after the spike.

export const dynamic = 'force-dynamic';

type D1Like = { prepare: ( sql: string ) => { all: () => Promise<{ results: unknown[] }> } };

export async function GET( request: NextRequest ) {
  const ctx = ( globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined> )[
    Symbol.for( '__cloudflare-context__' )
  ];
  const env = ctx?.env ?? {};
  const db = env.DB as D1Like | undefined;

  let dbCheck: unknown = 'no env.DB';
  if ( db && typeof db.prepare === 'function' ) {
    try {
      const { results } = await db.prepare( 'select 1 as ok, version() as version' ).all();
      dbCheck = results;
    } catch ( e ) {
      dbCheck = { error: e instanceof Error ? e.message : String( e ) };
    }
  }

  const headerNames = [ ...request.headers.keys() ].sort();
  const identityHeaders = Object.fromEntries(
    [ ...request.headers.entries() ].filter(
      ( [ k ] ) => /spacefast|^sf-|^x-sf|user|identity|email/i.test( k ) && ! /cookie|authorization/i.test( k )
    )
  );

  return NextResponse.json( {
    hasCloudflareContext: Boolean( ctx ),
    envBindingNames: Object.keys( env ).filter( k => ! /KEY|SECRET|PASSWORD|TOKEN/i.test( k ) ).sort(),
    hasDB: Boolean( db ),
    dbCheck,
    headerNames,
    identityHeaders,
    cookieNames: ( request.headers.get( 'cookie' ) ?? '' )
      .split( ';' ).map( c => c.split( '=' )[ 0 ].trim() ).filter( Boolean ),
  } );
}
