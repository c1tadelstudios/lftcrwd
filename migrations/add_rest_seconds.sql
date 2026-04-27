-- Add rest_seconds to exercise_logs
-- Stores the rest time (in seconds) taken after a set was completed
-- Run this in the Supabase SQL editor

alter table exercise_logs
  add column if not exists rest_seconds int;
