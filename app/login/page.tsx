'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dumbbell } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) { setError(error.message); setLoading(false); return; }
    setStep('code');
    setLoading(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      setError(error.message.includes('expired') ? 'Code expired — request a new one.' : error.message);
      setLoading(false);
      return;
    }
    window.location.href = '/';
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col justify-center px-6 z-50">
      <div className="space-y-8">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-[#0a84ff]/15 flex items-center justify-center mb-6">
            <Dumbbell size={22} className="text-[#0a84ff]" strokeWidth={2} />
          </div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/25 mb-3">lftcrwd</p>
          {step === 'email' ? (
            <>
              <h1 className="text-[34px] font-bold leading-[41px] text-white mb-3">Welcome back.</h1>
              <p className="text-[17px] text-white/45">Sign in to your account.</p>
            </>
          ) : (
            <>
              <h1 className="text-[34px] font-bold leading-[41px] text-white mb-3">Check your email</h1>
              <p className="text-[17px] text-white/45">We sent a code to <span className="text-white">{email}</span>.</p>
            </>
          )}
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3">
            <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden">
              <div className="flex items-center px-4 h-[54px]">
                <span className="text-[17px] text-white/45 w-16 flex-shrink-0">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className="flex-1 bg-transparent text-[17px] text-white placeholder:text-white/20 outline-none text-right"
                />
              </div>
            </div>
            {error && <p className="text-[#ff453a] text-[15px] px-1">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-[50px] bg-[#0a84ff] disabled:opacity-40 rounded-[14px] font-semibold text-[17px] text-white transition-opacity active:opacity-75"
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={token}
                onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className="w-full bg-transparent text-[34px] font-bold text-center tracking-[0.35em] text-white placeholder:text-white/15 outline-none h-[72px]"
              />
            </div>
            {error && <p className="text-[#ff453a] text-[15px] px-1">{error}</p>}
            <button
              type="submit"
              disabled={loading || token.length !== 6}
              className="w-full h-[50px] bg-[#0a84ff] disabled:opacity-40 rounded-[14px] font-semibold text-[17px] text-white transition-opacity active:opacity-75"
            >
              {loading ? 'Verifying…' : 'Sign in'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setToken(''); setError(''); }}
              className="w-full h-11 text-[15px] text-white/25 hover:text-white/50 transition-colors">
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
