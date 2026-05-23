import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET( request: NextRequest ) {
  const userId = request.headers.get( 'x-user-id' );
  if ( ! userId ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

  const { data, error } = await supabaseAdmin
    .from( 'meal_calorie_targets' )
    .select( 'meal_index, calories' )
    .eq( 'user_id', userId );

  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );

  const result: Record<number, number> = {};
  for ( const row of data ?? [] ) result[ row.meal_index ] = row.calories;
  return NextResponse.json( result );
}

export async function POST( request: NextRequest ) {
  const userId = request.headers.get( 'x-user-id' );
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
