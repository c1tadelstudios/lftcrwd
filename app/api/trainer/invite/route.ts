import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendInviteEmail } from '@/lib/email';
import { publicOrigin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// Auth checked by middleware — only admins (the trainer) can reach this route.

// Inviting = adding the client's email to the users table. They then sign in with the Google
// account for that email. Re-inviting an archived client restores them.
export async function POST( request: NextRequest ) {
  const { email } = await request.json();
  if ( ! email?.trim() ) {
    return NextResponse.json( { error: 'Email required' }, { status: 400 } );
  }
  const cleanEmail = String( email ).trim().toLowerCase();
  if ( ! /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test( cleanEmail ) ) {
    return NextResponse.json( { error: 'Enter a valid email address' }, { status: 400 } );
  }

  const { data: existing } = await supabaseAdmin.from( 'users' ).select( 'id, archived' ).eq( 'email', cleanEmail ).maybeSingle();
  if ( existing ) {
    if ( existing.archived ) await supabaseAdmin.from( 'users' ).update( { archived: false } ).eq( 'id', existing.id );
  } else {
    const { error } = await supabaseAdmin.from( 'users' ).insert( { email: cleanEmail } );
    if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
  }

  const { data: settings } = await supabaseAdmin
    .from( 'trainer_settings' )
    .select( 'business_name' )
    .limit( 1 )
    .maybeSingle();

  try {
    await sendInviteEmail( {
      to: cleanEmail,
      magicLink: `${ publicOrigin( request ) }/login`,
      businessName: settings?.business_name ?? undefined,
    } );
  } catch {
    return NextResponse.json( {
      ok: true,
      emailWarning: 'Client was added but the invite email failed to send.',
    } );
  }

  return NextResponse.json( { ok: true } );
}
