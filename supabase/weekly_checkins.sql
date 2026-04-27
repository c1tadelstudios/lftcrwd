-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

create table if not exists weekly_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  week_start  date not null,
  weight_lbs  numeric(5,1),
  energy      int check (energy between 1 and 5),
  sleep_hrs   numeric(3,1),
  adherence   int check (adherence between 1 and 5),
  notes       text,
  created_at  timestamptz default now(),
  unique(user_id, week_start)
);

alter table weekly_checkins enable row level security;

create policy "Users manage own checkins" on weekly_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
