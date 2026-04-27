import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Auth checked by middleware — only trainer can reach this route.

export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // Fetch the user to get their current email.
  const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (fetchError || !user) {
    return NextResponse.json({ error: fetchError?.message ?? 'User not found' }, { status: 404 });
  }

  const originalEmail = user.email ?? '';

  // Count existing archived users to determine the next archive number.
  const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const archivedCount = allUsers.filter(u => u.email?.startsWith('_archived')).length;
  const archiveNumber = archivedCount + 1;

  // Rewrite email: _archivedN_localpart@domain.com
  const atIndex = originalEmail.indexOf('@');
  const localPart = atIndex !== -1 ? originalEmail.slice(0, atIndex) : originalEmail;
  const domain = atIndex !== -1 ? originalEmail.slice(atIndex) : '@archived.invalid';
  const archivedEmail = `_archived${archiveNumber}_${localPart}${domain}`;

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: archivedEmail,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
