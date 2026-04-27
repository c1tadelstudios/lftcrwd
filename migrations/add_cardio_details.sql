-- Add cardio_details JSONB column to daily_logs
-- Stores machine-specific cardio data: time_min, incline, speed, intensity, calories
-- Run this in the Supabase SQL editor

alter table daily_logs
  add column if not exists cardio_details jsonb;
