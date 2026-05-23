'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Check, X, LogOut, ChevronRight, Camera, Download } from 'lucide-react';
import Link from 'next/link';
import { supabase, getRecentSessions, getOrCreateDailyLog, today } from '@/lib/supabase';

const AVATAR_COLORS = [
  'bg-[#30d158]', 'bg-[#0a84ff]', 'bg-[#30d158]',
  'bg-[#bf5af2]', 'bg-[#64d2ff]', 'bg-[#ff375f]',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

async function sha256hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getGravatarUrl(email: string): Promise<string | null> {
  const hash = await sha256hex(email.trim().toLowerCase());
  const probeUrl = `https://gravatar.com/avatar/${hash}?d=404&s=256`;
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(`https://gravatar.com/avatar/${hash}?s=256`);
    img.onerror = () => resolve(null);
    img.src = probeUrl;
  });
}

type ExerciseLog = { exercise_name: string; set_number: number; weight_lbs: number | null; reps: number | null; rest_seconds: number | null };
type WorkoutSession = { id: string; date: string; day_name: string; day_number: number; completed: boolean };
type ExportFormat = 'md' | 'csv' | 'doc' | 'pdf';

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toDateStr(d);
}

async function fetchSessionsWithLogs(from: string, to: string): Promise<{ session: WorkoutSession; logs: ExerciseLog[] }[]> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .eq('completed', true)
    .order('date', { ascending: true });

  if (!sessions || sessions.length === 0) return [];

  const ids = sessions.map((s: WorkoutSession) => s.id);
  const { data: logs } = await supabase
    .from('exercise_logs')
    .select('*')
    .in('session_id', ids)
    .order('set_number');

  const logsBySession: Record<string, ExerciseLog[]> = {};
  for (const log of logs || []) {
    if (!logsBySession[log.session_id]) logsBySession[log.session_id] = [];
    logsBySession[log.session_id].push(log);
  }

  return sessions.map((s: WorkoutSession) => ({ session: s, logs: logsBySession[s.id] || [] }));
}

function generateMarkdown(data: { session: WorkoutSession; logs: ExerciseLog[] }[]): string {
  if (data.length === 0) return '# Workout Export\n\nNo completed workouts in this date range.\n';
  const lines: string[] = ['# Workout Log\n'];
  for (const { session, logs } of data) {
    const dateLabel = new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    lines.push(`## ${dateLabel} — ${session.day_name}\n`);
    const byExercise: Record<string, ExerciseLog[]> = {};
    for (const log of logs) {
      if (!byExercise[log.exercise_name]) byExercise[log.exercise_name] = [];
      byExercise[log.exercise_name].push(log);
    }
    for (const [exercise, sets] of Object.entries(byExercise)) {
      lines.push(`### ${exercise}\n`);
      lines.push('| Set | Weight | Reps | Rest |');
      lines.push('|-----|--------|------|------|');
      for (const s of sets) {
        const rest = s.rest_seconds != null ? `${s.rest_seconds}s` : '—';
        lines.push(`| ${s.set_number} | ${s.weight_lbs ?? '—'} lbs | ${s.reps ?? '—'} | ${rest} |`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function generateCSV(data: { session: WorkoutSession; logs: ExerciseLog[] }[]): string {
  const rows = [['Date', 'Day', 'Exercise', 'Set', 'Weight (lbs)', 'Reps', 'Rest (s)']];
  for (const { session, logs } of data) {
    for (const log of logs) {
      rows.push([
        session.date,
        session.day_name,
        log.exercise_name,
        String(log.set_number),
        log.weight_lbs != null ? String(log.weight_lbs) : '',
        log.reps != null ? String(log.reps) : '',
        log.rest_seconds != null ? String(log.rest_seconds) : '',
      ]);
    }
  }
  return rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

function generateDocHTML(data: { session: WorkoutSession; logs: ExerciseLog[] }[], userName: string, from: string, to: string): string {
  const sessionBlocks = data.map(({ session, logs }) => {
    const dateLabel = new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const byExercise: Record<string, ExerciseLog[]> = {};
    for (const log of logs) {
      if (!byExercise[log.exercise_name]) byExercise[log.exercise_name] = [];
      byExercise[log.exercise_name].push(log);
    }
    const exerciseBlocks = Object.entries(byExercise).map(([exercise, sets]) => {
      const rows = sets.map(s => `<tr><td>${s.set_number}</td><td>${s.weight_lbs ?? '—'} lbs</td><td>${s.reps ?? '—'}</td><td>${s.rest_seconds != null ? s.rest_seconds + 's' : '—'}</td></tr>`).join('');
      return `<h3>${exercise}</h3><table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Rest</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join('');
    return `<h2>${dateLabel} — ${session.day_name}</h2>${exerciseBlocks}<hr/>`;
  }).join('');

  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:28px}h3{font-size:14px;margin:16px 0 6px}table{border-collapse:collapse;width:100%;margin-bottom:16px}th{background:#f0f0f0}td,th{padding:6px 10px;text-align:left}hr{margin:24px 0;border:none;border-top:1px solid #ddd}</style></head><body><h1>Workout Log — ${userName || 'My Workouts'}</h1><p>${from} to ${to}</p><hr/>${data.length === 0 ? '<p>No completed workouts in this date range.</p>' : sessionBlocks}</body></html>`;
}

function generatePrintHTML(data: { session: WorkoutSession; logs: ExerciseLog[] }[], userName: string, from: string, to: string): string {
  return generateDocHTML(data, userName, from, to);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProfilePage() {
  const [name, setName]               = useState('');
  const [editName, setEditName]       = useState('');
  const [email, setEmail]             = useState('');
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [todayLogId, setTodayLogId]   = useState<string | null>(null);
  const [resetting, setResetting]     = useState(false);
  const [resetDone, setResetDone]     = useState(false);
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [userId, setUserId]           = useState<string | null>(null);

  const [isAdmin, setIsAdmin]         = useState(false);
  const [exportOpen, setExportOpen]   = useState(false);
  const [proteinPct, setProteinPct]   = useState<number | null>(null);
  const [bestLift, setBestLift]       = useState<{ weight: number; exercise: string } | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);

  // Export state
  const [exportFrom, setExportFrom]   = useState(defaultFrom);
  const [exportTo, setExportTo]       = useState(toDateStr(new Date()));
  const [exportFormat, setExportFormat] = useState<ExportFormat>('md');
  const [exporting, setExporting]     = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchProgressStats(uid: string) {
    const { data: logs } = await supabase
      .from('daily_logs')
      .select('protein_g')
      .eq('user_id', uid)
      .order('date', { ascending: false })
      .limit(30);
    if (logs && logs.length > 0) {
      const hit = logs.filter((l: { protein_g: number }) => l.protein_g >= 180).length;
      setProteinPct(Math.round((hit / logs.length) * 100));
    }

    const { data: weightLog } = await supabase
      .from('daily_logs')
      .select('weight_lbs')
      .eq('user_id', uid)
      .not('weight_lbs', 'is', null)
      .order('date', { ascending: false })
      .limit(1);
    if (weightLog?.[0]?.weight_lbs) setCurrentWeight(weightLog[0].weight_lbs);

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', uid)
      .eq('completed', true);
    if (sessions && sessions.length > 0) {
      const ids = sessions.map((s: { id: string }) => s.id);
      const { data: topSet } = await supabase
        .from('exercise_logs')
        .select('weight_lbs, exercise_name')
        .in('session_id', ids)
        .not('weight_lbs', 'is', null)
        .order('weight_lbs', { ascending: false })
        .limit(1);
      if (topSet?.[0]) setBestLift({ weight: topSet[0].weight_lbs, exercise: topSet[0].exercise_name });
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const userEmail = user.email ?? '';
      setEmail(userEmail);
      setUserId(user.id);
      const n = user.user_metadata?.name || user.user_metadata?.full_name || '';
      setName(n);
      setEditName(n);
      setIsAdmin(user.user_metadata?.is_admin === true || user.app_metadata?.is_admin === true);
      setLoadingProfile(false);

      const customUrl = user.user_metadata?.avatar_url as string | undefined;
      if (customUrl) {
        setAvatarUrl(customUrl);
      } else if (userEmail) {
        const gravatarUrl = await getGravatarUrl(userEmail);
        if (gravatarUrl) setAvatarUrl(gravatarUrl);
      }

      fetchProgressStats(user.id);
    })();
    getRecentSessions(200).then(s => setTotalSessions(s.length));
    getOrCreateDailyLog(today()).then(log => { if (log) setTodayLogId(log.id); });

  }, []);

  function startEdit() {
    setEditName(name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function saveName() {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { name: editName.trim() } });
    if (!error) setName(editName.trim());
    setEditing(false);
    setSaving(false);
  }

  function cancelEdit() {
    setEditName(name);
    setEditing(false);
  }

  async function resetToday() {
    if (!todayLogId) return;
    setResetting(true);
    const zeros = {
      protein_g: 0, water_oz: 0, creatine: false, cardio_done: false,
      cardio_minutes: 0, steps: 0, weight_lbs: null as number | null, cheat_meal_used: false,
      meal_1_done: false, meal_2_done: false, meal_3_done: false,
      meal_4_done: false, meal_5_done: false, custom_meals_done: {},
    };
    await supabase.from('daily_logs').update(zeros).eq('id', todayLogId);
    setResetting(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      setAvatarUrl(url);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleExport() {
    if (!exportFrom || !exportTo) return;
    setExporting(true);
    try {
      const data = await fetchSessionsWithLogs(exportFrom, exportTo);
      const slug = `workouts-${exportFrom}-to-${exportTo}`;

      if (exportFormat === 'md') {
        download(generateMarkdown(data), `${slug}.md`, 'text/markdown');
      } else if (exportFormat === 'csv') {
        download(generateCSV(data), `${slug}.csv`, 'text/csv');
      } else if (exportFormat === 'doc') {
        download(generateDocHTML(data, name, exportFrom, exportTo), `${slug}.doc`, 'application/msword');
      } else if (exportFormat === 'pdf') {
        const html = generatePrintHTML(data, name, exportFrom, exportTo);
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 400);
        }
      }
    } finally {
      setExporting(false);
    }
  }

  const initials = name ? getInitials(name) : '?';
  const avatarBg = name ? getAvatarColor(name) : 'bg-white/10';

  const formats: { key: ExportFormat; label: string; sub: string }[] = [
    { key: 'md',  label: 'Markdown', sub: '.md'  },
    { key: 'csv', label: 'Excel',    sub: '.csv'  },
    { key: 'doc', label: 'Word',     sub: '.doc'  },
    { key: 'pdf', label: 'PDF',      sub: 'print' },
  ];

  return (
    <div className="max-w-lg mx-auto px-0">

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />

      {/* 1. Hero */}
      <div className="flex flex-col items-center pt-2 pb-8">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative w-22 h-22 rounded-full flex-shrink-0 group focus:outline-none mb-4"
          style={{ width: 88, height: 88 }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name || 'Avatar'} className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className={`w-full h-full rounded-full ${avatarBg} flex items-center justify-center`}>
              <span className="text-[30px] font-bold text-white">{initials}</span>
            </div>
          )}
          <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {uploading
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Camera size={20} className="text-white" />}
          </div>
        </button>

        {loadingProfile ? (
          <div className="animate-pulse h-7 w-40 bg-white/10 rounded-lg mb-2" />
        ) : editing ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelEdit(); }}
              className="bg-white/8 rounded-xl px-3 h-10 text-[22px] font-bold text-white text-center outline-none focus:ring-1 focus:ring-[#30d158]/60 w-52"
            />
            <button onClick={saveName} disabled={saving} className="w-9 h-9 rounded-full bg-[#30d158] flex items-center justify-center flex-shrink-0 active:opacity-75">
              <Check size={14} strokeWidth={3} className="text-white" />
            </button>
            <button onClick={cancelEdit} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 active:opacity-75">
              <X size={14} className="text-white/60" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-[28px] font-bold text-white">{name || 'No name set'}</h1>
            <button onClick={startEdit} className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
              <Pencil size={15} />
            </button>
          </div>
        )}

        <p className="text-[15px] text-white/45">{email}</p>
        {totalSessions !== null && (
          <p className="text-[13px] text-white/30 mt-1">{totalSessions} total sessions</p>
        )}
      </div>

      {/* 2. Progress stats */}
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-3">Your progress</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#111111] rounded-2xl p-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Sessions</p>
          <p className="text-[34px] font-bold leading-none tabular-nums text-[#30d158]">{totalSessions !== null ? totalSessions : '—'}</p>
          <p className="text-[13px] text-white/35 mt-1">total workouts</p>
        </div>
        <div className="bg-[#111111] rounded-2xl p-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Protein</p>
          <p className="text-[34px] font-bold leading-none tabular-nums text-[#30d158]">{proteinPct !== null ? `${proteinPct}%` : '—'}</p>
          <p className="text-[13px] text-white/35 mt-1">days hitting goal</p>
        </div>
        <div className="bg-[#111111] rounded-2xl p-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Best lift</p>
          <p className="text-[34px] font-bold leading-none tabular-nums text-white">{bestLift !== null ? bestLift.weight : '—'}</p>
          <p className="text-[13px] text-white/35 mt-1">{bestLift ? `lbs · ${bestLift.exercise}` : 'lbs top set'}</p>
        </div>
        <div className="bg-[#111111] rounded-2xl p-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">Weight</p>
          <p className="text-[34px] font-bold leading-none tabular-nums text-white">{currentWeight !== null ? currentWeight : '—'}</p>
          <p className="text-[13px] text-white/35 mt-1">lbs current</p>
        </div>
      </div>

      {/* 3. Export workouts */}
      <div className="bg-[#111111] rounded-2xl overflow-hidden mb-6">
        {/* Header — tappable on mobile to toggle, static label on sm+ */}
        <button
          className="w-full flex items-center justify-between px-4 h-[52px] sm:cursor-default"
          onClick={() => setExportOpen(o => !o)}
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Export workouts</p>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-white/25 transition-transform duration-200 sm:hidden ${exportOpen ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {/* Content — always visible on sm+, toggled on mobile */}
        <div className={`px-4 pb-4 sm:block ${exportOpen ? 'block' : 'hidden'}`}>

          {/* Date range */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1.5">From</p>
              <input
                type="date"
                value={exportFrom}
                onChange={e => setExportFrom(e.target.value)}
                className="w-full bg-white/8 rounded-xl px-3 h-11 text-[15px] text-white outline-none focus:ring-1 focus:ring-[#30d158]/60"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1.5">To</p>
              <input
                type="date"
                value={exportTo}
                onChange={e => setExportTo(e.target.value)}
                className="w-full bg-white/8 rounded-xl px-3 h-11 text-[15px] text-white outline-none focus:ring-1 focus:ring-[#30d158]/60"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Format picker */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {formats.map(f => (
              <button
                key={f.key}
                onClick={() => setExportFormat(f.key)}
                className={`flex flex-col items-center py-3 rounded-xl border transition-colors ${
                  exportFormat === f.key
                    ? 'border-[#30d158] bg-[#30d158]/10'
                    : 'border-white/10 bg-white/4'
                }`}
              >
                <span className={`text-[15px] font-semibold ${exportFormat === f.key ? 'text-[#30d158]' : 'text-white/70'}`}>{f.label}</span>
                <span className={`text-[11px] mt-0.5 ${exportFormat === f.key ? 'text-[#30d158]/70' : 'text-white/30'}`}>{f.sub}</span>
              </button>
            ))}
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting || !exportFrom || !exportTo}
            className="w-full h-[50px] bg-[#30d158] disabled:opacity-40 rounded-[14px] font-semibold text-[17px] text-black flex items-center justify-center gap-2 active:opacity-75 transition-opacity"
          >
            {exporting ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Download size={18} strokeWidth={2.5} />
            )}
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {/* 4. Account actions */}
      <div className="bg-[#111111] rounded-2xl overflow-hidden mb-3">
        {isAdmin && (
          <>
            <Link href="/trainer"
              className="flex items-center justify-between h-[50px] px-4 text-[17px] text-white hover:bg-white/5 active:bg-white/8 transition-colors">
              <span>Coach area</span>
              <ChevronRight size={16} className="text-white/25" />
            </Link>
            <div className="h-px bg-white/8 ml-4" />
          </>
        )}
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
          className="flex items-center gap-2 w-full h-[50px] px-4 text-[17px] text-[#ff453a] hover:bg-white/5 active:bg-white/8 transition-colors">
          <LogOut size={17} />
          Sign out
        </button>
      </div>

      {/* 6. Reset today */}
      {todayLogId && (
        <div className="bg-[#111111] rounded-2xl overflow-hidden">
          <button
            onClick={resetToday}
            disabled={resetting || resetDone}
            className="flex items-center justify-between w-full h-[60px] px-4 hover:bg-white/5 active:bg-white/8 transition-colors disabled:opacity-60"
          >
            <div className="text-left">
              <p className={`text-[17px] font-medium ${resetDone ? 'text-[#30d158]' : 'text-[#ff9f0a]'}`}>
                {resetting ? 'Resetting…' : resetDone ? 'Reset complete' : "Reset today's data"}
              </p>
              <p className="text-[13px] text-white/35 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {!resetting && !resetDone && (
              <span className="text-[13px] text-white/20">Clears all progress for today</span>
            )}
            {resetDone && <Check size={18} className="text-[#30d158] flex-shrink-0" />}
          </button>
        </div>
      )}

      {/* Version */}
      <p className="text-center text-[12px] text-white/20 pt-2 pb-4">v1.0.2</p>

    </div>
  );
}
