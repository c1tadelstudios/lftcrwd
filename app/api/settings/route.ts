import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const DEFAULT = { business_name: 'lftcrwd Fitness', tagline: null as string | null };

export async function GET() {
  const { data } = await supabase
    .from('trainer_settings')
    .select('business_name, tagline')
    .limit(1)
    .maybeSingle();
  return NextResponse.json(data ?? DEFAULT);
}

export async function POST(request: Request) {
  // Verify caller is the trainer
  const cookieStore = await cookies();
  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await serverClient.auth.getUser();
  const trainerEmail = process.env.TRAINER_EMAIL?.toLowerCase();
  if (!user || user.email?.toLowerCase() !== trainerEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { business_name, tagline } = await request.json();
  if (!business_name?.trim()) {
    return NextResponse.json({ error: 'business_name is required' }, { status: 400 });
  }

  // Upsert — single-row settings table
  const { data: existing } = await supabaseAdmin
    .from('trainer_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin
      .from('trainer_settings')
      .update({ business_name: business_name.trim(), tagline: tagline?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('trainer_settings')
      .insert({ business_name: business_name.trim(), tagline: tagline?.trim() || null });
  }

  return NextResponse.json({ ok: true });
}
