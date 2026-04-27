import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendInviteEmail } from '@/lib/email';

// Auth checked by middleware — only trainer can reach this route.

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Create the user (pre-confirmed so they can log in via magic link)
  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    email_confirm: true,
  });

  // Ignore duplicate-user errors — re-inviting is fine, just send a fresh link.
  // Don't match on exact message text; Supabase wording varies across versions.
  if (createError) {
    const msg = createError.message.toLowerCase();
    const isDupe = msg.includes('already') || msg.includes('registered') || msg.includes('exists');
    if (!isDupe) return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // 2. Generate a magic link so the client can log in without a password
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.lftcrwd.com').replace(/\\n$/, '').trim();
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: cleanEmail,
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Could not generate invite link' }, { status: 500 });
  }

  // 3. Fetch the trainer's business name for the email
  const { data: settings } = await supabaseAdmin
    .from('trainer_settings')
    .select('business_name')
    .limit(1)
    .maybeSingle();

  const businessName = settings?.business_name ?? undefined;

  // 4. Send the branded onboarding email via Resend
  try {
    await sendInviteEmail({
      to: cleanEmail,
      magicLink: linkData.properties.action_link,
      businessName,
    });
  } catch (err) {
    console.error('Invite email failed:', err);
    // Don't block the invite — user exists and link is valid.
    // Warn the trainer so they can share the link manually if needed.
    return NextResponse.json({
      ok: true,
      emailWarning: 'Client was added but the invite email failed to send.',
    });
  }

  return NextResponse.json({ ok: true });
}
