-- Add cardio_type column to daily_logs
-- Run this in the Supabase SQL editor

alter table daily_logs
  add column if not exists cardio_type text;
