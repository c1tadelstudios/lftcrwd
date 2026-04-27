-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql
-- Adds stress, mood, recovery columns; drops adherence from new check-ins
-- (adherence column is kept for historical data, just no longer collected)

alter table weekly_checkins
  add column if not exists stress   int check (stress   between 1 and 5),
  add column if not exists mood     int check (mood     between 1 and 5),
  add column if not exists recovery int check (recovery between 1 and 5);
