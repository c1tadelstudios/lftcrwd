// Server-only: runs QuerySpecs against the Space database (MariaDB, exposed by Spacefast as the
// D1-style `env.DB` binding). Identifiers are checked against lib/db/schema.ts; every value is a
// bound parameter.

import { QueryBuilder, type QuerySpec, type QueryResult, type Filter } from './query';
import { tableDef, assertColumn, DbError, type ColType } from './schema';

type D1Statement = {
  bind: ( ...args: unknown[] ) => D1Statement;
  all: () => Promise<{ results?: Record<string, unknown>[] }>;
  run: () => Promise<unknown>;
};
type D1Like = { prepare: ( sql: string ) => D1Statement };

/** Spacefast's runtime bindings (the OpenNext Cloudflare context), or {} outside it. */
export function platformEnv(): Record<string, unknown> {
  const ctx = ( globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined> )[
    Symbol.for( '__cloudflare-context__' )
  ];
  return ctx?.env ?? {};
}

/** A setting from the Space's environment variables. */
export function getEnv( name: string ): string | undefined {
  const v = platformEnv()[ name ];
  if ( typeof v === 'string' ) return v;
  return process.env[ name ];
}

function getDb(): D1Like {
  const db = platformEnv().DB as D1Like | undefined;
  if ( ! db || typeof db.prepare !== 'function' ) {
    throw new DbError( 'The Space database (env.DB) is not available in this environment.', 'db_unavailable', 500 );
  }
  return db;
}

export async function sql<T = Record<string, unknown>>( text: string, params: unknown[] = [] ): Promise<T[]> {
  const stmt = getDb().prepare( text );
  const { results } = await ( params.length ? stmt.bind( ...params ) : stmt ).all();
  return ( results ?? [] ) as T[];
}

// ── Value conversion ────────────────────────────────────────────────────────

const pad = ( n: number, w = 2 ) => String( n ).padStart( w, '0' );

function toDbDatetime( v: unknown ): string | null {
  if ( v === null || v === undefined || v === '' ) return null;
  const d = v instanceof Date ? v : new Date( String( v ) );
  if ( Number.isNaN( d.getTime() ) ) throw new DbError( `Invalid date-time: ${ String( v ) }` );
  return `${ d.getUTCFullYear() }-${ pad( d.getUTCMonth() + 1 ) }-${ pad( d.getUTCDate() ) } ` +
    `${ pad( d.getUTCHours() ) }:${ pad( d.getUTCMinutes() ) }:${ pad( d.getUTCSeconds() ) }.${ pad( d.getUTCMilliseconds(), 3 ) }`;
}

export function toDb( type: ColType, v: unknown ): unknown {
  if ( v === undefined || v === null ) return null;
  switch ( type ) {
    case 'bool': return v ? 1 : 0;
    case 'int': return v === '' ? null : Math.trunc( Number( v ) );
    case 'decimal': return v === '' ? null : Number( v );
    case 'json': return typeof v === 'string' ? v : JSON.stringify( v );
    case 'date': return String( v ).slice( 0, 10 );
    case 'datetime': return toDbDatetime( v );
    default: return String( v );
  }
}

function fromDb( type: ColType, v: unknown ): unknown {
  if ( v === null || v === undefined ) return null;
  switch ( type ) {
    case 'bool': return typeof v === 'boolean' ? v : Number( v ) !== 0;
    case 'int':
    case 'decimal': return Number( v );
    case 'json':
      if ( typeof v !== 'string' ) return v;
      try { return JSON.parse( v ); } catch { return v; }
    case 'date':
      if ( v instanceof Date ) return `${ v.getUTCFullYear() }-${ pad( v.getUTCMonth() + 1 ) }-${ pad( v.getUTCDate() ) }`;
      return String( v ).slice( 0, 10 );
    case 'datetime': {
      if ( v instanceof Date ) return v.toISOString();
      const s = String( v );
      return /^\d{4}-\d{2}-\d{2} /.test( s ) ? s.replace( ' ', 'T' ) + ( /Z|[+-]\d\d:?\d\d$/.test( s ) ? '' : 'Z' ) : s;
    }
    default: return v;
  }
}

function normalize( table: string, row: Record<string, unknown> ) {
  const cols = tableDef( table ).columns;
  const out: Record<string, unknown> = {};
  for ( const [ k, v ] of Object.entries( row ) ) out[ k ] = k in cols ? fromDb( cols[ k ], v ) : v;
  return out;
}

// ── SQL compilation ─────────────────────────────────────────────────────────

const q = ( id: string ) => `\`${ id }\``;

function selectList( table: string, columns = '*' ): string {
  if ( columns.trim() === '*' ) return '*';
  return columns.split( ',' ).map( c => c.trim() ).filter( Boolean )
    .map( c => { assertColumn( table, c ); return q( c ); } ).join( ', ' );
}

function where( table: string, filters: Filter[], params: unknown[] ): string {
  if ( ! filters.length ) return '';
  const parts = filters.map( ( { col, op, val } ) => {
    const type = assertColumn( table, col );
    const c = q( col );
    switch ( op ) {
      case 'eq':
        if ( val === null ) return `${ c } IS NULL`;
        params.push( toDb( type, val ) ); return `${ c } = ?`;
      case 'neq':
      case 'not_eq':
        if ( val === null ) return `${ c } IS NOT NULL`;
        params.push( toDb( type, val ) ); return `${ c } <> ?`;
      case 'gt': params.push( toDb( type, val ) ); return `${ c } > ?`;
      case 'gte': params.push( toDb( type, val ) ); return `${ c } >= ?`;
      case 'lt': params.push( toDb( type, val ) ); return `${ c } < ?`;
      case 'lte': params.push( toDb( type, val ) ); return `${ c } <= ?`;
      case 'in': {
        const list = Array.isArray( val ) ? val : [];
        if ( ! list.length ) return '1 = 0';
        list.forEach( v => params.push( toDb( type, v ) ) );
        return `${ c } IN (${ list.map( () => '?' ).join( ', ' ) })`;
      }
      case 'is':
        if ( val === null ) return `${ c } IS NULL`;
        return `${ c } IS ${ val ? 'TRUE' : 'FALSE' }`;
      case 'not_is':
        if ( val === null ) return `${ c } IS NOT NULL`;
        return `${ c } IS NOT ${ val ? 'TRUE' : 'FALSE' }`;
      default:
        throw new DbError( `Unsupported filter ${ String( op ) }` );
    }
  } );
  return ` WHERE ${ parts.join( ' AND ' ) }`;
}

function orderLimit( spec: QuerySpec ): string {
  const order = spec.order.map( o => { assertColumn( spec.table, o.col ); return `${ q( o.col ) } ${ o.ascending ? 'ASC' : 'DESC' }`; } );
  let s = order.length ? ` ORDER BY ${ order.join( ', ' ) }` : '';
  if ( spec.limit !== undefined ) s += ` LIMIT ${ Math.max( 0, Math.min( 5000, Math.trunc( spec.limit ) ) ) }`;
  return s;
}

function rowsForWrite( table: string, values: Record<string, unknown>[] ) {
  const def = tableDef( table );
  return values.map( v => {
    const row: Record<string, unknown> = { ...v };
    if ( 'id' in def.columns && ( row.id === undefined || row.id === null ) ) row.id = crypto.randomUUID();
    for ( const k of Object.keys( row ) ) assertColumn( table, k );
    return row;
  } );
}

async function runSelect( spec: QuerySpec, extra: Filter[] = [] ) {
  const params: unknown[] = [];
  const w = where( spec.table, [ ...spec.filters, ...extra ], params );
  if ( spec.count && spec.head ) {
    const r = await sql<{ n: number }>( `SELECT COUNT(*) AS n FROM ${ q( spec.table ) }${ w }`, params );
    return { rows: [] as Record<string, unknown>[], count: Number( r[ 0 ]?.n ?? 0 ) };
  }
  const rows = await sql( `SELECT ${ selectList( spec.table, spec.columns ) } FROM ${ q( spec.table ) }${ w }${ orderLimit( spec ) }`, params );
  return { rows: rows.map( r => normalize( spec.table, r ) ), count: undefined as number | undefined };
}

async function execute( spec: QuerySpec ): Promise<{ rows: Record<string, unknown>[]; count?: number }> {
  const def = tableDef( spec.table );
  const t = q( spec.table );

  if ( spec.action === 'select' ) return runSelect( spec );

  if ( spec.action === 'delete' ) {
    if ( ! spec.filters.length ) throw new DbError( 'Refusing to delete without a filter' );
    const params: unknown[] = [];
    await sql( `DELETE FROM ${ t }${ where( spec.table, spec.filters, params ) }`, params );
    return { rows: [] };
  }

  if ( spec.action === 'update' ) {
    if ( ! spec.filters.length ) throw new DbError( 'Refusing to update without a filter' );
    const v = spec.values?.[ 0 ] ?? {};
    const keys = Object.keys( v );
    if ( ! keys.length ) return { rows: [] };
    const params = keys.map( k => toDb( assertColumn( spec.table, k ), v[ k ] ) );
    await sql( `UPDATE ${ t } SET ${ keys.map( k => `${ q( k ) } = ?` ).join( ', ' ) }${ where( spec.table, spec.filters, params ) }`, params );
    if ( ! spec.returning ) return { rows: [] };
    // Re-read with the filters, swapping in any filtered column the update just changed.
    const filters = spec.filters.map( f => ( f.op === 'eq' && f.col in v ? { ...f, val: v[ f.col ] } : f ) );
    return runSelect( { ...spec, action: 'select', columns: '*', filters, order: [], limit: undefined } );
  }

  // insert / upsert
  const rows = rowsForWrite( spec.table, spec.values ?? [] );
  if ( ! rows.length ) return { rows: [] };
  const cols = [ ...new Set( rows.flatMap( r => Object.keys( r ) ) ) ];
  const params: unknown[] = [];
  const tuples = rows.map( r => `(${ cols.map( c => { params.push( toDb( def.columns[ c ], r[ c ] ) ); return '?'; } ).join( ', ' ) })` );
  let text = `INSERT INTO ${ t } (${ cols.map( q ).join( ', ' ) }) VALUES ${ tuples.join( ', ' ) }`;

  let keyCols: string[] = [ 'id' ];
  if ( spec.action === 'upsert' ) {
    keyCols = ( spec.onConflict ?? ( 'id' in def.columns ? 'id' : def.unique[ 0 ].join( ',' ) ) )
      .split( ',' ).map( s => s.trim() );
    const known = def.unique.some( u => u.length === keyCols.length && u.every( c => keyCols.includes( c ) ) );
    if ( ! known ) throw new DbError( `No unique index on ${ spec.table }(${ keyCols.join( ', ' ) })` );
    // Never overwrite the existing row's id with the freshly generated one.
    const updatable = cols.filter( c => ! keyCols.includes( c ) && c !== 'id' );
    text += updatable.length
      ? ` ON DUPLICATE KEY UPDATE ${ updatable.map( c => `${ q( c ) } = VALUES(${ q( c ) })` ).join( ', ' ) }`
      : ` ON DUPLICATE KEY UPDATE ${ q( keyCols[ 0 ] ) } = ${ q( keyCols[ 0 ] ) }`;
  }
  await sql( text, params );

  if ( ! spec.returning ) return { rows: [] };
  const out: Record<string, unknown>[] = [];
  for ( const r of rows ) {
    const filters: Filter[] = keyCols.map( c => ( { col: c, op: 'eq', val: r[ c ] } ) );
    const { rows: found } = await runSelect( { ...spec, action: 'select', columns: spec.columns ?? '*', filters, order: [], limit: 1 } );
    out.push( ...found );
  }
  return { rows: out };
}

/** Run a spec and shape the result like Supabase does ({ data, error, count }). */
export async function runSpec( spec: QuerySpec ): Promise<QueryResult> {
  try {
    const { rows, count } = await execute( spec );
    const isWrite = spec.action !== 'select';
    if ( spec.count && spec.head ) return { data: null, error: null, count: count ?? 0 };
    if ( isWrite && ! spec.returning ) return { data: null, error: null };
    if ( spec.single ) {
      if ( rows.length > 1 ) return { data: null, error: { message: 'Multiple rows returned', code: 'PGRST116' } };
      if ( ! rows.length ) {
        return spec.single === 'maybe'
          ? { data: null, error: null }
          : { data: null, error: { message: 'No rows returned', code: 'PGRST116' } };
      }
      return { data: rows[ 0 ], error: null };
    }
    return { data: rows, error: null };
  } catch ( e ) {
    const err = e instanceof DbError ? e : null;
    if ( err ) console.warn( '[db] rejected', spec.table, spec.action, err.code, err.message );
    else console.error( '[db]', spec.table, spec.action, e );
    return { data: null, error: { message: err?.message ?? 'Database error', code: err?.code ?? 'db_error' } };
  }
}

/** Server-side client with full access (replaces the Supabase service-role client). */
export const db = {
  from: <T = any>( table: string ) => new QueryBuilder<T>( table, runSpec ),
};

/**
 * Ownership rules for queries arriving from a browser via /api/db — the replacement for
 * Postgres row-level security. Returns the spec to run, or throws.
 */
export function applyOwnership( spec: QuerySpec, user: { id: string; isAdmin: boolean } ): QuerySpec {
  const def = tableDef( spec.table );
  if ( spec.table === 'users' ) throw new DbError( 'Not allowed', 'forbidden', 403 );

  if ( spec.table === 'trainer_settings' ) {
    if ( spec.action !== 'select' && ! user.isAdmin ) throw new DbError( 'Not allowed', 'forbidden', 403 );
    return spec;
  }

  if ( ! def.owned ) throw new DbError( 'Not allowed', 'forbidden', 403 );

  const out: QuerySpec = { ...spec, filters: [ ...spec.filters ] };
  if ( spec.action === 'insert' || spec.action === 'upsert' ) {
    out.values = ( spec.values ?? [] ).map( v => {
      const row: Record<string, unknown> = {
        ...v,
        user_id: user.isAdmin && typeof v.user_id === 'string' ? v.user_id : user.id,
      };
      // MariaDB's ON DUPLICATE KEY fires on ANY unique key, so a browser-chosen id on an upsert
      // could hit another user's row. Non-admin upserts always get a fresh id.
      if ( ! user.isAdmin && spec.action === 'upsert' ) delete row.id;
      return row;
    } );
    // A non-admin upsert could collide with someone else's row on `id`; scope it to their own.
    if ( ! user.isAdmin && spec.action === 'upsert' && ( spec.onConflict ?? 'id' ) === 'id' ) {
      throw new DbError( 'Upsert must target a per-user unique key', 'forbidden', 403 );
    }
  } else if ( ! user.isAdmin ) {
    out.filters.push( { col: 'user_id', op: 'eq', val: user.id } );
    if ( spec.action === 'update' && spec.values?.[ 0 ] && 'user_id' in spec.values[ 0 ] ) {
      const { user_id: _drop, ...rest } = spec.values[ 0 ];
      out.values = [ rest ];
    }
  }
  return out;
}
