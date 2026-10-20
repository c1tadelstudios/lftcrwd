import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requestUser, unauthorized } from '@/lib/auth-server';

/** Your own check-ins, or any client's if you're the trainer. */
function targetUser(request: NextRequest, requested: string | null | undefined) {
  const user = requestUser(request);
  if (!user) return null;
  if (requested && requested !== user.id && !user.isAdmin) return null;
  return requested || user.id;
}

export async function GET(request: NextRequest) {
  const userId = targetUser(request, request.nextUrl.searchParams.get('userId'));
  if (!userId) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('weekly_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(12);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checkins: data || [] });
}

export async function POST(request: NextRequest) {
  const { userId: requested, week_start, weight_lbs, energy, sleep_hrs, stress, mood, recovery, notes } = await request.json();
  const userId = targetUser(request, requested);
  if (!userId) return unauthorized();
  if (!week_start) return NextResponse.json({ error: 'week_start required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('weekly_checkins')
    .upsert(
      { user_id: userId, week_start, weight_lbs: weight_lbs ?? null, energy, sleep_hrs: sleep_hrs ?? null, stress: stress ?? null, mood: mood ?? null, recovery: recovery ?? null, notes: notes || null },
      { onConflict: 'user_id,week_start' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
