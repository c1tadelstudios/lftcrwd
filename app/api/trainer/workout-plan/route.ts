import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Auth checked by middleware — only trainer can reach these routes.

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { data } = await supabaseAdmin
    .from('client_workout_plans')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({ content: data?.content ?? null });
}

export async function POST(request: NextRequest) {
  const { userId, content } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  if (content === null) {
    await supabaseAdmin.from('client_workout_plans').delete().eq('user_id', userId);
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from('client_workout_plans')
    .upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
