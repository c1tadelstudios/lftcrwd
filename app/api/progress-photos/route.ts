import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requestUser, unauthorized } from '@/lib/auth-server';
import { MAX_UPLOAD_BYTES, putFile, deleteFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type PhotoRow = { id: string; user_id: string; storage_key: string; taken_on: string | null };

/** Whose photos this request may touch: your own, or any client's if you're the trainer. */
function targetUser( request: NextRequest, requested: string | null ) {
  const user = requestUser( request );
  if ( ! user ) return null;
  if ( requested && requested !== user.id && ! user.isAdmin ) return null;
  return requested || user.id;
}

const fileName = ( key: string ) => key.split( '/' ).pop() ?? key;

export async function GET( request: NextRequest ) {
  const userId = targetUser( request, request.nextUrl.searchParams.get( 'userId' ) );
  if ( ! userId ) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from( 'progress_photos' )
    .select( 'id, user_id, storage_key, taken_on' )
    .eq( 'user_id', userId )
    .order( 'storage_key', { ascending: false } );
  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );

  const photos = ( ( data ?? [] ) as PhotoRow[] ).map( p => ( {
    name: fileName( p.storage_key ),
    url: `/api/progress-photos/file?id=${ encodeURIComponent( p.id ) }`,
    // filename format: YYYY-MM-DD-timestamp.ext
    date: p.taken_on ?? fileName( p.storage_key ).slice( 0, 10 ),
  } ) );
  return NextResponse.json( { photos } );
}

export async function POST( request: NextRequest ) {
  const formData = await request.formData();
  const file = formData.get( 'file' ) as File | null;
  const userId = targetUser( request, formData.get( 'userId' ) as string | null );
  if ( ! userId ) return unauthorized();
  if ( ! file ) return NextResponse.json( { error: 'file required' }, { status: 400 } );

  if ( ! file.type.startsWith( 'image/' ) ) {
    return NextResponse.json( { error: 'Only image files are supported.' }, { status: 400 } );
  }
  if ( file.size > MAX_UPLOAD_BYTES ) {
    return NextResponse.json( { error: 'Photo must be under 5 MB.' }, { status: 400 } );
  }

  const ext = ( file.name.split( '.' ).pop()?.toLowerCase() || 'jpg' ).replace( /[^a-z0-9]/g, '' ) || 'jpg';
  const dateStr = new Date().toISOString().split( 'T' )[ 0 ];
  const filename = `${ dateStr }-${ Date.now() }.${ ext }`;
  const key = `progress-photos/${ userId }/${ filename }`;

  try {
    await putFile( key, await file.arrayBuffer(), file.type );
  } catch ( e ) {
    return NextResponse.json( { error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 } );
  }

  const { error } = await supabaseAdmin.from( 'progress_photos' ).insert( {
    user_id: userId, storage_key: key, taken_on: dateStr, mime_type: file.type, bytes: file.size,
  } );
  if ( error ) {
    await deleteFile( key ).catch( () => null );
    return NextResponse.json( { error: error.message }, { status: 500 } );
  }
  return NextResponse.json( { ok: true, path: key, filename, date: dateStr } );
}

export async function DELETE( request: NextRequest ) {
  const { userId: requested, filename } = await request.json();
  const userId = targetUser( request, requested ?? null );
  if ( ! userId ) return unauthorized();
  if ( ! filename ) return NextResponse.json( { error: 'filename required' }, { status: 400 } );

  const key = `progress-photos/${ userId }/${ String( filename ).replace( /[/\\]/g, '' ) }`;
  const { data: row } = await supabaseAdmin.from( 'progress_photos' ).select( 'id' ).eq( 'storage_key', key ).eq( 'user_id', userId ).maybeSingle();
  if ( ! row ) return NextResponse.json( { error: 'Photo not found' }, { status: 404 } );

  await deleteFile( key ).catch( () => null );
  const { error } = await supabaseAdmin.from( 'progress_photos' ).delete().eq( 'id', row.id );
  if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  return NextResponse.json( { ok: true } );
}
