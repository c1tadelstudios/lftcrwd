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
  const { data: { session } } = await client.auth.getSession();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { data, error } = await supabaseAdmin
    .from( 'client_meal_plans' )
    .select( 'plan, user_plan, active_source' )
    .eq( 'user_id', userId )
    .maybeSingle();

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  if ( ! data ) return NextResponse.json( { plan: null } );
  const active = data.active_source === 'user'
    ? data.user_plan
    : ( data.plan ?? data.user_plan );
  return NextResponse.json( { plan: active ?? null } );
}

export async function POST( request: NextRequest ) {
  const userId = await getCurrentUserId();
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { plan } = await request.json();

  const { error } = await supabaseAdmin
    .from( 'client_meal_plans' )
    .upsert(
      { user_id: userId, user_plan: plan ?? null, active_source: plan ? 'user' : 'trainer', updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
