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
