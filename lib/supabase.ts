import { createBrowserClient } from '@supabase/ssr';

let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// Convenience alias for components that import { supabase }
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    return (getSupabase() as Record<string | symbol, unknown>)[prop];
  },
});

// =============================================================================
// Coaching platform types
// =============================================================================

export type WorkoutSession = {
  id: string;
  user_id: string;
  date: string;
  day_number: number;
  day_name: string;
  completed: boolean;
};

export type ExerciseLog = {
  id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
};

export type DailyLog = {
  id: string;
  user_id: string;
  date: string;
  protein_g: number;
  water_oz: number;
  creatine: boolean;
  cardio_done: boolean;
  cardio_type: string | null;
  cardio_details: Record<string, number | string | null> | null;
  steps: number | null;
  weight_lbs: number | null;
  meal_1_done: boolean;
  meal_2_done: boolean;
  meal_3_done: boolean;
  meal_4_done: boolean;
  meal_5_done: boolean;
  custom_meals_done: Record<string, boolean> | null;
};

// =============================================================================
// Coaching platform helpers
// =============================================================================

/** Returns today's date as a YYYY-MM-DD string in local time. */
export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Gets or creates the daily log row for the current user and given date. */
export async function getOrCreateDailyLog(date: string): Promise<DailyLog | null> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data: existing } = await client
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .single();

  if (existing) return existing as DailyLog;

  const { data: created } = await client
    .from('daily_logs')
    .insert({ user_id: user.id, date })
    .select()
    .single();

  return (created as DailyLog) ?? null;
}

/** Gets the most recent N completed workout sessions for the current user. */
export async function getRecentSessions(limit = 10): Promise<WorkoutSession[]> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const { data } = await client
    .from('workout_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('completed', true)
    .order('date', { ascending: false })
    .limit(limit);

  return (data as WorkoutSession[]) ?? [];
}

/** Gets the last completed workout session for a given day number. */
export async function getLastSession(dayNumber: number): Promise<WorkoutSession | null> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from('workout_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('day_number', dayNumber)
    .eq('completed', true)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return (data as WorkoutSession) ?? null;
}

/** Gets weight history entries (non-null weight_lbs) for the current user. */
export async function getWeightHistory(): Promise<{ date: string; weight_lbs: number }[]> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const { data } = await client
    .from('daily_logs')
    .select('date, weight_lbs')
    .eq('user_id', user.id)
    .not('weight_lbs', 'is', null)
    .order('date', { ascending: true });

  return (data as { date: string; weight_lbs: number }[]) ?? [];
}

/** Gets the trainer-assigned workout plan for the current user. */
export async function getMyWorkoutPlan(): Promise<string | null> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from('client_workout_plans')
    .select('plan, user_plan, active_source')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;
  if (data.active_source === 'user') return data.user_plan ?? null;
  return data.plan ?? null;
}

/** Gets the trainer-assigned meal plan for the current user. */
export async function getMyMealPlan(): Promise<string | null> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from('client_meal_plans')
    .select('plan, user_plan, active_source')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;
  if (data.active_source === 'user') return data.user_plan ?? null;
  return data.plan ?? null;
}

/** Gets meal calorie targets for the current user. */
export async function getMealCalorieTargets(): Promise<Record<number, number>> {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return {};

  const { data } = await client
    .from('meal_calorie_targets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (data as Record<number, number>) ?? {};
}

// =============================================================================
// Legacy matching app types (kept for backward compat)
// =============================================================================

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type AvailabilityStatus = 'here_now' | 'looking' | 'scheduling' | 'offline';
export type MatchStatus = 'pending' | 'matched' | 'declined';

export type Profile = {
  id: string;
  name: string | null;
  bio: string | null;
  experience_level: ExperienceLevel | null;
  training_styles: string[];
  gender: string | null;
  gender_preference: string[];
  availability_status: AvailabilityStatus;
  gym_name: string | null;
  lat: number | null;
  lng: number | null;
  avatar_url: string | null;
  verified_lifter: boolean;
  phone_verified: boolean;
  created_at: string;
};

export type Match = {
  id: string;
  user_a: string;
  user_b: string;
  status: MatchStatus;
  created_at: string;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  sender: string;
  body: string;
  created_at: string;
};

export type Schedule = {
  id: string;
  user_a: string;
  user_b: string;
  recurrence: string | null;
  notes: string | null;
  created_at: string;
};

export const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  here_now: 'Here now',
  looking: 'Looking today',
  scheduling: 'Scheduling',
  offline: 'Offline',
};

export const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  here_now: '#30d158',
  looking: '#ff9500',
  scheduling: '#0a84ff',
  offline: 'rgba(255,255,255,0.2)',
};

export const TRAINING_STYLES = [
  'Hypertrophy', 'Powerlifting', 'Strength', 'Cardio',
  'CrossFit', 'Calisthenics', 'Olympic Lifting', 'HIIT',
];

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
