import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Auth checked by middleware — only admins (the trainer) can reach this route.

  // Clients = every non-admin, non-archived user.
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, email, name, is_admin, archived')
    .eq('archived', false)
    .eq('is_admin', false);
  if (usersError || !users) {
    return NextResponse.json({ error: usersError?.message ?? 'Could not load clients' }, { status: 500 });
  }

  const userIds = users.map((u: { id: string }) => u.id);
  if (userIds.length === 0) {
    return NextResponse.json({ users: [], sessions: [], dailyLogs: [], weights: [], exerciseLogs: [], messages: [] });
  }

  const [
    { data: sessions },
    { data: dailyLogs },
    { data: weights },
    { data: messages },
  ] = await Promise.all([
    supabaseAdmin.from('workout_sessions').select('*').in('user_id', userIds).eq('completed', true).order('date', { ascending: false }).limit(200),
    supabaseAdmin.from('daily_logs').select('*').in('user_id', userIds).order('date', { ascending: false }).limit(90),
    supabaseAdmin.from('daily_logs').select('date, weight_lbs, user_id').in('user_id', userIds).not('weight_lbs', 'is', null).order('date', { ascending: false }).limit(40),
    supabaseAdmin.from('messages').select('*').in('user_id', userIds).order('created_at', { ascending: true }),
  ]);

  const userList = users.map((u: { id: string; email: string; name: string | null }) => ({
    id: u.id,
    email: u.email ?? '',
    name: u.name || u.email?.split('@')[0] || u.id,
  }));

  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
  const { data: exerciseLogs } = sessionIds.length > 0
    ? await supabaseAdmin.from('exercise_logs').select('*').in('session_id', sessionIds)
    : { data: [] };

  return NextResponse.json({
    users: userList,
    sessions: sessions || [],
    dailyLogs: dailyLogs || [],
    weights: weights || [],
    exerciseLogs: exerciseLogs || [],
    messages: messages || [],
  });
}
