// Server-only file storage on the Space's STORAGE binding (photos and avatars).
// Assumes the R2-style interface (put/get/delete/list) that OpenNext workers expose; the
// /api/auth/sf-check probe reports the binding's actual methods so this can be confirmed.

import { platformEnv } from '@/lib/db/server';

type StoredObject = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  size?: number;
};
type Bucket = {
  put: ( key: string, value: ArrayBuffer | ReadableStream | string, opts?: { httpMetadata?: { contentType?: string } } ) => Promise<unknown>;
  get: ( key: string ) => Promise<StoredObject | null>;
  delete: ( key: string | string[] ) => Promise<void>;
};

function bucket(): Bucket {
  const b = platformEnv().STORAGE as Bucket | undefined;
  if ( ! b || typeof b.put !== 'function' || typeof b.get !== 'function' ) {
    throw new Error( 'Space storage (env.STORAGE) is not available in this environment.' );
  }
  return b;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // Spacefast storage limit per file

export async function putFile( key: string, data: ArrayBuffer, contentType: string ) {
  await bucket().put( key, data, { httpMetadata: { contentType } } );
}

export async function getFile( key: string ) {
  return bucket().get( key );
}

export async function deleteFile( key: string ) {
  await bucket().delete( key );
}

/** Stream a stored file back to the browser, or 404. */
export async function fileResponse( key: string ): Promise<Response> {
  const obj = await getFile( key );
  if ( ! obj ) return new Response( 'Not found', { status: 404 } );
  return new Response( obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  } );
}
