'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthConfirmPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleAuth() {
      const hash = new URLSearchParams(window.location.hash.slice(1));

      // Error from Supabase (e.g. expired magic link)
      const hashError = hash.get('error');
      if (hashError) {
        const desc = hash.get('error_description')?.replace(/\+/g, ' ') ?? hashError;
        const isExpired = hash.get('error_code') === 'otp_expired' || desc.toLowerCase().includes('expired');
        setError(isExpired ? 'expired' : desc);
        return;
      }

      // Implicit flow: tokens arrive in the URL hash (#access_token=...&refresh_token=...)
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) { setError(error.message); return; }
        window.location.href = '/';
        return;
      }

      // PKCE flow fallback: token arrives as ?code= query param
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setError(error.message); return; }
        window.location.href = '/';
        return;
      }

      setError(`No auth tokens found. URL: ${window.location.href}`);
    }

    handleAuth();
  }, []);

  if (error) {
    const isExpired = error === 'expired';
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-white font-semibold text-[17px]">
            {isExpired ? 'Link expired' : 'Sign-in error'}
          </p>
          <p className="text-white/50 text-[15px]">
            {isExpired
              ? 'This invite link has expired. Ask your coach to send a new one, or sign in below.'
              : error}
          </p>
          <a href="/login" className="text-[#30d158] text-[15px] block mt-4">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Signing you in...</p>
    </div>
  );
}
