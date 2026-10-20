'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';

const ERRORS: Record<string, string> = {
  not_invited: "That Google account isn't on the invite list. Ask your coach to add the email you used.",
  account_mismatch: 'This email is linked to a different Google account. Sign in with the original one.',
  cancelled: 'Sign-in was cancelled.',
  state: 'Sign-in expired. Please try again.',
  google: "Google didn't confirm the sign-in. Please try again.",
  config: 'Google sign-in is not set up yet.',
};

export default function LoginPage() {
  const [ error, setError ] = useState( '' );
  const [ loading, setLoading ] = useState( false );

  useEffect( () => {
    const code = new URLSearchParams( window.location.search ).get( 'error' );
    if ( code ) setError( ERRORS[ code ] ?? 'Sign-in failed. Please try again.' );
  }, [] );

  return (
    <div className="fixed inset-0 bg-black flex flex-col justify-center px-6 z-50">
      <div className="space-y-8">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-[#0a84ff]/15 flex items-center justify-center mb-6">
            <Dumbbell size={22} className="text-[#0a84ff]" strokeWidth={2} />
          </div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/25 mb-3">lftcrwd</p>
          <h1 className="text-[34px] font-bold leading-[41px] text-white mb-3">Welcome back.</h1>
          <p className="text-[17px] text-white/45">Sign in with your Google account.</p>
        </div>

        <div className="space-y-3">
          {error && <p className="text-[#ff453a] text-[15px] px-1">{error}</p>}
          <a
            href="/api/auth/google"
            onClick={() => setLoading( true )}
            aria-disabled={loading}
            className="w-full h-[50px] bg-white rounded-[14px] font-semibold text-[17px] text-black flex items-center justify-center gap-3 transition-opacity active:opacity-75 aria-disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z"/>
              <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/>
            </svg>
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </a>
        </div>
      </div>
    </div>
  );
}
