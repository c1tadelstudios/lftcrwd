'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, User, X } from 'lucide-react';
import { useSettings, invalidateSettingsCache } from '@/hooks/useSettings';
const POLL_INTERVAL = 30_000;

type AppUser = { id: string; email: string; name: string };
type Session = { id: string; date: string; completed: boolean; user_id: string };
type DailyLog = { date: string; protein_g: number; weight_lbs: number | null; user_id: string };
type Weight = { date: string; weight_lbs: number; user_id: string };
type Message = { id: string; body: string; sender: string; created_at: string; user_id: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function localDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00');
}

function Chevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20 flex-shrink-0">
      <path d="M1 1l5 5-5 5"/>
    </svg>
  );
}

export default function TrainerDashboard() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteError, setInviteError] = useState('');

  // Report Issue (mobile)
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

  // Branding
  const { business_name: currentName, tagline: currentTagline } = useSettings();
  const [brandName, setBrandName] = useState('');
  const [brandTagline, setBrandTagline] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [showBranding, setShowBranding] = useState(false);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) return;
    setBrandSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name: brandName.trim(), tagline: brandTagline.trim() || null }),
    });
    invalidateSettingsCache();
    setBrandSaving(false);
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 3000);
  }

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
      } else {
        const data = await res.json();
        setInviteError(data.error || 'Something went wrong.');
        setInviteStatus('error');
      }
    } catch {
      setInviteError('Request failed. Check your connection.');
      setInviteStatus('error');
    }
  }

  async function archiveClient(userId: string, name: string) {
    if (!confirm(`Archive ${name}? They will be hidden from this view and won't be able to log in with their current email. Their data is kept.`)) return;
    const res = await fetch(`/api/trainer/client?userId=${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to archive client: ${data.error || res.status}`);
      return;
    }
    await fetchData();
  }

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/trainer/data');
    if (!res.ok) return;
    const data = await res.json();
    setUsers(data.users || []);
    setSessions(data.sessions || []);
    setDailyLogs(data.dailyLogs || []);
    setWeights(data.weights || []);
    setMessages(data.messages || []);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  // Sync brand fields from loaded settings
  useEffect(() => {
    setBrandName(currentName);
    setBrandTagline(currentTagline ?? '');
  }, [currentName, currentTagline]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  const today = todayStr();
  const weekStart = getMondayOfCurrentWeek();

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse h-[140px] bg-[#111111] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="md:p-8">
      {/* Mobile header — hidden on desktop (sidebar has the title) */}
      <div className="mb-6 flex justify-between items-start md:hidden">
        <div>
          <p className="text-[13px] text-white/45 mb-1">Trainer View</p>
          <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.37px] text-white">Clients</h1>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 bg-[#30d158] rounded-full" />
              <span className="text-[11px] text-white/35">Live</span>
            </div>
            {lastUpdated && (
              <p className="text-[11px] text-white/25 mt-0.5">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <Link href="/profile" className="w-10 h-10 rounded-full bg-[#111111] flex items-center justify-center">
            <User size={18} className="text-white/50" />
          </Link>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:block mb-8">
        <h1 className="text-[28px] font-bold text-white">Overview</h1>
        <p className="text-[14px] text-white/40 mt-1">
          {users.length} {users.length === 1 ? 'client' : 'clients'} · select one from the sidebar
        </p>
      </div>

      {/* Client list — mobile only (desktop uses sidebar) */}
      {users.length === 0 ? (
        <div className="bg-[#111111] rounded-2xl p-8 text-center md:hidden">
          <p className="text-[17px] text-white/45">No clients yet.</p>
          <p className="text-[13px] text-white/25 mt-1">Invite someone below to get started.</p>
        </div>
      ) : (
        <div className="md:hidden">
          {/* Summary line */}
          <p className="text-[13px] text-white/35 mb-3 px-1">
            {users.length} {users.length === 1 ? 'client' : 'clients'}
            {' · '}
            <span className="text-[#30d158]">
              {dailyLogs.filter(l => l.date === today).length} active today
            </span>
          </p>

          {/* Compact list */}
          <div className="bg-[#111111] rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {users.map(user => {
              const userSessions = sessions.filter(s => s.user_id === user.id);
              const thisWeekCount = userSessions.filter(s => localDate(s.date) >= weekStart).length;
              const userLogs = dailyLogs.filter(l => l.user_id === user.id);
              const todayLog = userLogs.find(l => l.date === today);
              const latestWeight = weights.filter(w => w.user_id === user.id)[0];

              // Compliance: workouts this week out of 5 expected
              const compliancePct = Math.round((thisWeekCount / 5) * 100);

              // Last active: most recent session or daily log date
              const allDates = [
                ...userSessions.map(s => s.date),
                ...userLogs.map(l => l.date),
              ].sort().reverse();
              const lastActive = allDates[0];
              const daysSinceActive = lastActive
                ? Math.floor((Date.now() - new Date(lastActive + 'T12:00:00').getTime()) / 86_400_000)
                : null;
              const needsAttention = daysSinceActive !== null && daysSinceActive >= 3;

              const statLine = [
                `${compliancePct}% this week`,
                todayLog
                  ? `${todayLog.protein_g}g protein`
                  : latestWeight
                  ? `${latestWeight.weight_lbs} lbs`
                  : null,
              ].filter(Boolean).join(' · ');

              return (
                <Link
                  key={user.id}
                  href={`/trainer/${user.id}`}
                  className="flex items-center gap-3 px-4 h-[70px] active:bg-white/6 transition-colors"
                >
                  {/* Avatar with active dot */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center text-[17px] font-semibold ${
                      todayLog ? 'bg-[#30d158]/15 text-[#30d158]' : 'bg-white/8 text-white/45'
                    }`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    {todayLog && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#30d158] rounded-full border-2 border-[#111111]" />
                    )}
                  </div>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[17px] font-semibold text-white truncate leading-tight">{user.name}</p>
                      {needsAttention && (
                        <span className="flex-shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ff9f0a]/15 text-[#ff9f0a]">
                          {daysSinceActive}d quiet
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-white/40 truncate mt-0.5 leading-tight">{statLine}</p>
                  </div>

                  {/* Chevron */}
                  <Chevron />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop: quick-stats row */}
      {!loading && (
        <div className="hidden md:grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#111111] rounded-2xl px-5 py-4">
            <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Total clients</p>
            <p className="text-[32px] font-bold text-white tabular-nums leading-none">{users.length}</p>
          </div>
          <div className="bg-[#111111] rounded-2xl px-5 py-4">
            <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Active today</p>
            <p className="text-[32px] font-bold tabular-nums leading-none text-[#30d158]">
              {dailyLogs.filter(l => l.date === today).length}
            </p>
          </div>
          <div className="bg-[#111111] rounded-2xl px-5 py-4">
            <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Sessions this week</p>
            <p className="text-[32px] font-bold text-white tabular-nums leading-none">
              {sessions.filter(s => {
                const d = new Date(s.date + 'T12:00:00');
                const mon = getMondayOfCurrentWeek();
                return d >= mon;
              }).length}
            </p>
          </div>
        </div>
      )}

      {/* Invite — mobile only (sidebar handles desktop) */}
      <div className="mt-6 md:hidden bg-[#111111] rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#30d158]/15 flex items-center justify-center flex-shrink-0">
            <User size={15} className="text-[#30d158]" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-white">Invite a client</p>
            <p className="text-[12px] text-white/35">Send a magic-link onboarding email</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          {inviteStatus === 'sent' ? (
            <div className="flex items-center justify-between h-11">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#30d158]/15 flex items-center justify-center">
                  <Check size={14} strokeWidth={3} className="text-[#30d158]" />
                </div>
                <span className="text-[15px] text-[#30d158] font-medium">Invite sent!</span>
              </div>
              <button
                onClick={() => setInviteStatus('idle')}
                className="text-[13px] text-white/35 hover:text-white/60 transition-colors"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={sendInvite} className="space-y-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteStatus('idle'); setInviteError(''); }}
                placeholder="client@email.com"
                className="w-full bg-white/8 rounded-xl px-4 h-[50px] text-[17px] outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/25"
                disabled={inviteStatus === 'sending'}
              />
              <button
                type="submit"
                disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
                className="w-full h-[50px] bg-[#30d158] active:opacity-75 disabled:opacity-40 text-black rounded-[14px] text-[17px] font-semibold flex items-center justify-center gap-2 transition-opacity"
              >
                {inviteStatus === 'sending' ? (
                  'Sending…'
                ) : (
                  <>
                    <User size={17} strokeWidth={2.5} />
                    Send invite
                  </>
                )}
              </button>
            </form>
          )}
          {inviteStatus === 'error' && (
            <p className="text-[13px] text-[#ff453a] mt-2">{inviteError}</p>
          )}
        </div>
      </div>
      {/* Branding — collapsed by default */}
      <div className="mt-6 bg-[#111111] rounded-2xl overflow-hidden md:max-w-md">
        <button
          type="button"
          onClick={() => setShowBranding(v => !v)}
          className="w-full flex items-center justify-between px-4 h-[54px] active:bg-white/5 transition-colors"
        >
          <span className="text-[15px] text-white/40">Branding</span>
          <span className="text-[13px] text-white/25 truncate max-w-[180px] text-right">{currentName || 'Not set'}</span>
        </button>

        {showBranding && (
          <form onSubmit={saveBranding} className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
            <div>
              <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1.5">Business name</p>
              <input
                type="text"
                value={brandName}
                onChange={e => { setBrandName(e.target.value); setBrandSaved(false); }}
                placeholder="Your Business Name"
                className="w-full bg-white/8 rounded-xl px-4 h-11 text-[17px] text-white outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/25"
              />
            </div>
            <div>
              <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1.5">Tagline <span className="normal-case text-white/20">(optional)</span></p>
              <input
                type="text"
                value={brandTagline}
                onChange={e => { setBrandTagline(e.target.value); setBrandSaved(false); }}
                placeholder="e.g. Train smarter. Live stronger."
                className="w-full bg-white/8 rounded-xl px-4 h-11 text-[17px] text-white outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/25"
              />
            </div>
            <button
              type="submit"
              disabled={brandSaving || !brandName.trim()}
              className="w-full h-11 bg-[#30d158] disabled:opacity-40 rounded-[14px] text-[17px] font-semibold text-black active:opacity-75 transition-opacity flex items-center justify-center gap-2"
            >
              {brandSaved ? (
                <><Check size={16} strokeWidth={3} /> Saved</>
              ) : brandSaving ? 'Saving…' : 'Save branding'}
            </button>
          </form>
        )}
      </div>

      {/* Report Issue — mobile only */}
      <div className="mt-3 md:hidden">
        {showReport ? (
          <div className="bg-[#111111] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-white/50 uppercase tracking-wider">Report Issue</p>
              <button onClick={() => { setShowReport(false); setReportStatus('idle'); }} className="text-white/30 hover:text-white/60">
                <X size={16} />
              </button>
            </div>
            {reportStatus === 'sent' ? (
              <div className="flex items-center gap-2 py-1">
                <Check size={15} className="text-[#30d158]" />
                <span className="text-[15px] text-[#30d158]">Sent to Shane!</span>
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-3">
                <select
                  value={reportArea}
                  onChange={e => setReportArea(e.target.value)}
                  className="w-full bg-white/8 rounded-xl px-4 h-11 text-[15px] outline-none focus:ring-1 focus:ring-white/20 text-white"
                >
                  {['General', 'Today Dashboard', 'Workout', 'Meals', 'Progress', 'Trainer View', 'Client Detail', 'Invite / Email', 'Other'].map(a => (
                    <option key={a} value={a} className="bg-[#111]">{a}</option>
                  ))}
                </select>
                <select
                  value={reportSeverity}
                  onChange={e => setReportSeverity(e.target.value)}
                  className="w-full bg-white/8 rounded-xl px-4 h-11 text-[15px] outline-none focus:ring-1 focus:ring-white/20 text-white"
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
                  className="w-full bg-white/8 rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-1 focus:ring-white/20 placeholder:text-white/25 resize-none"
                />
                {reportStatus === 'error' && (
                  <p className="text-[13px] text-[#ff453a]">Failed to send. Try again.</p>
                )}
                <button
                  type="submit"
                  disabled={reportStatus === 'sending' || !reportDesc.trim()}
                  className="w-full h-11 bg-white/10 disabled:opacity-40 rounded-[14px] text-[17px] font-semibold text-white active:opacity-75 transition-opacity"
                >
                  {reportStatus === 'sending' ? 'Sending…' : 'Send report'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowReport(true)}
            className="w-full flex items-center gap-3 px-4 h-[54px] rounded-2xl bg-[#111111] active:opacity-75 transition-opacity"
          >
            <AlertCircle size={22} className="text-[#ff453a] flex-shrink-0" />
            <div className="text-left">
              <p className="text-[15px] font-semibold text-white">Report an issue</p>
              <p className="text-[12px] text-white/35">Sends directly to Shane</p>
            </div>
          </button>
        )}
      </div>

    </div>
  );
}
