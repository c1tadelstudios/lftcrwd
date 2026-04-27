import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const { body, userId } = await request.json();

  if (!body || !userId) {
    return NextResponse.json({ error: 'body and userId required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('messages').insert({
    body,
    sender: 'trainer',
    user_id: userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
