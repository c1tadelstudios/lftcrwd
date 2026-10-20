import { NextRequest, NextResponse } from 'next/server';
import { requestUser, unauthorized } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { MAX_UPLOAD_BYTES, uploadFile, deleteFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Upload your own profile photo and make it your avatar. Returns the new avatar URL.
export async function POST( request: NextRequest ) {
  const user = requestUser( request );
  if ( ! user ) return unauthorized();
  const file = ( await request.formData() ).get( 'file' ) as File | null;
  if ( ! file || ! file.type.startsWith( 'image/' ) ) {
    return NextResponse.json( { error: 'Choose an image file.' }, { status: 400 } );
  }
  if ( file.size > MAX_UPLOAD_BYTES ) {
    return NextResponse.json( { error: 'Photo must be under 5 MB.' }, { status: 400 } );
  }

  const { data: me } = await supabaseAdmin.from( 'users' ).select( 'avatar_url' ).eq( 'id', user.id ).maybeSingle();
  let id: string;
  try {
    id = await uploadFile( await file.arrayBuffer(), file.type );
  } catch ( e ) {
    console.error( '[avatar] upload failed', e );
    return NextResponse.json( { error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 } );
  }
  const url = `/api/avatar/${ id }`;
  await supabaseAdmin.from( 'users' ).update( { avatar_url: url } ).eq( 'id', user.id );

  // Remove the previous uploaded avatar (Google profile pictures are external URLs and are skipped).
  const prev = me?.avatar_url?.match( /^\/api\/avatar\/([a-f0-9]{32})$/ )?.[ 1 ];
  if ( prev ) await deleteFile( prev ).catch( () => null );

  return NextResponse.json( { url } );
}
