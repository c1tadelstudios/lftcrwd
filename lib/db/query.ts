// A small query builder with the same chained shape as the Supabase client
// (`.from(t).select(c).eq(k, v).order(...).maybeSingle()`), so existing app code keeps working.
// It only *describes* a query (a QuerySpec); an executor decides where it runs:
//   - browser: POST the spec to /api/db, which enforces ownership (lib/db/browser.ts)
//   - server:  run it straight against the Space database (lib/db/server.ts)

export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'not_is' | 'not_eq';
export type Filter = { col: string; op: FilterOp; val: unknown };

export type QuerySpec = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns?: string;            // select list, '*' by default
  returning?: boolean;         // .select() after a write
  values?: Record<string, unknown>[];
  onConflict?: string;
  filters: Filter[];
  order: { col: string; ascending: boolean }[];
  limit?: number;
  single?: 'one' | 'maybe';
  count?: boolean;             // select('id', { count: 'exact', head: true })
  head?: boolean;
};

export type QueryResult<T = any> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

export type Executor = ( spec: QuerySpec ) => Promise<QueryResult>;

export class QueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private spec: QuerySpec;

  constructor( table: string, private exec: Executor ) {
    this.spec = { table, action: 'select', filters: [], order: [] };
  }

  select( columns = '*', opts?: { count?: 'exact'; head?: boolean } ) {
    if ( this.spec.action === 'select' ) this.spec.columns = columns;
    else this.spec.returning = true;
    if ( opts?.count ) this.spec.count = true;
    if ( opts?.head ) this.spec.head = true;
    return this;
  }

  insert( values: Record<string, unknown> | Record<string, unknown>[] ) {
    this.spec.action = 'insert';
    this.spec.values = Array.isArray( values ) ? values : [ values ];
    return this;
  }

  upsert( values: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string } ) {
    this.spec.action = 'upsert';
    this.spec.values = Array.isArray( values ) ? values : [ values ];
    this.spec.onConflict = opts?.onConflict;
    return this;
  }

  update( values: Record<string, unknown> ) {
    this.spec.action = 'update';
    this.spec.values = [ values ];
    return this;
  }

  delete() {
    this.spec.action = 'delete';
    return this;
  }

  private f( col: string, op: FilterOp, val: unknown ) {
    this.spec.filters.push( { col, op, val } );
    return this;
  }

  eq( col: string, val: unknown ) { return this.f( col, 'eq', val ); }
  neq( col: string, val: unknown ) { return this.f( col, 'neq', val ); }
  gt( col: string, val: unknown ) { return this.f( col, 'gt', val ); }
  gte( col: string, val: unknown ) { return this.f( col, 'gte', val ); }
  lt( col: string, val: unknown ) { return this.f( col, 'lt', val ); }
  lte( col: string, val: unknown ) { return this.f( col, 'lte', val ); }
  in( col: string, vals: unknown[] ) { return this.f( col, 'in', vals ); }
  is( col: string, val: null | boolean ) { return this.f( col, 'is', val ); }

  not( col: string, op: 'is' | 'eq', val: unknown ) {
    return this.f( col, op === 'is' ? 'not_is' : 'not_eq', val );
  }

  order( col: string, opts?: { ascending?: boolean } ) {
    this.spec.order.push( { col, ascending: opts?.ascending ?? true } );
    return this;
  }

  limit( n: number ) {
    this.spec.limit = n;
    return this;
  }

  single() {
    this.spec.single = 'one';
    return this;
  }

  maybeSingle() {
    this.spec.single = 'maybe';
    return this;
  }

  then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ( ( value: QueryResult<T> ) => R1 | PromiseLike<R1> ) | null,
    onrejected?: ( ( reason: unknown ) => R2 | PromiseLike<R2> ) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec( this.spec ).then( onfulfilled as never, onrejected as never );
  }
}
