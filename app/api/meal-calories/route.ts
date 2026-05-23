import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user?.id ?? null;
}

export async function POST( request: NextRequest ) {
  const userId = await getCurrentUserId();
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { mealIndex, calories } = await request.json();

  const { error } = await supabaseAdmin
    .from( 'meal_calorie_targets' )
    .upsert(
      { user_id: userId, meal_index: mealIndex, calories, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,meal_index' },
    );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
