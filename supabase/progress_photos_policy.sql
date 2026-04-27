-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql
-- Allows authenticated users to upload photos to their own folder in progress-photos

create policy "Users upload own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
