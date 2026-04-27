import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Auth checked by middleware — only trainer can reach these routes.

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { data } = await supabaseAdmin
    .from('meal_calorie_targets')
    .select('meal_index, calories')
    .eq('user_id', userId);

  const result: Record<number, number> = {};
  for (const row of data || []) result[row.meal_index] = row.calories;

  return NextResponse.json({ calories: result });
}

export async function POST(request: NextRequest) {
  const { userId, mealIndex, calories } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('meal_calorie_targets')
    .upsert(
      { user_id: userId, meal_index: mealIndex, calories, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,meal_index' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
