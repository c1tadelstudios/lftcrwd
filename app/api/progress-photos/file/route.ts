import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requestUser, unauthorized } from '@/lib/auth-server';
import { fileResponse } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Serves one progress photo to its owner, or to the trainer.
export async function GET( request: NextRequest ) {
  const user = requestUser( request );
  if ( ! user ) return unauthorized();
  const id = request.nextUrl.searchParams.get( 'id' );
  if ( ! id ) return NextResponse.json( { error: 'id required' }, { status: 400 } );

  const { data: photo } = await supabaseAdmin.from( 'progress_photos' ).select( 'user_id, storage_key' ).eq( 'id', id ).maybeSingle();
  if ( ! photo || ( photo.user_id !== user.id && ! user.isAdmin ) ) {
    return NextResponse.json( { error: 'Not found' }, { status: 404 } );
  }
  return fileResponse( photo.storage_key );
}
