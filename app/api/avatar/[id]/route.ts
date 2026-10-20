import { NextRequest, NextResponse } from 'next/server';
import { requestUser, unauthorized } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fileResponse, STORAGE_ID } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Avatars are visible to any signed-in user (the trainer sees clients' faces in the sidebar).
// Only ids that are someone's current avatar are served, so this can't be used to read photos.
export async function GET( request: NextRequest, { params }: { params: Promise<{ id: string }> } ) {
  if ( ! requestUser( request ) ) return unauthorized();
  const { id } = await params;
  if ( ! STORAGE_ID.test( id ) ) return NextResponse.json( { error: 'Not found' }, { status: 404 } );
  const { data: owner } = await supabaseAdmin.from( 'users' ).select( 'id' ).eq( 'avatar_url', `/api/avatar/${ id }` ).maybeSingle();
  if ( ! owner ) return NextResponse.json( { error: 'Not found' }, { status: 404 } );
  return fileResponse( id );
}
