// Server-only file storage on the Space's STORAGE binding (photos and avatars).
// The binding mirrors Spacefast's storage SDK: upload(blob) → { id, … }, get(id) → Response | null,
// delete(id). Objects are addressed by a 32-hex id the platform assigns, not by a path we choose,
// so the app records each id in the database (progress_photos.storage_key, users.avatar_url).

import { platformEnv } from '@/lib/db/server';

type Uploaded = { id?: string; key?: string; contentType?: string; size?: number };
type StoredBody = Response | { body: ReadableStream; httpMetadata?: { contentType?: string }; contentType?: string };
type Bucket = {
  upload: ( file: Blob, options?: { public?: boolean } ) => Promise<Uploaded>;
  get: ( id: string ) => Promise<StoredBody | null>;
  delete: ( id: string ) => Promise<unknown>;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // Spacefast storage limit per file
export const STORAGE_ID = /^[a-f0-9]{32}$/;

function bucket(): Bucket {
  const b = platformEnv().STORAGE as Bucket | undefined;
  if ( ! b || typeof b.upload !== 'function' || typeof b.get !== 'function' ) {
    throw new Error( 'Space storage (env.STORAGE) is not available in this environment.' );
  }
  return b;
}

/** Store a file privately; returns the platform-assigned object id. */
export async function uploadFile( data: ArrayBuffer, contentType: string ): Promise<string> {
  const res = await bucket().upload( new Blob( [ data ], { type: contentType } ) );
  const id = res?.id ?? res?.key;
  if ( ! id ) throw new Error( `Storage upload returned no id (got: ${ Object.keys( res ?? {} ).join( ', ' ) || 'nothing' })` );
  return id;
}

export async function deleteFile( id: string ) {
  if ( STORAGE_ID.test( id ) ) await bucket().delete( id );
}

/** Stream a stored file back to the browser, or 404. */
export async function fileResponse( id: string ): Promise<Response> {
  if ( ! STORAGE_ID.test( id ) ) return new Response( 'Not found', { status: 404 } );
  const obj = await bucket().get( id );
  if ( ! obj ) return new Response( 'Not found', { status: 404 } );

  const isResponse = typeof ( obj as Response ).headers?.get === 'function';
  const body = obj.body;
  const contentType = isResponse
    ? ( obj as Response ).headers.get( 'content-type' )
    : ( obj as { httpMetadata?: { contentType?: string }; contentType?: string } ).httpMetadata?.contentType
      ?? ( obj as { contentType?: string } ).contentType;

  return new Response( body, {
    headers: {
      'Content-Type': contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  } );
}
