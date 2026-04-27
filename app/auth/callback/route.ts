import { NextRequest, NextResponse } from 'next/server';

// Forward all params to the client-side confirm page which handles auth in the browser
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const confirmUrl = new URL('/auth/confirm', request.url);
  url.searchParams.forEach((value, key) => {
    confirmUrl.searchParams.set(key, value);
  });
  return NextResponse.redirect(confirmUrl);
}
