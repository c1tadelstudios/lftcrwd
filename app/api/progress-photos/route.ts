import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'progress-photos';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { data: files, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(userId, { sortBy: { column: 'name', order: 'desc' } });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!files || files.length === 0) return NextResponse.json({ photos: [] });

  const paths = files.map(f => `${userId}/${f.name}`);
  const { data: urls, error: urlError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, 60 * 60); // 1 hour

  if (urlError) return NextResponse.json({ error: urlError.message }, { status: 500 });

  const photos = (urls || []).map((u, i) => ({
    name: files[i].name,
    url: u.signedUrl,
    // filename format: YYYY-MM-DD-timestamp.ext
    date: files[i].name.slice(0, 10),
  }));

  return NextResponse.json({ photos });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const userId = formData.get('userId') as string | null;

  if (!file || !userId) {
    return NextResponse.json({ error: 'file and userId required' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo must be under 5 MB.' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${dateStr}-${Date.now()}.${ext}`;
  const path = `${userId}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, path, filename, date: dateStr });
}

export async function DELETE(request: NextRequest) {
  const { userId, filename } = await request.json();
  if (!userId || !filename) return NextResponse.json({ error: 'userId and filename required' }, { status: 400 });

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove([`${userId}/${filename}`]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
