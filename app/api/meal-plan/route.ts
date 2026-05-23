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

export async function GET() {
  const userId = await getCurrentUserId();
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { data } = await supabaseAdmin
    .from( 'client_meal_plans' )
    .select( 'user_plan' )
    .eq( 'user_id', userId )
    .maybeSingle();

  return NextResponse.json( { plan: data?.user_plan ?? null } );
}

export async function POST( request: NextRequest ) {
  const userId = await getCurrentUserId();
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { plan } = await request.json();

  const { error } = await supabaseAdmin
    .from( 'client_meal_plans' )
    .upsert(
      { user_id: userId, user_plan: plan ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
