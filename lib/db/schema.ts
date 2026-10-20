// Column types for every table in spacefast/schema.sql. The query layer only accepts table and
// column names listed here, so nothing a browser sends can reach SQL as an identifier.

export type ColType = 'uuid' | 'text' | 'int' | 'bool' | 'decimal' | 'json' | 'date' | 'datetime';

type TableDef = {
  columns: Record<string, ColType>;
  /** Column sets with a UNIQUE index — the only valid `onConflict` targets for upsert. */
  unique: string[][];
  /** True when rows belong to a user via `user_id` (ownership is enforced on these). */
  owned: boolean;
};

const ts = { created_at: 'datetime' } as const;

export const TABLES: Record<string, TableDef> = {
  users: {
    columns: {
      id: 'uuid', email: 'text', name: 'text', avatar_url: 'text', google_sub: 'text',
      is_admin: 'bool', archived: 'bool', last_login_at: 'datetime', ...ts,
    },
    unique: [ [ 'id' ], [ 'email' ], [ 'google_sub' ] ],
    owned: false,
  },
  trainer_settings: {
    columns: { id: 'uuid', business_name: 'text', tagline: 'text', updated_at: 'datetime' },
    unique: [ [ 'id' ] ],
    owned: false,
  },
  client_profiles: {
    columns: { user_id: 'uuid', category: 'text', updated_at: 'datetime', ...ts },
    unique: [ [ 'user_id' ] ],
    owned: true,
  },
  client_meal_plans: {
    columns: {
      id: 'uuid', user_id: 'uuid', content: 'text', user_plan: 'text', active_source: 'text',
      updated_at: 'datetime', ...ts,
    },
    unique: [ [ 'id' ], [ 'user_id' ] ],
    owned: true,
  },
  client_workout_plans: {
    columns: {
      id: 'uuid', user_id: 'uuid', content: 'text', user_plan: 'text', active_source: 'text',
      updated_at: 'datetime', ...ts,
    },
    unique: [ [ 'id' ], [ 'user_id' ] ],
    owned: true,
  },
  daily_logs: {
    columns: {
      id: 'uuid', user_id: 'uuid', date: 'date', protein_g: 'int', water_oz: 'int', creatine: 'bool',
      cardio_done: 'bool', cardio_minutes: 'int', cardio_type: 'text', cardio_details: 'json', cardio_listening: 'text',
      steps: 'int', weight_lbs: 'decimal', cheat_meal_used: 'bool',
      meal_1_done: 'bool', meal_2_done: 'bool', meal_3_done: 'bool', meal_4_done: 'bool', meal_5_done: 'bool',
      custom_meals_done: 'json', ...ts,
    },
    unique: [ [ 'id' ], [ 'date', 'user_id' ] ],
    owned: true,
  },
  workout_sessions: {
    columns: {
      id: 'uuid', user_id: 'uuid', date: 'date', day_number: 'int', day_name: 'text',
      completed: 'bool', notes: 'text', ...ts,
    },
    unique: [ [ 'id' ] ],
    owned: true,
  },
  exercise_logs: {
    columns: {
      id: 'uuid', user_id: 'uuid', session_id: 'uuid', exercise_name: 'text', set_number: 'int',
      weight_lbs: 'decimal', reps: 'int', rest_seconds: 'int', ...ts,
    },
    unique: [ [ 'id' ] ],
    owned: true,
  },
  meal_calorie_targets: {
    columns: { id: 'uuid', user_id: 'uuid', meal_index: 'int', calories: 'int', updated_at: 'datetime' },
    unique: [ [ 'id' ], [ 'user_id', 'meal_index' ] ],
    owned: true,
  },
  messages: {
    columns: { id: 'uuid', user_id: 'uuid', body: 'text', sender: 'text', ...ts },
    unique: [ [ 'id' ] ],
    owned: true,
  },
  weekly_checkins: {
    columns: {
      id: 'uuid', user_id: 'uuid', week_start: 'date', weight_lbs: 'decimal', energy: 'int',
      sleep_hrs: 'decimal', adherence: 'int', stress: 'int', mood: 'int', recovery: 'int', notes: 'text', ...ts,
    },
    unique: [ [ 'id' ], [ 'user_id', 'week_start' ] ],
    owned: true,
  },
  progress_photos: {
    columns: {
      id: 'uuid', user_id: 'uuid', storage_key: 'text', taken_on: 'date', mime_type: 'text', bytes: 'int', ...ts,
    },
    unique: [ [ 'id' ], [ 'storage_key' ] ],
    owned: true,
  },
};

export function tableDef( table: string ): TableDef {
  const def = Object.prototype.hasOwnProperty.call( TABLES, table ) ? TABLES[ table ] : undefined;
  if ( ! def ) throw new DbError( `Unknown table: ${ table }`, 'unknown_table' );
  return def;
}

export function assertColumn( table: string, col: string ): ColType {
  const t = tableDef( table ).columns;
  if ( ! Object.prototype.hasOwnProperty.call( t, col ) ) {
    throw new DbError( `Unknown column ${ table }.${ col }`, 'unknown_column' );
  }
  return t[ col ];
}

export class DbError extends Error {
  constructor( message: string, public code = 'db_error', public status = 400 ) {
    super( message );
  }
}
