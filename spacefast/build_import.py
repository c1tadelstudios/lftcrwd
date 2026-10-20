"""Build a MariaDB import file for ONE user's lftcrwd data from the Supabase backup JSON.

Usage:
  python3 -I spacefast/build_import.py <backup dir> <email> <out.sql>

Reads <backup dir>/auth-users.json and <backup dir>/data/*.json (written by the Supabase API export)
and emits INSERTs matching spacefast/schema.sql. Only rows owned by <email> are included, plus the
shared trainer_settings row. Photos are handled separately (they need uploading to Space storage).
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

backup, email, out_path = sys.argv[1], sys.argv[2].lower(), sys.argv[3]

users = json.load(open(os.path.join(backup, 'auth-users.json')))
me = next(u for u in users if (u.get('email') or '').lower() == email)
uid = me['id']
meta = me.get('user_metadata') or {}


def load(table):
    return json.load(open(os.path.join(backup, 'data', f'{table}.json')))


def ts(v):
    """Postgres timestamptz ISO string -> UTC DATETIME(3) literal."""
    if v is None:
        return None
    # Postgres emits 1–6 fractional digits; older Pythons only parse exactly 3 or 6.
    v = re.sub(r'\.(\d{1,6})', lambda m: '.' + m.group(1).ljust(6, '0'), v.replace('Z', '+00:00'), count=1)
    d = datetime.fromisoformat(v)
    if d.tzinfo:
        d = d.astimezone(timezone.utc).replace(tzinfo=None)
    return d.strftime('%Y-%m-%d %H:%M:%S.') + f'{d.microsecond // 1000:03d}'


def lit(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        v = json.dumps(v, separators=(',', ':'))
    s = str(v).replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r').replace('\0', '\\0')
    return f"'{s}'"


TS_COLS = {'created_at', 'updated_at'}
lines = [
    '-- lftcrwd data import for ' + email + ' (generated ' + datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC') + ')',
    'SET NAMES utf8mb4;',
    "SET time_zone = '+00:00';",
    'START TRANSACTION;',
]
counts = {}


def insert(table, rows, cols):
    if not rows:
        counts[table] = 0
        return
    vals = []
    for r in rows:
        vals.append('(' + ', '.join(lit(ts(r.get(c)) if c in TS_COLS else r.get(c)) for c in cols) + ')')
    lines.append(f'INSERT INTO {table} ({", ".join(cols)}) VALUES')
    lines.append(',\n'.join(vals) + ';')
    counts[table] = len(rows)


insert('users', [{
    'id': uid, 'email': email, 'name': meta.get('full_name') or meta.get('name'),
    'is_admin': bool(meta.get('is_admin') or (me.get('app_metadata') or {}).get('is_admin')),
    'archived': False, 'created_at': me.get('created_at'),
}], ['id', 'email', 'name', 'is_admin', 'archived', 'created_at'])

insert('trainer_settings', load('trainer_settings'), ['id', 'business_name', 'tagline', 'updated_at'])


def mine(table):
    return [r for r in load(table) if r.get('user_id') == uid]


insert('client_profiles', mine('client_profiles'), ['user_id', 'category', 'created_at', 'updated_at'])
for t in ('client_meal_plans', 'client_workout_plans'):
    insert(t, mine(t), ['id', 'user_id', 'content', 'user_plan', 'active_source', 'created_at', 'updated_at'])
insert('daily_logs', mine('daily_logs'), [
    'id', 'user_id', 'date', 'protein_g', 'water_oz', 'creatine', 'cardio_done', 'cardio_minutes', 'cardio_type',
    'cardio_details', 'steps', 'weight_lbs', 'cheat_meal_used', 'meal_1_done', 'meal_2_done', 'meal_3_done',
    'meal_4_done', 'meal_5_done', 'custom_meals_done', 'created_at'])
sessions = mine('workout_sessions')
insert('workout_sessions', sessions, ['id', 'user_id', 'date', 'day_number', 'day_name', 'completed', 'notes', 'created_at'])
session_ids = {s['id'] for s in sessions}
ex = mine('exercise_logs')
orphans = 0
for r in ex:
    if r.get('session_id') and r['session_id'] not in session_ids:
        r['session_id'] = None
        orphans += 1
insert('exercise_logs', ex, ['id', 'user_id', 'session_id', 'exercise_name', 'set_number', 'weight_lbs', 'reps', 'rest_seconds', 'created_at'])
insert('meal_calorie_targets', mine('meal_calorie_targets'), ['id', 'user_id', 'meal_index', 'calories', 'updated_at'])
insert('messages', mine('messages'), ['id', 'user_id', 'body', 'sender', 'created_at'])
insert('weekly_checkins', mine('weekly_checkins'), [
    'id', 'user_id', 'week_start', 'weight_lbs', 'energy', 'sleep_hrs', 'adherence', 'stress', 'mood', 'recovery', 'notes', 'created_at'])

lines.append('COMMIT;')
old_umask = os.umask(0o077)
open(out_path, 'w').write('\n'.join(lines) + '\n')
os.umask(old_umask)
print(json.dumps({'user_id': uid, 'rows': counts, 'exercise_logs_detached_from_missing_session': orphans}))
