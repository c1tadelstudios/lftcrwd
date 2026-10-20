import { NextRequest, NextResponse } from 'next/server';
import { requestUser, unauthorized } from '@/lib/auth-server';
import { MAX_UPLOAD_BYTES, putFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const key = ( userId: string ) => `avatars/${ userId }`;

// Upload your own profile photo. The page then saves the returned URL as your avatar_url.
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
  await putFile( key( user.id ), await file.arrayBuffer(), file.type );
  return NextResponse.json( { url: `/api/avatar/${ user.id }` } );
}
