import { NextRequest, NextResponse } from 'next/server';
import { requestUser, unauthorized } from '@/lib/auth-server';
import { fileResponse } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Avatars are visible to any signed-in user (the trainer sees clients' faces in the sidebar).
export async function GET( request: NextRequest, { params }: { params: Promise<{ userId: string }> } ) {
  if ( ! requestUser( request ) ) return unauthorized();
  const { userId } = await params;
  if ( ! /^[0-9a-f-]{36}$/i.test( userId ) ) return NextResponse.json( { error: 'Not found' }, { status: 404 } );
  return fileResponse( `avatars/${ userId }` );
}
