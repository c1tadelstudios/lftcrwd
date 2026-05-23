import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET( request: NextRequest ) {
  const userId = request.headers.get( 'x-user-id' );
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
  const userId = request.headers.get( 'x-user-id' );
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { plan } = await request.json();

  const { error } = await supabaseAdmin
    .from( 'client_meal_plans' )
    .upsert(
      { user_id: userId, content: plan ?? '', user_plan: plan ?? null, active_source: plan ? 'user' : 'trainer', updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
