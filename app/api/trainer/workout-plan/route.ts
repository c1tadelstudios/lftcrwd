import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Auth checked by middleware — only trainer can reach these routes.

export async function GET( request: NextRequest ) {
  const userId = request.nextUrl.searchParams.get( 'userId' );
  if ( ! userId ) return NextResponse.json( { error: 'userId required' }, { status: 400 } );

  const { data } = await supabaseAdmin
    .from( 'client_workout_plans' )
    .select( 'plan, content, user_plan, active_source' )
    .eq( 'user_id', userId )
    .maybeSingle();

  return NextResponse.json( {
    trainerPlan:  data?.plan ?? data?.content ?? null,
    userPlan:     data?.user_plan              ?? null,
    activeSource: data?.active_source          ?? 'trainer',
  } );
}

export async function POST( request: NextRequest ) {
  const body = await request.json();
  const { userId } = body;
  if ( ! userId ) return NextResponse.json( { error: 'userId required' }, { status: 400 } );

  // Toggle active source
  if ( 'activeSource' in body ) {
    const { error } = await supabaseAdmin
      .from( 'client_workout_plans' )
      .upsert(
        { user_id: userId, active_source: body.activeSource, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
    return NextResponse.json( { ok: true } );
  }

  // Save trainer plan
  const trainerPlan = body.trainerPlan ?? null;

  if ( trainerPlan === null ) {
    await supabaseAdmin
      .from( 'client_workout_plans' )
      .upsert(
        { user_id: userId, plan: null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    return NextResponse.json( { ok: true } );
  }

  const { error } = await supabaseAdmin
    .from( 'client_workout_plans' )
    .upsert(
      { user_id: userId, plan: trainerPlan, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
