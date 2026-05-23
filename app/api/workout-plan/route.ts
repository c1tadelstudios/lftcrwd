import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET( request: NextRequest ) {
  const userId = request.headers.get( 'x-user-id' );
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { data, error } = await supabaseAdmin
    .from( 'client_workout_plans' )
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

  if ( plan === null || plan === '' ) {
    await supabaseAdmin.from( 'client_workout_plans' ).delete().eq( 'user_id', userId );
    return NextResponse.json( { ok: true } );
  }

  const { error } = await supabaseAdmin
    .from( 'client_workout_plans' )
    .upsert(
      { user_id: userId, user_plan: plan, active_source: 'user', updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
