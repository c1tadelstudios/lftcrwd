// Browser-only: shrink a photo so it fits Spacefast storage's 5 MB-per-file limit.
// Small files pass through untouched; larger ones are redrawn as a JPEG at most 2400px wide/tall.

const TARGET_BYTES = 4.5 * 1024 * 1024;

export async function shrinkImage( file: File ): Promise<File> {
  if ( file.size <= TARGET_BYTES ) return file;

  const bitmap = await createImageBitmap( file ).catch( () => null );
  if ( ! bitmap ) return file; // e.g. HEIC on browsers that can't decode it; the server will reject if too big

  const scale = Math.min( 1, 2400 / Math.max( bitmap.width, bitmap.height ) );
  const canvas = document.createElement( 'canvas' );
  canvas.width = Math.round( bitmap.width * scale );
  canvas.height = Math.round( bitmap.height * scale );
  canvas.getContext( '2d' )?.drawImage( bitmap, 0, 0, canvas.width, canvas.height );
  bitmap.close();

  for ( const quality of [ 0.85, 0.75, 0.6 ] ) {
    const blob = await new Promise<Blob | null>( resolve => canvas.toBlob( resolve, 'image/jpeg', quality ) );
    if ( blob && blob.size <= TARGET_BYTES ) {
      return new File( [ blob ], file.name.replace( /\.[^.]+$/, '' ) + '.jpg', { type: 'image/jpeg' } );
    }
  }
  return file;
}
