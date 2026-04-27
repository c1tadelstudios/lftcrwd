-- lftcrwd database schema
-- Run this in your Supabase SQL editor

-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  bio text,
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  training_styles text[] default '{}',
  gender text,
  gender_preference text[] default '{"male","female","any"}',
  availability_status text default 'offline' check (availability_status in ('here_now', 'looking', 'scheduling', 'offline')),
  gym_name text,
  lat numeric,
  lng numeric,
  avatar_url text,
  verified_lifter boolean default false,
  phone_verified boolean default false,
  created_at timestamptz default now()
);

-- Matches
create table matches (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references profiles(id) on delete cascade not null,
  user_b uuid references profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'matched', 'declined')),
  created_at timestamptz default now(),
  unique (user_a, user_b)
);

-- Messages (only between matched users)
create table messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

-- Schedules (recurring training partners)
create table schedules (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references profiles(id) on delete cascade not null,
  user_b uuid references profiles(id) on delete cascade not null,
  recurrence text,
  notes text,
  created_at timestamptz default now()
);

-- Indexes
create index on profiles (availability_status);
create index on profiles (lat, lng);
create index on matches (user_a);
create index on matches (user_b);
create index on messages (match_id, created_at);

-- RLS
alter table profiles enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table schedules enable row level security;

-- Profiles: public read, own write
create policy "Public profiles are viewable" on profiles for select using (true);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Matches: users can see their own matches
create policy "Users see own matches" on matches for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Users can create matches" on matches for insert with check (auth.uid() = user_a);
create policy "Users can update own matches" on matches for update using (auth.uid() = user_a or auth.uid() = user_b);

-- Messages: only matched users
create policy "Matched users see messages" on messages for select using (
  exists (
    select 1 from matches
    where matches.id = messages.match_id
    and (matches.user_a = auth.uid() or matches.user_b = auth.uid())
    and matches.status = 'matched'
  )
);
create policy "Matched users send messages" on messages for insert with check (
  auth.uid() = sender_id and
  exists (
    select 1 from matches
    where matches.id = messages.match_id
    and (matches.user_a = auth.uid() or matches.user_b = auth.uid())
    and matches.status = 'matched'
  )
);

-- Schedules: users see own schedules
create policy "Users see own schedules" on schedules for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Users create schedules" on schedules for insert with check (auth.uid() = user_a);
create policy "Users update schedules" on schedules for update using (auth.uid() = user_a or auth.uid() = user_b);
