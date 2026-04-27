'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Check, LogOut, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const POLL_INTERVAL = 30_000;

type AppUser = { id: string; email: string; name: string };
type DailyLog = { date: string; user_id: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TrainerSidebar() {
  const pathname = usePathname();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteError, setInviteError] = useState('');

  // Report Issue modal
  const [showReport, setShowReport] = useState(false);
  const [reportDesc, setReportDesc] = useState('');
  const [reportArea, setReportArea] = useState('General');
  const [reportSeverity, setReportSeverity] = useState('medium');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportDesc.trim()) return;
    setReportStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: reportDesc.trim(), area: reportArea, severity: reportSeverity }),
      });
      if (res.ok) {
        setReportStatus('sent');
        setTimeout(() => {
          setShowReport(false);
          setReportDesc('');
          setReportArea('General');
          setReportSeverity('medium');
          setReportStatus('idle');
        }, 2500);
      } else {
        setReportStatus('error');
      }
    } catch {
      setReportStatus('error');
    }
  }

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/trainer/data');
    if (!res.ok) return;
    const data = await res.json();
    setUsers(data.users || []);
    setDailyLogs(data.dailyLogs || []);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteStatus('sending');
    setInviteError('');
    try {
      const res = await fetch('/api/trainer/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (res.ok) {
        setInviteStatus('sent');
        setInviteEmail('');
        setTimeout(() => { setInviteStatus('idle'); setShowInvite(false); }, 2000);
      } else {
        const data = await res.json();
        setInviteError(data.error || 'Something went wrong.');
        setInviteStatus('error');
      }
    } catch {
      setInviteError('Request failed.');
      setInviteStatus('error');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const today = todayStr();
  const activeToday = new Set(dailyLogs.filter(l => l.date === today).map(l => l.user_id));
  const activeClientId = pathname.startsWith('/trainer/') ? pathname.split('/trainer/')[1] : null;

  return (
    <aside className="hidden md:flex flex-col w-72 flex-shrink-0 border-r border-white/8 bg-[#0a0a0a] h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">lftcrwd</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#30d158] rounded-full" />
            {lastUpdated && (
              <span className="text-[10px] text-white/25">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <p className="text-[22px] font-bold text-white">Clients</p>
      </div>

      {/* Client list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {users.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-[13px] text-white/30">No clients yet.</p>
          </div>
        ) : (
          users.map(user => {
            const isActive = activeClientId === user.id;
            const loggedToday = activeToday.has(user.id);
            return (
              <Link
                key={user.id}
                href={`/trainer/${user.id}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[#30d158]/15 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold ${
                    isActive ? 'bg-[#30d158]/20 text-[#30d158]' : 'bg-white/10 text-white/50'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {loggedToday && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#30d158] rounded-full border-2 border-[#0a0a0a]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] font-medium truncate ${isActive ? 'text-white' : ''}`}>
                    {user.name}
                  </p>
                  <p className="text-[11px] text-white/30 truncate">{user.email}</p>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#30d158] flex-shrink-0" />
                )}
              </Link>
            );
          })
        )}
      </div>

      {/* Invite */}
      <div className="px-3 pb-2 border-t border-white/8 pt-3">
        {showInvite ? (
          <div className="bg-[#111111] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Invite client</p>
              <button onClick={() => { setShowInvite(false); setInviteStatus('idle'); setInviteEmail(''); }}
                className="text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
            {inviteStatus === 'sent' ? (
              <div className="flex items-center gap-2 py-1">
                <Check size={14} className="text-[#30d158]" />
                <span className="text-[13px] text-[#30d158]">Invite sent!</span>
              </div>
            ) : (
              <form onSubmit={sendInvite} className="space-y-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteStatus('idle'); setInviteError(''); }}
                  placeholder="client@email.com"
                  autoFocus
                  className="w-full bg-white/8 rounded-lg px-3 h-9 text-[14px] outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/25"
                  disabled={inviteStatus === 'sending'}
                />
                {inviteStatus === 'error' && (
                  <p className="text-[11px] text-[#ff453a]">{inviteError}</p>
                )}
                <button
                  type="submit"
                  disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
                  className="w-full h-9 bg-[#30d158] disabled:opacity-40 rounded-[10px] text-[14px] font-semibold text-black active:opacity-75 transition-opacity"
                >
                  {inviteStatus === 'sending' ? 'Sending…' : 'Send invite'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <Plus size={15} />
            <span className="text-[14px]">Invite client</span>
          </button>
        )}
      </div>

      {/* Report Issue */}
      <div className="px-3 pb-2">
        {showReport ? (
          <div className="bg-[#111111] rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Report Issue</p>
              <button onClick={() => { setShowReport(false); setReportStatus('idle'); }}
                className="text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
            {reportStatus === 'sent' ? (
              <div className="flex items-center gap-2 py-1">
                <Check size={14} className="text-[#30d158]" />
                <span className="text-[13px] text-[#30d158]">Sent to Shane!</span>
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-2">
                <select
                  value={reportArea}
                  onChange={e => setReportArea(e.target.value)}
                  className="w-full bg-white/8 rounded-lg px-3 h-9 text-[13px] outline-none focus:ring-1 focus:ring-white/20 text-white"
                >
                  {['General', 'Today Dashboard', 'Workout', 'Meals', 'Progress', 'Trainer View', 'Client Detail', 'Invite / Email', 'Other'].map(a => (
                    <option key={a} value={a} className="bg-[#111]">{a}</option>
                  ))}
                </select>
                <select
                  value={reportSeverity}
                  onChange={e => setReportSeverity(e.target.value)}
                  className="w-full bg-white/8 rounded-lg px-3 h-9 text-[13px] outline-none focus:ring-1 focus:ring-white/20 text-white"
                >
                  <option value="low" className="bg-[#111]">Low — minor annoyance</option>
                  <option value="medium" className="bg-[#111]">Medium — something&apos;s off</option>
                  <option value="high" className="bg-[#111]">High — hard to use</option>
                  <option value="blocking" className="bg-[#111]">Blocking — can&apos;t proceed</option>
                </select>
                <textarea
                  value={reportDesc}
                  onChange={e => { setReportDesc(e.target.value); setReportStatus('idle'); }}
                  placeholder="What happened? What did you expect?"
                  rows={3}
                  autoFocus
                  className="w-full bg-white/8 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-white/20 placeholder:text-white/25 resize-none"
                />
                {reportStatus === 'error' && (
                  <p className="text-[11px] text-[#ff453a]">Failed to send. Try again.</p>
                )}
                <button
                  type="submit"
                  disabled={reportStatus === 'sending' || !reportDesc.trim()}
                  className="w-full h-9 bg-white/10 disabled:opacity-40 rounded-[10px] text-[13px] font-semibold text-white active:opacity-75 transition-opacity"
                >
                  {reportStatus === 'sending' ? 'Sending…' : 'Send report'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowReport(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <AlertCircle size={14} className="text-[#ff453a] flex-shrink-0" />
            <span className="text-[13px]">Report issue</span>
          </button>
        )}
      </div>

      {/* Sign out */}
      <div className="px-3 pb-5">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors"
        >
          <LogOut size={14} />
          <span className="text-[13px]">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
