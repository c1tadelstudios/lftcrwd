import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requestUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const DEFAULT = { business_name: 'lftcrwd Fitness', tagline: null as string | null };

export async function GET() {
  const { data } = await supabaseAdmin
    .from( 'trainer_settings' )
    .select( 'business_name, tagline' )
    .limit( 1 )
    .maybeSingle();
  return NextResponse.json( data ?? DEFAULT );
}

export async function POST( request: NextRequest ) {
  // Only the trainer (an admin) can change the business settings.
  const user = requestUser( request );
  if ( ! user?.isAdmin ) {
    return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
  }

  const { business_name, tagline } = await request.json();
  if ( ! business_name?.trim() ) {
    return NextResponse.json( { error: 'business_name is required' }, { status: 400 } );
  }

  // Single-row settings table
  const { data: existing } = await supabaseAdmin
    .from( 'trainer_settings' )
    .select( 'id' )
    .limit( 1 )
    .maybeSingle();

  const values = { business_name: business_name.trim(), tagline: tagline?.trim() || null, updated_at: new Date().toISOString() };
  const { error } = existing?.id
    ? await supabaseAdmin.from( 'trainer_settings' ).update( values ).eq( 'id', existing.id )
    : await supabaseAdmin.from( 'trainer_settings' ).insert( values );
  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );

  return NextResponse.json( { ok: true } );
}
