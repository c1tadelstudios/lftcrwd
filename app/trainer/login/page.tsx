'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';

export default function TrainerLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/trainer-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = '/trainer';
    } else {
      setError('Wrong password. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col justify-center px-6 z-50 overflow-y-auto">

      <div className="space-y-8">
        {/* Wordmark + context */}
        <div>
          <div className="w-12 h-12 rounded-2xl bg-[#30d158]/15 flex items-center justify-center mb-6">
            <Lock size={22} className="text-[#30d158]" strokeWidth={2} />
          </div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/25 mb-3">
            lftcrwd
          </p>
          <h1 className="text-[34px] font-bold leading-[41px] text-white mb-3">
            Trainer access
          </h1>
          <p className="text-[17px] text-white/45">
            Enter your password to view the trainer dashboard.
          </p>
        </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-[#111111] rounded-2xl overflow-hidden">
          <div className="flex items-center px-4 h-[54px]">
            <span className="text-[17px] text-white/45 w-24 flex-shrink-0">Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              autoComplete="current-password"
              className="flex-1 bg-transparent text-[17px] text-white placeholder:text-white/20 outline-none text-right"
            />
          </div>
        </div>

        {error && (
          <p className="text-[#ff453a] text-[15px] px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full h-[50px] bg-[#30d158] disabled:opacity-40 rounded-[14px] font-semibold text-[17px] text-white transition-opacity active:opacity-75"
        >
          {loading ? 'Checking…' : 'Enter'}
        </button>
      </form>
      </div>
    </div>
  );
}
