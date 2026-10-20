import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Auth checked by middleware — only admins (the trainer) can reach this route.

// "Remove" a client: archive them so they can no longer sign in. Their history is kept.
export async function DELETE( request: NextRequest ) {
  const userId = request.nextUrl.searchParams.get( 'userId' );
  if ( ! userId ) return NextResponse.json( { error: 'userId required' }, { status: 400 } );

  const { data: user } = await supabaseAdmin.from( 'users' ).select( 'id, is_admin' ).eq( 'id', userId ).maybeSingle();
  if ( ! user ) return NextResponse.json( { error: 'User not found' }, { status: 404 } );
  if ( user.is_admin ) return NextResponse.json( { error: 'Admins cannot be archived here' }, { status: 400 } );

  const { error } = await supabaseAdmin.from( 'users' ).update( { archived: true } ).eq( 'id', userId );
  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
