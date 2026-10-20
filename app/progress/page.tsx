'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Check, X } from 'lucide-react';
import { shrinkImage } from '@/lib/image';
import { supabase, getRecentSessions, getWeightHistory, getOrCreateDailyLog, today, type WorkoutSession } from '@/lib/supabase';

type DailyLog = {
  id: string;
  date: string;
  protein_g: number;
  creatine: boolean;
  cardio_done: boolean;
  weight_lbs: number | null;
};

type ExerciseLog = {
  session_id: string;
  exercise_name: string;
  weight_lbs: number | null;
};

type ProgressPoint = { date: string; maxWeight: number };

function OverloadChart({ data }: { data: ProgressPoint[] }) {
  if (data.length < 2) return (
    <p className="text-[15px] text-white/35 text-center py-6">Log at least 2 sessions for this exercise to see the trend.</p>
  );

  const W = 320, H = 130;
  const pad = { top: 8, right: 12, bottom: 28, left: 42 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const vals = data.map(d => d.maxWeight);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 10;

  const xOf = (i: number) => pad.left + (i / (data.length - 1)) * innerW;
  const yOf = (v: number) => pad.top + (1 - (v - minV) / range) * innerH;

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d.maxWeight).toFixed(1)}`).join(' ');
  const areaD = pathD + ` L${xOf(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${xOf(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;

  const yTicks = [minV, minV + range / 2, maxV].map(v => Math.round(v));
  const change = data[data.length - 1].maxWeight - data[0].maxWeight;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="ograd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30d158" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#30d158" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, i) => {
          const y = yOf(tick);
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x={pad.left - 4} y={y + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">{tick}</text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#ograd)" />
        <path d={pathD} fill="none" stroke="#30d158" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={xOf(i)} cy={yOf(d.maxWeight)} r={i === data.length - 1 ? 4 : 2.5}
            fill={i === data.length - 1 ? '#30d158' : '#000000'} stroke="#30d158" strokeWidth="1.5" />
        ))}
        {[0, data.length - 1].map(i => (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor={i === 0 ? 'start' : 'end'} fontSize="9" fill="rgba(255,255,255,0.3)">
            {new Date(data[i].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
      <div className="flex justify-between text-[13px] mt-1 px-1">
        <span className="text-white/35">Start: <span className="text-white/60">{data[0].maxWeight} lbs</span></span>
        <span className={`font-semibold ${change >= 0 ? 'text-[#30d158]' : 'text-[#ff453a]'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)} lbs
        </span>
        <span className="text-white/35">Now: <span className="text-white/60">{data[data.length - 1].maxWeight} lbs</span></span>
      </div>
    </div>
  );
}

function WeightChart({ weights }: { weights: { date: string; weight_lbs: number }[] }) {
  if (weights.length < 2) return (
    <p className="text-[15px] text-white/45 text-center py-4">Log at least 2 weigh-ins to see your trend.</p>
  );

  const W = 300, H = 90;
  const padX = 8, padTop = 8, padBottom = 8;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;

  const vals = weights.map(w => w.weight_lbs);
  const minV = Math.min(...vals) - 1.5;
  const maxV = Math.max(...vals) + 1.5;
  const range = maxV - minV || 1;

  const cx = (i: number) => padX + (i / (weights.length - 1)) * chartW;
  const cy = (v: number) => padTop + (1 - (v - minV) / range) * chartH;

  const linePts = weights.map((w, i) => `${cx(i)},${cy(w.weight_lbs)}`).join(' ');
  const areaD =
    `M${cx(0)},${cy(weights[0].weight_lbs)} ` +
    weights.slice(1).map((w, i) => `L${cx(i + 1)},${cy(w.weight_lbs)}`).join(' ') +
    ` L${cx(weights.length - 1)},${H - padBottom} L${cx(0)},${H - padBottom} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30d158" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#30d158" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#wgrad)" />
        <polyline
          points={linePts}
          fill="none"
          stroke="#30d158"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {weights.map((w, i) => {
          const isLast = i === weights.length - 1;
          return (
            <circle
              key={w.date}
              cx={cx(i)}
              cy={cy(w.weight_lbs)}
              r={isLast ? 4 : 2}
              fill={isLast ? '#30d158' : '#000000'}
              stroke="#30d158"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[11px] text-white/25 mt-1">
        <span>{new Date(weights[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>{new Date(weights[weights.length - 1].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

const HABITS = [
  { key: 'protein_g',   label: 'Protein',  check: (l: DailyLog) => l.protein_g >= 180, color: 'bg-[#0a84ff]' },
  { key: 'creatine',    label: 'Creatine', check: (l: DailyLog) => l.creatine,         color: 'bg-[#bf5af2]' },
  { key: 'cardio_done', label: 'Cardio',   check: (l: DailyLog) => l.cardio_done,      color: 'bg-[#64d2ff]' },
] as const;

function HabitGrid({ logs }: { logs: DailyLog[] }) {
  const days = [...logs].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <td className="pr-3 pb-2 text-white/25 w-16"></td>
            {days.map(log => (
              <td key={log.date} className="text-center pb-2 text-white/35 font-medium min-w-[32px]">
                {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {HABITS.map(habit => (
            <tr key={habit.key}>
              <td className="pr-3 py-1.5 text-white/45">{habit.label}</td>
              {days.map(log => {
                const done = habit.check(log);
                return (
                  <td key={log.date} className="text-center py-1.5">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${done ? habit.color : 'bg-white/8'}`}>
                      {done && <Check size={11} strokeWidth={3} className="text-white" />}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Photo = { name: string; url: string; date: string };

export default function ProgressPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weights, setWeights] = useState<{ date: string; weight_lbs: number }[]>([]);
  const [weekLogs, setWeekLogs] = useState<DailyLog[]>([]);
  const [todayLogId, setTodayLogId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [weightSaved, setWeightSaved] = useState(false);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [loading, setLoading] = useState(true);

  // Weekly check-in
  type Checkin = { id: string; week_start: string; weight_lbs: number | null; energy: number | null; sleep_hrs: number | null; stress: number | null; mood: number | null; recovery: number | null; notes: string | null };
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinForm, setCheckinForm] = useState({ weight_lbs: '', energy: 3, sleep_hrs: '', stress: 3, mood: 3, recovery: 3, notes: '' });
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState(false);

  function getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday.toISOString().split('T')[0];
  }

  async function submitCheckin(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCheckinSubmitting(true);
    const week_start = getWeekStart();
    const res = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        week_start,
        weight_lbs: checkinForm.weight_lbs ? parseFloat(checkinForm.weight_lbs) : null,
        energy: checkinForm.energy,
        sleep_hrs: checkinForm.sleep_hrs ? parseFloat(checkinForm.sleep_hrs) : null,
        stress: checkinForm.stress,
        mood: checkinForm.mood,
        recovery: checkinForm.recovery,
        notes: checkinForm.notes.trim() || null,
      }),
    });
    if (res.ok) {
      setCheckinDone(true);
      setEditingCheckin(false);
      const newEntry: Checkin = {
        id: 'new', week_start,
        weight_lbs: checkinForm.weight_lbs ? parseFloat(checkinForm.weight_lbs) : null,
        energy: checkinForm.energy,
        sleep_hrs: checkinForm.sleep_hrs ? parseFloat(checkinForm.sleep_hrs) : null,
        stress: checkinForm.stress,
        mood: checkinForm.mood,
        recovery: checkinForm.recovery,
        notes: checkinForm.notes || null,
      };
      setCheckins(prev => [newEntry, ...prev.filter(c => c.week_start !== week_start)]);
    }
    setCheckinSubmitting(false);
  }

  // Progress photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function canDelete(filename: string): boolean {
    const ts = parseInt(filename.split('-')[3]?.split('.')[0] || '0');
    return !isNaN(ts) && Date.now() - ts < 24 * 60 * 60 * 1000;
  }

  async function deletePhoto(photo: Photo) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDeletingPhoto(true);
    const res = await fetch('/api/progress-photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, filename: photo.name }),
    });
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.name !== photo.name));
      setLightboxPhoto(null);
    }
    setDeletingPhoto(false);
  }

  useEffect(() => {
    async function loadPhotosAndCheckins() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [photoRes, checkinRes] = await Promise.all([
        fetch(`/api/progress-photos?userId=${user.id}`),
        fetch(`/api/checkins?userId=${user.id}`),
      ]);
      if (photoRes.ok) setPhotos((await photoRes.json()).photos || []);
      if (checkinRes.ok) setCheckins((await checkinRes.json()).checkins || []);
    }
    loadPhotosAndCheckins();
  }, []);

  async function uploadPhoto(file: File) {
    setUploadError('');

    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are supported (JPEG, PNG, HEIC, etc.).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Photo must be under 20 MB.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUploading(true);

    const form = new FormData();
    form.append('file', await shrinkImage(file));
    const res = await fetch('/api/progress-photos', { method: 'POST', body: form });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setUploadError(body.error || 'Upload failed. Please try again.');
    } else {
      const listRes = await fetch(`/api/progress-photos?userId=${user.id}`);
      if (listRes.ok) {
        const data = await listRes.json();
        setPhotos(data.photos || []);
      }
    }
    setUploading(false);
  }

  useEffect(() => {
    async function load() {
      const [s, w] = await Promise.all([getRecentSessions(50), getWeightHistory()]);
      setSessions(s);
      setWeights(w);

      // Fetch exercise logs for progressive overload chart
      if (s.length > 0) {
        const sessionIds = s.map(sess => sess.id);
        const { data: eLogs } = await supabase
          .from('exercise_logs')
          .select('session_id, exercise_name, weight_lbs')
          .in('session_id', sessionIds)
          .not('weight_lbs', 'is', null);
        setExerciseLogs((eLogs || []) as ExerciseLog[]);
      }

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, date, protein_g, creatine, cardio_done, weight_lbs')
        .order('date', { ascending: false })
        .limit(7);
      setWeekLogs((logs || []) as DailyLog[]);

      const tLog = await getOrCreateDailyLog(today());
      if (tLog) {
        setTodayLogId(tLog.id);
        if (tLog.weight_lbs) setWeightInput(String(tLog.weight_lbs));
      }

      setLoading(false);
    }
    load();
  }, []);

  async function saveWeight() {
    if (!todayLogId || !weightInput) return;
    const weight = parseFloat(weightInput);
    if (isNaN(weight)) return;
    await supabase.from('daily_logs').update({ weight_lbs: weight }).eq('id', todayLogId);
    setWeights(prev => {
      const filtered = prev.filter(w => w.date !== today());
      return [...filtered, { date: today(), weight_lbs: weight }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setWeightSaved(true);
    setTimeout(() => setWeightSaved(false), 2000);
  }

  const latestWeight = weights[weights.length - 1];
  const startWeight = weights[0];
  const totalChange = startWeight && latestWeight && startWeight.date !== latestWeight.date
    ? (latestWeight.weight_lbs - startWeight.weight_lbs)
    : null;

  const workoutsThisWeek = sessions.filter(s => {
    const diff = (Date.now() - new Date(s.date + 'T12:00:00').getTime()) / 86400000;
    return diff <= 7;
  }).length;

  // Build exercise progress data: max weight per exercise per date
  const sessionDateMap: Record<string, string> = {};
  for (const s of sessions) sessionDateMap[s.id] = s.date;

  const grouped: Record<string, Record<string, number>> = {};
  for (const log of exerciseLogs) {
    const date = sessionDateMap[log.session_id];
    if (!date || !log.weight_lbs) continue;
    if (!grouped[log.exercise_name]) grouped[log.exercise_name] = {};
    grouped[log.exercise_name][date] = Math.max(grouped[log.exercise_name][date] || 0, log.weight_lbs);
  }
  const progressData: Record<string, ProgressPoint[]> = {};
  for (const [exercise, datemap] of Object.entries(grouped)) {
    progressData[exercise] = Object.entries(datemap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, maxWeight]) => ({ date, maxWeight }));
  }
  const exerciseOptions = Object.keys(progressData).sort();
  const activeExercise = selectedExercise && progressData[selectedExercise] ? selectedExercise : (exerciseOptions[0] || '');
  const chartData = activeExercise ? progressData[activeExercise] : [];

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[#111111] rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[13px] text-white/45 mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.37px] text-white">Progress</h1>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start space-y-6 md:space-y-0">

        <div className="space-y-6">

          {/* Weight card */}
          <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Current weight</p>
          <div className="bg-[#111111] rounded-2xl p-4">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[52px] font-bold leading-none tracking-tight tabular-nums text-white">
                {latestWeight ? latestWeight.weight_lbs : '—'}
              </span>
              <span className="text-white/45 text-[17px] mb-1">lbs</span>
              {totalChange !== null && (
                <span className={`text-[17px] font-semibold ${totalChange < 0 ? 'text-[#30d158]' : 'text-[#ff453a]'}`}>
                  {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
                </span>
              )}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                inputMode="decimal"
                value={weightInput}
                onChange={e => { setWeightInput(e.target.value); setWeightSaved(false); }}
                placeholder="Log today's weight"
                className="flex-1 bg-white/8 rounded-xl px-3 h-11 text-[17px] outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/20"
              />
              <button
                onClick={saveWeight}
                disabled={!weightInput}
                className={`h-11 px-5 rounded-[14px] text-[17px] font-semibold transition-colors disabled:opacity-40 ${
                  weightSaved ? 'bg-[#30d158] text-white' : 'bg-[#30d158] text-white active:opacity-75'
                }`}
              >
                {weightSaved ? 'Saved' : 'Log'}
              </button>
            </div>

            <WeightChart weights={weights} />
          </div>
          </div>

          {/* Workouts this week — surface-less */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-[52px] font-bold leading-none tracking-tight tabular-nums ${workoutsThisWeek >= 5 ? 'text-[#30d158]' : 'text-white'}`}>
                {workoutsThisWeek}
              </span>
              <span className="text-[22px] font-bold text-white/25">/ 5</span>
              <span className="text-[17px] text-white/45 ml-1">workouts this week</span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    i < workoutsThisWeek ? 'bg-[#30d158]' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

        </div>

        <div className="space-y-6">

          {/* Habit tracker */}
          {weekLogs.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">This week</p>
              <div className="bg-[#111111] rounded-2xl p-4">
                <HabitGrid logs={weekLogs} />
              </div>
            </div>
          )}

          {/* Recent sessions — grouped list */}
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Recent sessions</p>
            {sessions.length === 0 ? (
              <p className="text-[15px] text-white/45 px-1">No sessions logged yet.</p>
            ) : (
              <div className="bg-[#111111] rounded-2xl overflow-hidden">
                {sessions.slice(0, 10).map((s, i, arr) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between h-[54px] px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#30d158]/15 flex items-center justify-center flex-shrink-0">
                          <Check size={12} strokeWidth={3} className="text-[#30d158]" />
                        </div>
                        <div>
                          <span className="text-[15px] font-medium text-white">{s.day_name}</span>
                          <span className="text-[13px] text-white/35 ml-1.5">Day {s.day_number}</span>
                        </div>
                      </div>
                      <span className="text-[13px] text-white/35">
                        {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {i < arr.length - 1 && <div className="h-px bg-white/8 ml-4" />}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Progressive overload — full width below grid */}
      {exerciseOptions.length > 0 && (
        <div className="mt-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Progressive overload</p>
          <div className="bg-[#111111] rounded-2xl p-4">
            {/* Exercise selector — horizontal scroll chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
              {exerciseOptions.map(ex => (
                <button
                  key={ex}
                  onClick={() => setSelectedExercise(ex)}
                  className={`flex-shrink-0 h-8 px-3 rounded-full text-[13px] font-medium transition-colors ${
                    ex === activeExercise
                      ? 'bg-[#30d158] text-white'
                      : 'bg-white/8 text-white/45 hover:bg-white/12'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
            <OverloadChart data={chartData} />
          </div>
        </div>
      )}

      {/* Progress Photos */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Progress photos</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 h-8 px-3 bg-[#30d158]/15 text-[#30d158] rounded-full text-[13px] font-medium active:opacity-70 disabled:opacity-40 transition-opacity"
          >
            <Camera size={13} />
            {uploading ? 'Uploading…' : 'Add photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadPhoto(file);
              e.target.value = '';
            }}
          />
        </div>
        {uploadError && (
          <p className="text-[13px] text-[#ff453a] px-1 mt-1">{uploadError}</p>
        )}

        {photos.length === 0 ? (
          <div className="bg-[#111111] rounded-2xl p-8 text-center">
            <Camera size={28} className="text-white/20 mx-auto mb-3" />
            <p className="text-[15px] text-white/35">No photos yet.</p>
            <p className="text-[13px] text-white/25 mt-1">Tap &quot;Add photo&quot; to upload your first check-in.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map(photo => (
              <button
                key={photo.name}
                onClick={() => setLightboxPhoto(photo)}
                className="relative aspect-square rounded-xl overflow-hidden bg-[#111111] active:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.date} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white/80 font-medium">
                    {new Date(photo.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Check-in */}
      <div className="mt-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Weekly check-in</p>
        {(() => {
          const weekStart = getWeekStart();
          const thisWeek = checkins.find(c => c.week_start === weekStart);
          if ((thisWeek || checkinDone) && !editingCheckin) {
            return (
              <div className="bg-[#111111] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#30d158]/15 flex items-center justify-center flex-shrink-0">
                      <Check size={13} strokeWidth={3} className="text-[#30d158]" />
                    </div>
                    <p className="text-[15px] font-medium text-white">Check-in submitted</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (thisWeek) {
                        setCheckinForm({
                          weight_lbs: thisWeek.weight_lbs?.toString() ?? '',
                          energy: thisWeek.energy ?? 3,
                          sleep_hrs: thisWeek.sleep_hrs?.toString() ?? '',
                          stress: thisWeek.stress ?? 3,
                          mood: thisWeek.mood ?? 3,
                          recovery: thisWeek.recovery ?? 3,
                          notes: thisWeek.notes ?? '',
                        });
                      }
                      setEditingCheckin(true);
                    }}
                    className="text-[13px] text-[#30d158] active:opacity-70"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-[13px] text-white/35">Week of {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                {(thisWeek?.notes || checkinForm.notes) && (
                  <p className="text-[14px] text-white/55 mt-2 italic">&ldquo;{thisWeek?.notes || checkinForm.notes}&rdquo;</p>
                )}
              </div>
            );
          }

          return (
            <form onSubmit={submitCheckin} className="bg-[#111111] rounded-2xl p-4 space-y-4">
              <p className="text-[13px] text-white/40">Week of {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] text-white/40 mb-1.5">Weight (lbs)</p>
                  <input
                    type="number" inputMode="decimal"
                    value={checkinForm.weight_lbs}
                    onChange={e => setCheckinForm(p => ({ ...p, weight_lbs: e.target.value }))}
                    placeholder="—"
                    className="w-full bg-white/8 rounded-xl px-3 h-11 text-[17px] outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/20"
                  />
                </div>
                <div>
                  <p className="text-[12px] text-white/40 mb-1.5">Sleep (hrs)</p>
                  <input
                    type="number" inputMode="decimal"
                    value={checkinForm.sleep_hrs}
                    onChange={e => setCheckinForm(p => ({ ...p, sleep_hrs: e.target.value }))}
                    placeholder="—"
                    className="w-full bg-white/8 rounded-xl px-3 h-11 text-[17px] outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/20"
                  />
                </div>
              </div>

              {[
                { key: 'energy',   label: 'Energy',   sublabels: ['Exhausted','Low','Okay','Good','On fire'] },
                { key: 'mood',     label: 'Mood',     sublabels: ['Really low','Low','Neutral','Good','Great'] },
                { key: 'stress',   label: 'Stress',   sublabels: ['None','Low','Moderate','High','Maxed out'] },
                { key: 'recovery', label: 'Recovery', sublabels: ['Wrecked','Sore','Okay','Fresh','100%'] },
              ].map(({ key, label, sublabels }) => {
                const val = (checkinForm as Record<string, number | string>)[key] as number;
                // Track fill: dots are space-between, centers at 0/25/50/75/100% of container
                // Inset 20px each side (half of 40px dot), fill covers (val-1) of 4 gaps
                const fillPct = (val - 1) / 4 * 100;
                return (
                  <div key={key}>
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="text-[12px] font-bold text-white/45 uppercase tracking-[0.07em]">{label}</p>
                      <p className="text-[13px] text-white/55">{sublabels[val - 1]}</p>
                    </div>

                    {/* Dot track */}
                    <div className="relative flex items-center justify-between mb-2">
                      {/* Background line */}
                      <div className="absolute left-5 right-5 h-[2px] bg-white/10 rounded-full" />
                      {/* Fill line */}
                      <div
                        className="absolute left-5 h-[2px] bg-[#30d158] rounded-full transition-all duration-200"
                        style={{ width: `calc(${(val - 1) * 25}% - ${(val - 1) * 10}px)` }}
                      />
                      {[1,2,3,4,5].map(n => {
                        const selected = val === n;
                        const filled = n < val;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCheckinForm(p => ({ ...p, [key]: n }))}
                            className="relative z-10 w-10 h-10 flex items-center justify-center -webkit-tap-highlight-color-transparent"
                          >
                            <div className={`rounded-full transition-all duration-150 ${
                              selected
                                ? 'w-[26px] h-[26px] bg-[#30d158] shadow-[0_0_0_5px_rgba(48,209,88,0.18)]'
                                : filled
                                ? 'w-[10px] h-[10px] bg-[#30d158]'
                                : 'w-[14px] h-[14px] bg-[#2a2a2a] border-2 border-[#333]'
                            }`} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Labels below dots */}
                    <div className="flex justify-between">
                      {sublabels.map((l, i) => (
                        <div key={i} className="w-10 text-center">
                          <span className={`text-[10px] leading-tight transition-colors ${
                            i + 1 === val ? 'text-[#30d158] font-semibold' : 'text-white/20'
                          }`}>
                            {l.split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div>
                <p className="text-[12px] text-white/40 mb-1.5">Notes for your coach</p>
                <textarea
                  value={checkinForm.notes}
                  onChange={e => setCheckinForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="How did the week go? Anything your coach should know?"
                  rows={3}
                  className="w-full bg-white/8 rounded-xl px-3 py-2.5 text-[15px] outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/25 resize-none"
                />
              </div>

              <button type="submit" disabled={checkinSubmitting}
                className="w-full h-[50px] bg-[#30d158] disabled:opacity-40 rounded-[14px] text-[17px] font-semibold text-black active:opacity-75 transition-opacity">
                {checkinSubmitting ? 'Saving…' : editingCheckin ? 'Save changes' : 'Submit check-in'}
              </button>
              {editingCheckin && (
                <button type="button" onClick={() => setEditingCheckin(false)}
                  className="w-full h-11 text-[15px] text-white/25 hover:text-white/50 transition-colors">
                  Cancel
                </button>
              )}
            </form>
          );
        })()}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white"
            onClick={() => setLightboxPhoto(null)}
          >
            <X size={24} />
          </button>
          <div onClick={e => e.stopPropagation()} className="max-w-sm w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxPhoto.url} alt={lightboxPhoto.date} className="w-full rounded-2xl" />
            <p className="text-center text-white/45 text-[14px] mt-3">
              {new Date(lightboxPhoto.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            {canDelete(lightboxPhoto.name) ? (
              <button
                onClick={() => deletePhoto(lightboxPhoto)}
                disabled={deletingPhoto}
                className="mt-4 w-full h-11 rounded-[14px] border border-[#ff453a]/40 text-[#ff453a] text-[15px] font-medium active:opacity-75 disabled:opacity-40 transition-opacity"
              >
                {deletingPhoto ? 'Deleting…' : 'Delete photo'}
              </button>
            ) : (
              <p className="text-center text-white/25 text-[12px] mt-4">Contact your coach to remove this photo.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
