import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

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
  const { userId, week_start, weight_lbs, energy, sleep_hrs, stress, mood, recovery, notes } = await request.json();
  if (!userId || !week_start) return NextResponse.json({ error: 'userId and week_start required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('weekly_checkins')
    .upsert(
      { user_id: userId, week_start, weight_lbs: weight_lbs ?? null, energy, sleep_hrs: sleep_hrs ?? null, stress: stress ?? null, mood: mood ?? null, recovery: recovery ?? null, notes: notes || null },
      { onConflict: 'user_id,week_start' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
