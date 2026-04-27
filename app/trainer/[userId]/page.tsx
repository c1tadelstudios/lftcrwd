'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { BarChart2, Dumbbell, ImageIcon, X } from 'lucide-react';
import { NUTRITION } from '@/lib/plan';

const POLL_INTERVAL = 30_000;

type AppUser = { id: string; email: string; name: string };
type Session = { id: string; date: string; day_number: number; day_name: string; completed: boolean; user_id: string };
type CardioDetails = { time_min: number | null; incline: number | null; speed: number | null; intensity: number | null; calories: number | null };
type DailyLog = { date: string; protein_g: number; water_oz: number; creatine: boolean; cardio_done: boolean; cardio_type: string | null; cardio_details: CardioDetails | null; steps: number; weight_lbs: number | null; user_id: string; meal_1_done: boolean; meal_2_done: boolean; meal_3_done: boolean; meal_4_done: boolean; meal_5_done: boolean; custom_meals_done: Record<string, boolean> | null };
type Weight = { date: string; weight_lbs: number; user_id: string };
type ExerciseLog = { id: string; session_id: string; exercise_name: string; set_number: number; weight_lbs: number | null; reps: number | null; rest_seconds: number | null };
type ProgressPoint = { date: string; maxWeight: number };
type Message = { id: string; body: string; sender: string; created_at: string; user_id: string };

function localDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00');
}

function parseMealSections(markdown: string): { title: string }[] {
  return markdown
    .split('\n')
    .filter(line => /^#{1,2}\s/.test(line))
    .map(line => ({ title: line.replace(/^#{1,2}\s+/, '') }));
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

function cardioStats(type: string, d: CardioDetails): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (d.time_min  != null) out.push({ label: 'Time',      value: `${d.time_min} min` });
  if (type === 'Treadmill') {
    if (d.incline != null) out.push({ label: 'Incline',   value: `${d.incline}%` });
    if (d.speed   != null) out.push({ label: 'Speed',     value: `${d.speed} mph` });
  } else {
    if (d.intensity != null) out.push({ label: 'Intensity', value: String(d.intensity) });
  }
  if (d.calories != null) out.push({ label: 'Calories',   value: `${d.calories} kcal` });
  return out;
}

function ProgressChart({ data }: { data: ProgressPoint[] }) {
  if (data.length < 2) {
    return <p className="text-xs text-white/30 text-center py-6">Log at least 2 sessions to see the trend.</p>;
  }

  const W = 320, H = 130;
  const pad = { top: 8, right: 12, bottom: 28, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const weights = data.map(d => d.maxWeight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 10;

  const xOf = (i: number) => pad.left + (i / (data.length - 1)) * innerW;
  const yOf = (w: number) => pad.top + (1 - (w - minW) / range) * innerH;

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d.maxWeight).toFixed(1)}`)
    .join(' ');

  const yTicks = [minW, minW + range / 2, maxW].map(v => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yTicks.map((tick, i) => {
        const y = yOf(tick);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#3f3f46" strokeWidth="1" strokeDasharray="3,3" />
            <text x={pad.left - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#71717a">{tick}</text>
          </g>
        );
      })}
      <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.maxWeight)} r="3" fill="#f97316" />
      ))}
      {[0, data.length - 1].map(i => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#71717a">
          {localDate(data[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
}

function ComplianceHeatMap({ logs, mealPlan }: { logs: DailyLog[]; mealPlan: string | null }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const logMap: Record<string, DailyLog> = {};
  for (const log of logs) logMap[log.date] = log;

  // Build 12 weeks of dates starting from most recent Monday
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const WEEKS = 12;
  const startDate = new Date(thisMonday);
  startDate.setDate(thisMonday.getDate() - (WEEKS - 1) * 7);

  const cells: { date: string; score: number | null }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isFuture = d > today;
    if (isFuture) {
      cells.push({ date: dateStr, score: null });
    } else {
      const log = logMap[dateStr];
      if (!log) {
        cells.push({ date: dateStr, score: -1 });
      } else {
        let score = 0;
        if (log.protein_g >= 180) score++;
        if (log.cardio_done) score++;
        if (log.creatine) score++;
        const allMealsDone = mealPlan
          ? (log.custom_meals_done ? Object.values(log.custom_meals_done).length > 0 && Object.values(log.custom_meals_done).every(Boolean) : false)
          : (log.meal_1_done && log.meal_2_done && log.meal_3_done && log.meal_4_done && log.meal_5_done);
        if (allMealsDone) score++;
        cells.push({ date: dateStr, score });
      }
    }
  }

  function bgForScore(score: number | null): string {
    if (score === null) return 'bg-transparent';
    if (score === -1) return 'bg-white/6';
    return ['bg-white/10', 'bg-[#30d158]/30', 'bg-[#30d158]/55', 'bg-[#30d158]/75', 'bg-[#30d158]'][score];
  }

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const selectedLog = selectedDate ? logMap[selectedDate] : null;

  return (
    <div>
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-[10px] text-white/25 text-center">{d}</div>
        ))}
      </div>

      {/* Cell grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, score }) => (
          <button
            key={date}
            disabled={score === null || score === -1}
            onClick={() => setSelectedDate(date === selectedDate ? null : date)}
            className={`aspect-square rounded-[4px] transition-opacity active:opacity-70 ${bgForScore(score)} ${date === selectedDate ? 'ring-1 ring-white/50' : ''}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-[10px] text-white/25">Less</span>
        {[0, 1, 2, 3, 4].map(s => (
          <div key={s} className={`w-3 h-3 rounded-[2px] ${bgForScore(s)}`} />
        ))}
        <span className="text-[10px] text-white/25">More</span>
      </div>

      {/* Selected day detail */}
      {selectedLog && selectedDate && (
        <div className="mt-3 pt-3 border-t border-white/8">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">
            {localDate(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedLog.protein_g >= 180 ? 'bg-[#30d158]/20 text-[#30d158]' : 'bg-[#ff453a]/15 text-[#ff453a]'}`}>
              {selectedLog.protein_g}g protein
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedLog.water_oz >= 128 ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'bg-white/8 text-white/30'}`}>
              {selectedLog.water_oz}oz water
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedLog.creatine ? 'bg-[#bf5af2]/20 text-[#bf5af2]' : 'bg-white/8 text-white/20'}`}>
              creatine
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedLog.cardio_done ? 'bg-[#64d2ff]/20 text-[#64d2ff]' : 'bg-white/8 text-white/20'}`}>
              {selectedLog.cardio_done && selectedLog.cardio_type ? selectedLog.cardio_type.toLowerCase() : 'cardio'}
            </span>
            {selectedLog.steps > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/45 font-medium">
                {selectedLog.steps.toLocaleString()} steps
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientDetailPage() {
  const { userId } = useParams<{ userId: string }>();

  function sessionHypertrophyStatus(sets: ExerciseLog[]): 'achieved' | 'partial' | 'missed' | 'none' {
    if (sets.length === 0) return 'none';
    const setsWithRest = sets.filter(s => s.rest_seconds != null);
    // No timer data at all — can't evaluate
    if (setsWithRest.length === 0) return 'none';
    const hits = setsWithRest.filter(s => {
      if (s.reps == null || s.reps < 6 || s.reps > 12) return false;
      if ((s.rest_seconds as number) > 120) return false;
      return true;
    });
    if (hits.length === 0) return 'missed';
    // achieved = every set was timed AND every set hit
    if (setsWithRest.length === sets.length && hits.length === sets.length) return 'achieved';
    return 'partial';
  }

  const [users, setUsers] = useState<AppUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetail, setSessionDetail] = useState<Record<string, ExerciseLog[]>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const msgBottomRef = useRef<HTMLDivElement>(null);

  const [showCardioHistory, setShowCardioHistory] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState(false);

  const router = useRouter();
  const [archiving, setArchiving] = useState(false);

  // Coach reaction/note on session modal
  const [reactionNote, setReactionNote] = useState('');
  const [sendingReaction, setSendingReaction] = useState(false);
  const [reactionSent, setReactionSent] = useState(false);

  async function sendReaction() {
    if (!reactionNote.trim() || !userId) return;
    setSendingReaction(true);
    const res = await fetch('/api/trainer/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, body: reactionNote.trim() }),
    });
    setSendingReaction(false);
    if (res.ok) {
      setReactionSent(true);
      setReactionNote('');
    }
  }

  async function archiveClient() {
    if (!confirm(`Remove this client? They'll be hidden from your dashboard and won't be able to log in. Their data is kept and can be restored.`)) return;
    setArchiving(true);
    const res = await fetch(`/api/trainer/client?userId=${userId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/trainer');
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to remove client: ${data.error || res.status}`);
      setArchiving(false);
    }
  }

  // Tab state
  const [tab, setTab] = useState<'activity' | 'program' | 'photos'>('activity');

  // Weekly check-ins
  type Checkin = { id: string; week_start: string; weight_lbs: number | null; energy: number | null; sleep_hrs: number | null; stress: number | null; mood: number | null; recovery: number | null; notes: string | null };
  const [checkins, setCheckins] = useState<Checkin[]>([]);

  // Progress photos
  type Photo = { name: string; url: string; date: string };
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  async function deleteClientPhoto(photo: Photo) {
    setDeletingPhoto(true);
    const res = await fetch('/api/progress-photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, filename: photo.name }),
    });
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.name !== photo.name));
      setLightboxPhoto(null);
    }
    setDeletingPhoto(false);
  }

  // Meal plan editor state
  const [mealPlan, setMealPlan] = useState<string | null>(null);
  const [mealPlanLoading, setMealPlanLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Workout plan editor state
  const [workoutPlan, setWorkoutPlan] = useState<string | null>(null);
  const [workoutPlanLoading, setWorkoutPlanLoading] = useState(true);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutEditorTab, setWorkoutEditorTab] = useState<'edit' | 'preview'>('edit');
  const [workoutDraft, setWorkoutDraft] = useState('');
  const [savingWorkout, setSavingWorkout] = useState(false);

  // Meal calorie targets
  const [mealCalories, setMealCalories] = useState<Record<number, number>>({});

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/trainer/data');
    if (!res.ok) return;
    const data = await res.json();

    const userList = data.users || [];
    setUsers(userList);
    setSessions(data.sessions || []);
    setWeights(data.weights || []);
    setExerciseLogs(data.exerciseLogs || []);
    setRecentLogs(data.dailyLogs || []);
    setMessages(data.messages || []);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  const fetchMealPlan = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/trainer/meal-plan?userId=${userId}`);
    if (!res.ok) return;
    const data = await res.json();
    setMealPlan(data.content);
    setMealPlanLoading(false);
  }, [userId]);

  const fetchMealCalories = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/trainer/meal-calories?userId=${userId}`);
    if (!res.ok) return;
    const data = await res.json();
    setMealCalories(data.calories || {});
  }, [userId]);

  async function saveMealCalorie(mealIndex: number, calories: number) {
    setMealCalories(prev => ({ ...prev, [mealIndex]: calories }));
    await fetch('/api/trainer/meal-calories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, mealIndex, calories }),
    });
  }

  async function saveMealPlan() {
    setSaving(true);
    await fetch('/api/trainer/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, content: draft.trim() || null }),
    });
    await fetchMealPlan();
    setEditing(false);
    setSaving(false);
  }

  async function resetToDefault() {
    if (!confirm('Remove custom plan and revert to default for this client?')) return;
    await fetch('/api/trainer/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, content: null }),
    });
    await fetchMealPlan();
    setEditing(false);
  }

  const fetchWorkoutPlan = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/trainer/workout-plan?userId=${userId}`);
    if (!res.ok) return;
    const data = await res.json();
    setWorkoutPlan(data.content);
    setWorkoutPlanLoading(false);
  }, [userId]);

  async function saveWorkoutPlan() {
    setSavingWorkout(true);
    await fetch('/api/trainer/workout-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, content: workoutDraft.trim() || null }),
    });
    await fetchWorkoutPlan();
    setEditingWorkout(false);
    setSavingWorkout(false);
  }

  async function resetWorkoutToDefault() {
    if (!confirm('Remove custom workout plan and revert to default for this client?')) return;
    await fetch('/api/trainer/workout-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, content: null }),
    });
    await fetchWorkoutPlan();
    setEditingWorkout(false);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !userId) return;
    setSending(true);
    await fetch('/api/trainer/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, userId }),
    });
    setReply('');
    await fetchData();
    setSending(false);
  }

  function openSession(session: Session) {
    setSelectedSession(session);
    setReactionNote('');
    setReactionSent(false);
    const grouped: Record<string, ExerciseLog[]> = {};
    for (const log of exerciseLogs.filter(l => l.session_id === session.id)) {
      if (!grouped[log.exercise_name]) grouped[log.exercise_name] = [];
      grouped[log.exercise_name].push(log);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.set_number - b.set_number);
    }
    setSessionDetail(grouped);
  }

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    fetchMealPlan();
  }, [fetchMealPlan]);

  useEffect(() => {
    if (tab !== 'photos' || !userId) return;
    setPhotosLoading(true);
    fetch(`/api/progress-photos?userId=${userId}`)
      .then(r => r.json())
      .then(data => { setPhotos(data.photos || []); setPhotosLoading(false); })
      .catch(() => setPhotosLoading(false));
  }, [tab, userId]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/checkins?userId=${userId}`)
      .then(r => r.json())
      .then(data => setCheckins(data.checkins || []))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    fetchMealCalories();
  }, [fetchMealCalories]);

  useEffect(() => {
    fetchWorkoutPlan();
  }, [fetchWorkoutPlan]);

  useEffect(() => {
    if (msgBottomRef.current) {
      msgBottomRef.current.scrollTop = msgBottomRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter to this client
  const user = users.find(u => u.id === userId);
  const userSessions = sessions.filter(s => s.user_id === userId);
  const userLogs = recentLogs.filter(l => l.user_id === userId);
  const userWeights = weights.filter(w => w.user_id === userId).slice(0, 10);
  const userMessages = messages.filter(m => m.user_id === userId);

  const userSessionIds = new Set(userSessions.map(s => s.id));
  const userSessionMap: Record<string, string> = {};
  for (const s of userSessions) userSessionMap[s.id] = s.date;

  const userProgressData: Record<string, ProgressPoint[]> = {};
  const userGrouped: Record<string, Record<string, number>> = {};
  for (const log of exerciseLogs.filter(l => userSessionIds.has(l.session_id))) {
    const date = userSessionMap[log.session_id];
    if (!date || !log.weight_lbs) continue;
    if (!userGrouped[log.exercise_name]) userGrouped[log.exercise_name] = {};
    userGrouped[log.exercise_name][date] = Math.max(userGrouped[log.exercise_name][date] || 0, log.weight_lbs);
  }
  for (const [exercise, datemap] of Object.entries(userGrouped)) {
    userProgressData[exercise] = Object.entries(datemap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, maxWeight]) => ({ date, maxWeight }));
  }
  const exerciseOptions = Object.keys(userProgressData).sort();
  const chartExercise = selectedExercise && userProgressData[selectedExercise] ? selectedExercise : exerciseOptions[0] || '';
  const chartData = chartExercise ? userProgressData[chartExercise] : [];

  const weekStart = getMondayOfCurrentWeek();
  const thisWeekSessions = userSessions.filter(s => localDate(s.date) >= weekStart);
  const pastSessions = userSessions.filter(s => localDate(s.date) < weekStart).slice(0, 20);
  const latestWeight = userWeights[0];
  const cheatEarned = thisWeekSessions.length >= 5 && userLogs.slice(0, 7).every(l => l.protein_g >= 180);
  const todayLog = userLogs[0];

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-3 md:max-w-4xl">
        {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse h-24 bg-[#111111] rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 md:max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/trainer" className="md:hidden inline-flex items-center gap-1.5 text-[13px] text-white/45 hover:text-white transition-colors mb-3">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1L3 6l5 5"/></svg>
          All clients
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[13px] text-white/45 mb-0.5 md:hidden">Trainer View</p>
            <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.37px] text-white">{user?.name ?? 'Client'}</h1>
            {user?.email && <p className="text-[13px] text-white/35 mt-0.5">{user.email}</p>}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 bg-[#30d158] rounded-full" />
              <span className="text-[11px] text-white/35">Updates every 30s</span>
            </div>
            {lastUpdated && (
              <p className="text-[11px] text-white/25 mt-0.5">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-6 mb-6 md:grid md:grid-cols-3 md:gap-4">
        <div className="md:bg-[#111111] md:rounded-2xl md:px-5 md:py-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-0.5">This week</p>
          <p className="text-[34px] font-bold leading-none tabular-nums text-[#30d158]">{thisWeekSessions.length}</p>
          <p className="text-[11px] text-white/35 mt-0.5">workouts</p>
        </div>
        <div className="md:bg-[#111111] md:rounded-2xl md:px-5 md:py-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-0.5">Weight</p>
          <p className="text-[34px] font-bold leading-none tabular-nums text-white">{latestWeight?.weight_lbs ?? '—'}</p>
          <p className="text-[11px] text-white/35 mt-0.5">lbs</p>
        </div>
        <div className="md:bg-[#111111] md:rounded-2xl md:px-5 md:py-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-0.5">Cheat meal</p>
          <p className={`text-[34px] font-bold leading-none tabular-nums ${cheatEarned ? 'text-[#30d158]' : 'text-white/30'}`}>
            {cheatEarned ? '5' : thisWeekSessions.length}
          </p>
          <p className="text-[11px] text-white/35 mt-0.5">{cheatEarned ? 'earned' : '/ 5 to earn'}</p>
        </div>
      </div>

      {/* ── Mobile at-a-glance summary card ─── (hidden on desktop) ─────── */}
      {(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const workedOutToday = userSessions.some(s => s.date === todayStr);
        const todayDailyLog = userLogs.find(l => l.date === todayStr);
        const recentDates = [
          ...userSessions.map(s => s.date),
          ...userLogs.map(l => l.date),
        ].sort().reverse();
        const lastActiveDate = recentDates[0];
        const daysSinceActive = lastActiveDate
          ? Math.floor((Date.now() - new Date(lastActiveDate + 'T12:00:00').getTime()) / 86_400_000)
          : null;

        return (
          <div className="md:hidden bg-[#111111] rounded-2xl overflow-hidden mb-4">
            <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
              {/* Today */}
              <div className="p-4">
                <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">Today</p>
                <p className={`text-[13px] font-semibold mb-1 ${workedOutToday ? 'text-[#30d158]' : 'text-white/30'}`}>
                  {workedOutToday ? '✓ Workout done' : 'No workout'}
                </p>
                {todayDailyLog?.protein_g ? (
                  <p className="text-[13px] text-white/50">{todayDailyLog.protein_g}g protein</p>
                ) : (
                  <p className="text-[13px] text-white/25">No meals logged</p>
                )}
                {todayDailyLog?.cardio_done && (
                  <p className="text-[11px] text-[#30d158] mt-1">✓ Cardio</p>
                )}
              </div>
              {/* This week + last active */}
              <div className="p-4">
                <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">This week</p>
                <p className="text-[28px] font-bold leading-none tabular-nums text-white mb-1">
                  {thisWeekSessions.length}
                  <span className="text-[13px] text-white/35 font-normal ml-1">workouts</span>
                </p>
                {latestWeight && (
                  <p className="text-[13px] text-white/50">{latestWeight.weight_lbs} lbs</p>
                )}
                {daysSinceActive !== null && daysSinceActive >= 3 && (
                  <p className="text-[11px] text-[#ff9f0a] mt-1">
                    ⚠ {daysSinceActive}d since last activity
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Segmented Control — iOS style */}
      <div className="flex bg-[#1c1c1e] rounded-[12px] p-[3px] mb-6">
        <button
          onClick={() => setTab('activity')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-[15px] font-medium transition-all ${
            tab === 'activity'
              ? 'bg-[#3a3a3c] text-white shadow-sm'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <BarChart2 size={15} strokeWidth={2} />
          Activity
        </button>
        <button
          onClick={() => setTab('program')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-[15px] font-medium transition-all ${
            tab === 'program'
              ? 'bg-[#3a3a3c] text-white shadow-sm'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Dumbbell size={15} strokeWidth={2} />
          Program
        </button>
        <button
          onClick={() => setTab('photos')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[10px] text-[15px] font-medium transition-all ${
            tab === 'photos'
              ? 'bg-[#3a3a3c] text-white shadow-sm'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <ImageIcon size={15} strokeWidth={2} />
          Photos
        </button>
      </div>

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="md:grid md:grid-cols-3 md:gap-6 md:items-start">
        <div>

        {/* This week's sessions */}
        <div className="bg-[#111111] rounded-2xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">This week</h2>
            <span className="text-[11px] text-white/25">Resets Monday</span>
          </div>
          {thisWeekSessions.length === 0 ? (
            <p className="text-[15px] text-white/30 px-4 pb-4">No sessions this week yet.</p>
          ) : (
            <div className="divide-y divide-white/8">
              {thisWeekSessions.map(s => (
                <button key={s.id} onClick={() => openSession(s)}
                  className="w-full flex justify-between items-center h-[54px] px-4 hover:bg-white/5 active:bg-white/8 transition-colors"
                >
                  <span className="text-[17px] text-white">{s.day_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-white/35">
                      {localDate(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M1 1l5 5-5 5"/></svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Past sessions */}
        {pastSessions.length > 0 && (
          <div className="bg-[#111111] rounded-2xl overflow-hidden mb-4">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Past sessions</h2>
            </div>
            <div className="divide-y divide-white/8">
              {pastSessions.map(s => (
                <button key={s.id} onClick={() => openSession(s)}
                  className="w-full flex justify-between items-center h-[54px] px-4 hover:bg-white/5 active:bg-white/8 transition-colors"
                >
                  <span className="text-[17px] text-white">{s.day_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-white/35">
                      {localDate(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M1 1l5 5-5 5"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Check-ins */}
        {checkins.length > 0 && (
          <div className="bg-[#111111] rounded-2xl overflow-hidden mb-4">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Weekly check-ins</h2>
            </div>
            <div className="divide-y divide-white/8">
              {checkins.map(c => {
                const scoreColor = (n: number | null) =>
                  n == null ? 'text-white/25' :
                  n <= 2 ? 'text-[#ff453a]' :
                  n === 3 ? 'text-white/50' : 'text-[#30d158]';
                return (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[13px] font-semibold text-white">
                        Week of {new Date(c.week_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {c.weight_lbs && <span className="text-[12px] text-white/40">{c.weight_lbs} lbs</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1">
                      {c.energy   != null && <span className={`text-[12px] font-medium ${scoreColor(c.energy)}`}>Energy {c.energy}/5</span>}
                      {c.mood     != null && <span className={`text-[12px] font-medium ${scoreColor(c.mood)}`}>Mood {c.mood}/5</span>}
                      {c.stress   != null && <span className={`text-[12px] font-medium ${scoreColor(6 - c.stress)}`}>Stress {c.stress}/5</span>}
                      {c.recovery != null && <span className={`text-[12px] font-medium ${scoreColor(c.recovery)}`}>Recovery {c.recovery}/5</span>}
                      {c.sleep_hrs != null && <span className="text-[12px] text-white/35">{c.sleep_hrs}h sleep</span>}
                    </div>
                    {c.notes && <p className="text-[13px] text-white/55 italic">&ldquo;{c.notes}&rdquo;</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </div>
        <div>

        {/* Daily compliance */}
        <div className="bg-[#111111] rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Daily compliance</h2>
            {userLogs.length > 7 && (
              <button
                onClick={() => setShowHeatMap(true)}
                className="text-[13px] text-[#30d158] hover:text-[#ff9f0a] transition-colors"
              >
                View history
              </button>
            )}
          </div>
          {userLogs.length === 0 ? (
            <p className="text-[15px] text-white/30">No daily logs yet.</p>
          ) : (
            <div className="space-y-3">
              {userLogs.slice(0, 7).map(log => (
                <div key={log.date}>
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">
                    {localDate(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${log.protein_g >= 180 ? 'bg-[#30d158]/20 text-[#30d158]' : 'bg-[#ff453a]/15 text-[#ff453a]'}`}>
                      {log.protein_g}g protein
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${log.water_oz >= 128 ? 'bg-[#0a84ff]/20 text-[#0a84ff]' : 'bg-white/8 text-white/30'}`}>
                      {log.water_oz}oz water
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${log.creatine ? 'bg-[#bf5af2]/20 text-[#bf5af2]' : 'bg-white/8 text-white/20'}`}>
                      creatine
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${log.cardio_done ? 'bg-[#64d2ff]/20 text-[#64d2ff]' : 'bg-white/8 text-white/20'}`}>
                      {log.cardio_done && log.cardio_type ? log.cardio_type.toLowerCase() : 'cardio'}
                    </span>
                    {log.steps > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/45 font-medium">
                        {log.steps.toLocaleString()} steps
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Cardio ─────────────────────────────────────────────────── */}
        {(() => {
          const cardioDays = userLogs.filter(l => l.cardio_done);
          if (cardioDays.length === 0) return null;

          const todayCardio = userLogs[0]?.cardio_done ? userLogs[0] : null;
          const historyDays = cardioDays.filter(l => l !== userLogs[0]);

          return (
            <div className="bg-[#111111] rounded-2xl overflow-hidden mb-4">
              <div className="px-4 pt-4 pb-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-3">Cardio</h2>

                {todayCardio ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[15px] font-semibold text-white">{todayCardio.cardio_type ?? 'Done'}</span>
                      <span className="text-[11px] text-white/35">
                        {localDate(todayCardio.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {todayCardio.cardio_type && todayCardio.cardio_details ? (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {cardioStats(todayCardio.cardio_type, todayCardio.cardio_details).map(({ label, value }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-[13px] text-white/35">{label}</span>
                            <span className="text-[13px] text-white tabular-nums">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-white/35">No details logged.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-white/35">No cardio today.</p>
                )}
              </div>

              {historyDays.length > 0 && (
                <>
                  <div className="h-px bg-white/8" />
                  <button
                    onClick={() => setShowCardioHistory(v => !v)}
                    className="w-full flex items-center justify-between px-4 h-[44px] text-[13px] text-white/45 hover:text-white/70 transition-colors"
                  >
                    <span>History ({historyDays.length} sessions)</span>
                    <span>{showCardioHistory ? '↑' : '↓'}</span>
                  </button>

                  {showCardioHistory && (
                    <div className="divide-y divide-white/8">
                      {historyDays.map(log => (
                        <div key={log.date} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[15px] font-medium text-white">{log.cardio_type ?? 'Cardio'}</span>
                            <span className="text-[11px] text-white/35">
                              {localDate(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {log.cardio_type && log.cardio_details ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {cardioStats(log.cardio_type, log.cardio_details).map(({ label, value }) => (
                                <div key={label} className="flex justify-between">
                                  <span className="text-[13px] text-white/35">{label}</span>
                                  <span className="text-[13px] text-white/70 tabular-nums">{value}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[13px] text-white/25">No details logged.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Meal compliance — today */}
        {todayLog && (
          <div className="bg-[#111111] rounded-2xl p-4 mb-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-3">
              Today&apos;s meals — {localDate(todayLog.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </h2>
            <div className="space-y-2">
              {mealPlan ? (
                parseMealSections(mealPlan).length > 0 ? (
                  parseMealSections(mealPlan).map((section, i) => {
                    const done = !!(todayLog.custom_meals_done?.[String(i)]);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-[#30d158]' : 'bg-white/15'}`} />
                        <span className={`text-[15px] ${done ? 'text-white/40 line-through' : 'text-white/70'}`}>{section.title}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/30">Custom plan has no meal sections.</p>
                )
              ) : (
                NUTRITION.meals.map((meal, i) => {
                  const field = `meal_${i + 1}_done` as keyof DailyLog;
                  const done = todayLog[field] as boolean;
                  return (
                    <div key={meal.name} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-[#30d158]' : 'bg-white/15'}`} />
                      <span className={`text-[15px] ${done ? 'text-white/40 line-through' : 'text-white/70'}`}>{meal.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        </div>
        <div className="min-w-0">

        {/* Weight history */}
        {userWeights.length > 0 && (
          <div className="bg-[#111111] rounded-2xl overflow-hidden mb-4">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Weight history</h2>
            </div>
            <div className="divide-y divide-white/8">
              {userWeights.map(w => (
                <div key={w.date} className="flex justify-between items-center h-[44px] px-4">
                  <span className="text-[15px] text-white/45">
                    {localDate(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[15px] font-semibold text-white tabular-nums">{w.weight_lbs} lbs</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progressive overload */}
        {exerciseOptions.length > 0 && (
          <div className="bg-[#111111] rounded-2xl p-4 mb-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-3">Progressive overload</h2>
            <select
              value={selectedExercise || chartExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:ring-1 focus:ring-[#30d158]/60"
            >
              {exerciseOptions.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            <ProgressChart data={chartData} />
            {chartData.length >= 2 && (
              <div className="flex justify-between text-xs text-white/30 mt-2 px-1">
                <span>Start: {chartData[0].maxWeight} lbs</span>
                <span className={(chartData.at(-1)?.maxWeight ?? 0) >= chartData[0].maxWeight ? 'text-green-400' : 'text-red-400'}>
                  {((chartData.at(-1)?.maxWeight ?? 0) - chartData[0].maxWeight >= 0 ? '+' : '')}
                  {((chartData.at(-1)?.maxWeight ?? 0) - chartData[0].maxWeight).toFixed(1)} lbs
                </span>
                <span>Latest: {chartData.at(-1)?.maxWeight} lbs</span>
              </div>
            )}
          </div>
        )}

        </div>
        </div>
      )}

      {/* Program Tab */}
      {tab === 'program' && (
        <>
        <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        <div>

        {/* Meal Plan */}
        <div className="bg-[#111111] rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Meal Plan</h2>
              {!mealPlanLoading && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${mealPlan ? 'bg-orange-900/50 text-orange-400' : 'bg-white/10 text-white/30'}`}>
                  {mealPlan ? 'custom' : 'default'}
                </span>
              )}
            </div>
            {!editing && (
              <div className="flex gap-2">
                {mealPlan && (
                  <button
                    onClick={resetToDefault}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors"
                  >
                    Reset to default
                  </button>
                )}
                <button
                  onClick={() => { setDraft(mealPlan ?? ''); setEditorTab('edit'); setEditing(true); }}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  {mealPlan ? 'Edit plan' : 'Create custom plan'}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div>
              {/* Tab bar */}
              <div className="flex gap-1 mb-3 bg-black/60 rounded-lg p-1">
                <button
                  onClick={() => setEditorTab('edit')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${editorTab === 'edit' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/70'}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setEditorTab('preview')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${editorTab === 'preview' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/70'}`}
                >
                  Preview
                </button>
              </div>

              {editorTab === 'edit' ? (
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={14}
                  placeholder={`## Meal 1 - Breakfast\n- 6 egg whites\n- 1 cup oatmeal\n\n## Meal 2 - Mid Morning\n- Protein shake (40g)\n- 1 apple`}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-[15px] font-mono outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/20 resize-none"
                />
              ) : (
                <div className="bg-black/60 border border-white/10 rounded-xl px-4 py-3 min-h-32 prose-meal">
                  {draft.trim() ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-bold text-white mb-2 mt-4 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1.5 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold text-white/80 mb-1 mt-2">{children}</h3>,
                        p: ({ children }) => <p className="text-sm text-white/70 mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
                        li: ({ children }) => <li className="text-sm text-white/70 flex gap-2"><span className="text-white/20 mt-0.5 flex-shrink-0">·</span><span>{children}</span></li>,
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        hr: () => <hr className="border-white/10 my-3" />,
                      }}
                    >
                      {draft}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-white/20 text-sm">Nothing to preview yet.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={saveMealPlan}
                  disabled={saving}
                  className="flex-1 h-11 bg-[#30d158] active:opacity-75 disabled:opacity-40 text-white rounded-[14px] text-[15px] font-semibold transition-opacity"
                >
                  {saving ? 'Saving...' : 'Save plan'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="h-11 px-5 bg-white/8 hover:bg-white/12 rounded-[14px] text-[15px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {mealPlanLoading ? (
                <div className="animate-pulse h-16 bg-white/10 rounded-xl" />
              ) : mealPlan ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-base font-bold text-white mb-2 mt-4 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1.5 mt-3 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-white/80 mb-1 mt-2">{children}</h3>,
                    p: ({ children }) => <p className="text-sm text-white/70 mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
                    li: ({ children }) => <li className="text-sm text-white/70 flex gap-2"><span className="text-white/20 mt-0.5 flex-shrink-0">·</span><span>{children}</span></li>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    hr: () => <hr className="border-white/10 my-3" />,
                  }}
                >
                  {mealPlan}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-white/30">Using the default plan. Create a custom plan to override.</p>
              )}
            </div>
          )}
        </div>

        {/* Meal Calories */}
        {!editing && (
          <div className="bg-[#111111] rounded-2xl overflow-hidden mb-6">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Meal Calories</h2>
            </div>
            <div className="divide-y divide-white/8">
              {(mealPlan ? parseMealSections(mealPlan) : NUTRITION.meals.map(m => ({ title: m.name }))).map((meal, i) => {
                const cal = mealCalories[i] ?? 350;
                return (
                  <div key={i} className="flex items-center h-[50px] px-4 gap-3">
                    <span className="text-[15px] text-white flex-1 truncate">{meal.title}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="number"
                        value={cal}
                        onChange={e => saveMealCalorie(i, parseInt(e.target.value) || 0)}
                        className="w-20 bg-white/8 rounded-xl px-3 h-9 text-[15px] text-right text-white outline-none focus:ring-1 focus:ring-[#30d158]/60"
                      />
                      <span className="text-[13px] text-white/30 w-8">kcal</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center px-4 py-3 border-t border-white/8">
              <span className="text-[13px] text-white/35">Total goal</span>
              <span className="text-[15px] font-semibold text-[#30d158]">
                {Object.values(
                  (mealPlan ? parseMealSections(mealPlan) : NUTRITION.meals).reduce((acc, _, i) => {
                    acc[i] = mealCalories[i] ?? 350;
                    return acc;
                  }, {} as Record<number, number>)
                ).reduce((a, b) => a + b, 0).toLocaleString()} kcal
              </span>
            </div>
          </div>
        )}

        </div>
        <div className="min-w-0">

        {/* Workout Plan */}
        <div className="bg-[#111111] rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Workout Plan</h2>
              {!workoutPlanLoading && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${workoutPlan ? 'bg-orange-900/50 text-orange-400' : 'bg-white/10 text-white/30'}`}>
                  {workoutPlan ? 'custom' : 'default'}
                </span>
              )}
            </div>
            {!editingWorkout && (
              <div className="flex gap-2">
                {workoutPlan && (
                  <button
                    onClick={resetWorkoutToDefault}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors"
                  >
                    Reset to default
                  </button>
                )}
                <button
                  onClick={() => { setWorkoutDraft(workoutPlan ?? ''); setWorkoutEditorTab('edit'); setEditingWorkout(true); }}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  {workoutPlan ? 'Edit plan' : 'Create custom plan'}
                </button>
              </div>
            )}
          </div>

          {editingWorkout ? (
            <div>
              <div className="flex gap-1 mb-3 bg-black/60 rounded-lg p-1">
                <button
                  onClick={() => setWorkoutEditorTab('edit')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${workoutEditorTab === 'edit' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/70'}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setWorkoutEditorTab('preview')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${workoutEditorTab === 'preview' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/70'}`}
                >
                  Preview
                </button>
              </div>

              {workoutEditorTab === 'edit' ? (
                <textarea
                  value={workoutDraft}
                  onChange={e => setWorkoutDraft(e.target.value)}
                  rows={14}
                  placeholder={`## Day 1 - Push\n- Bench Press: 4x8 @ RPE 8\n- Shoulder Press: 3x10\n- Tricep Pushdown: 3x12\n\n## Day 2 - Pull\n- Deadlift: 3x5\n- Barbell Row: 4x8`}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-[15px] font-mono outline-none focus:ring-1 focus:ring-[#30d158]/60 placeholder:text-white/20 resize-none"
                />
              ) : (
                <div className="bg-black/60 border border-white/10 rounded-xl px-4 py-3 min-h-32">
                  {workoutDraft.trim() ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-bold text-white mb-2 mt-4 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1.5 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold text-white/80 mb-1 mt-2">{children}</h3>,
                        p: ({ children }) => <p className="text-sm text-white/70 mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
                        li: ({ children }) => <li className="text-sm text-white/70 flex gap-2"><span className="text-white/20 mt-0.5 flex-shrink-0">·</span><span>{children}</span></li>,
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        hr: () => <hr className="border-white/10 my-3" />,
                      }}
                    >
                      {workoutDraft}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-white/20 text-sm">Nothing to preview yet.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={saveWorkoutPlan}
                  disabled={savingWorkout}
                  className="flex-1 h-11 bg-[#30d158] active:opacity-75 disabled:opacity-40 text-white rounded-[14px] text-[15px] font-semibold transition-opacity"
                >
                  {savingWorkout ? 'Saving...' : 'Save plan'}
                </button>
                <button
                  onClick={() => setEditingWorkout(false)}
                  className="h-11 px-5 bg-white/8 hover:bg-white/12 rounded-[14px] text-[15px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {workoutPlanLoading ? (
                <div className="animate-pulse h-16 bg-white/10 rounded-xl" />
              ) : workoutPlan ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-base font-bold text-white mb-2 mt-4 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1.5 mt-3 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-white/80 mb-1 mt-2">{children}</h3>,
                    p: ({ children }) => <p className="text-sm text-white/70 mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
                    li: ({ children }) => <li className="text-sm text-white/70 flex gap-2"><span className="text-white/20 mt-0.5 flex-shrink-0">·</span><span>{children}</span></li>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    hr: () => <hr className="border-white/10 my-3" />,
                  }}
                >
                  {workoutPlan}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-white/30">Using the default plan. Create a custom plan to override.</p>
              )}
            </div>
          )}
        </div>

        </div>
        </div>

        {/* Messages — full width below the plans */}
        <div className="bg-[#111111] rounded-2xl overflow-hidden mb-4 mt-6">
          <div className="px-4 py-3.5 border-b border-white/8">
            <h2 className="text-[17px] font-semibold text-white">Chat</h2>
            <p className="text-[13px] text-white/45 mt-0.5">Messages with {user?.name ?? 'client'}</p>
          </div>
          <div ref={msgBottomRef} className="p-4 space-y-3 max-h-64 md:max-h-72 overflow-y-auto">
            {userMessages.length === 0 ? (
              <p className="text-[15px] text-white/45 text-center py-4">No messages yet.</p>
            ) : (
              userMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'trainer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] md:max-w-[55%] rounded-2xl px-3.5 py-2.5 ${
                    msg.sender === 'trainer'
                      ? 'bg-[#0a84ff] text-white rounded-br-sm'
                      : 'bg-white/10 text-white rounded-bl-sm'
                  }`}>
                    <p className="text-[15px]">{msg.body}</p>
                    <p className={`text-[11px] mt-1 ${msg.sender === 'trainer' ? 'text-white/60' : 'text-white/35'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={sendReply} className="p-3 border-t border-white/8 flex gap-2">
            <input
              type="text"
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder={`Reply to ${user?.name ?? 'client'}...`}
              className="flex-1 bg-white/8 rounded-2xl px-4 h-11 text-[15px] outline-none focus:ring-1 focus:ring-[#0a84ff]/60 placeholder:text-white/25"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="flex-shrink-0 w-11 h-11 bg-[#0a84ff] disabled:bg-white/8 disabled:text-white/25 text-white rounded-full flex items-center justify-center transition-all active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
            </button>
          </form>
        </div>
        </>
      )}

      {/* Photos Tab */}
      {tab === 'photos' && (
        <div className="px-4 pb-6 md:px-8">
          {photosLoading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-[#111111] animate-pulse" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="bg-[#111111] rounded-2xl p-10 text-center">
              <ImageIcon size={28} className="text-white/20 mx-auto mb-3" />
              <p className="text-[15px] text-white/35">No photos yet.</p>
              <p className="text-[13px] text-white/25 mt-1">Client uploads from the Progress tab.</p>
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
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/92 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white"
            onClick={() => setLightboxPhoto(null)}
          >
            <X size={22} />
          </button>
          <div onClick={e => e.stopPropagation()} className="max-w-sm w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxPhoto.url} alt={lightboxPhoto.date} className="w-full rounded-2xl" />
            <p className="text-center text-white/45 text-[14px] mt-3">
              {new Date(lightboxPhoto.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <button
              onClick={() => deleteClientPhoto(lightboxPhoto)}
              disabled={deletingPhoto}
              className="mt-4 w-full h-11 rounded-[14px] border border-[#ff453a]/40 text-[#ff453a] text-[15px] font-medium active:opacity-75 disabled:opacity-40 transition-opacity"
            >
              {deletingPhoto ? 'Deleting…' : 'Delete photo'}
            </button>
          </div>
        </div>
      )}

      {/* Heat map modal */}
      {showHeatMap && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75" onClick={() => setShowHeatMap(false)}>
          <div className="bg-[#111111] rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#111111] border-b border-white/8 px-5 py-4 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-[17px] font-semibold text-white">Compliance history</h3>
              <button onClick={() => setShowHeatMap(false)} className="w-8 h-8 flex items-center justify-center text-white/35 hover:text-white text-lg">✕</button>
            </div>
            <div className="px-5 py-4">
              <ComplianceHeatMap logs={userLogs} mealPlan={mealPlan} />
            </div>
          </div>
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-4" onClick={() => setSelectedSession(null)}>
          <div className="bg-[#111111] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#111111] border-b border-white/8 px-5 py-4 flex justify-between items-start rounded-t-2xl">
              <div>
                <p className="text-[13px] text-white/35">
                  {localDate(selectedSession.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <h3 className="text-[22px] font-bold text-white mt-0.5">{selectedSession.day_name}</h3>
              </div>
              <button onClick={() => setSelectedSession(null)} className="w-8 h-8 flex items-center justify-center text-white/35 hover:text-white text-lg mt-1">✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {Object.keys(sessionDetail).length === 0 ? (
                <p className="text-[15px] text-white/35 text-center py-4">No exercise data logged for this session.</p>
              ) : (
                Object.entries(sessionDetail).map(([exercise, sets]) => (
                  <div key={exercise}>
                    {(() => {
                      const status = sessionHypertrophyStatus(sets);
                      const label =
                        status === 'achieved' ? 'Hypertrophy' :
                        status === 'partial'  ? 'Partial' :
                        status === 'missed'   ? 'No hypertrophy' :
                                               'No data';
                      return (
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[15px] font-semibold text-white">{exercise}</h4>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            status === 'achieved' ? 'bg-[#30d158]/15 text-[#30d158]' :
                            status === 'partial'  ? 'bg-[#30d158]/15 text-[#30d158]' :
                            status === 'missed'   ? 'bg-[#ff453a]/10 text-[#ff453a]' :
                                                    'bg-white/8 text-white/30'
                          }`}>{label}</span>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-4 text-[11px] text-white/35 mb-1 px-1 uppercase tracking-wider">
                      <span>Set</span>
                      <span className="text-center">Weight</span>
                      <span className="text-center">Reps</span>
                      <span className="text-center">Rest</span>
                    </div>
                    {sets.map(s => {
                      const restMin = s.rest_seconds != null ? Math.floor(s.rest_seconds / 60) : null;
                      const restSec = s.rest_seconds != null ? s.rest_seconds % 60 : null;
                      const restLabel = restMin != null && restSec != null
                        ? `${restMin}:${restSec.toString().padStart(2, '0')}`
                        : '—';
                      return (
                        <div key={s.set_number} className="grid grid-cols-4 text-[15px] bg-white/6 rounded-xl px-3 py-2 mb-1">
                          <span className="text-white/35">{s.set_number}</span>
                          <span className="text-center text-white">{s.weight_lbs != null ? `${s.weight_lbs} lbs` : '—'}</span>
                          <span className="text-center text-white">{s.reps != null ? s.reps : '—'}</span>
                          <span className={`text-center tabular-nums ${s.rest_seconds != null ? (s.rest_seconds <= 120 ? 'text-[#30d158]' : s.rest_seconds <= 180 ? 'text-[#30d158]' : 'text-[#ff453a]') : 'text-white/25'}`}>
                            {restLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}

              {/* Coach note */}
              <div className="border-t border-white/8 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-3">Send a note</p>
                <div className="flex gap-2 mb-3">
                  {[
                    { emoji: '👍', text: `👍 Good work on ${selectedSession?.day_name}!` },
                    { emoji: '🔥', text: `🔥 Crushed it on ${selectedSession?.day_name}!` },
                    { emoji: '💪', text: `💪 Strong session — ${selectedSession?.day_name} done.` },
                    { emoji: '✅', text: `✅ Great consistency — ${selectedSession?.day_name} locked in.` },
                  ].map(({ emoji, text }) => (
                    <button
                      key={emoji}
                      onClick={() => setReactionNote(text)}
                      className="w-11 h-11 rounded-xl bg-white/8 text-xl flex items-center justify-center active:opacity-60 hover:bg-white/12 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {reactionSent ? (
                  <p className="text-[13px] text-[#30d158] py-1">✓ Note sent to {user?.name ?? 'client'}</p>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={reactionNote}
                      onChange={e => setReactionNote(e.target.value)}
                      placeholder="Add a note for this session…"
                      rows={2}
                      className="w-full bg-white/8 rounded-xl px-3 py-2 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#30d158]/50 placeholder:text-white/20 resize-none"
                    />
                    <button
                      disabled={sendingReaction || !reactionNote.trim()}
                      onClick={sendReaction}
                      className="h-9 px-4 bg-[#30d158]/15 text-[#30d158] rounded-xl text-[14px] font-medium disabled:opacity-40 active:opacity-70 transition-opacity"
                    >
                      {sendingReaction ? 'Sending…' : 'Send note'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <div className="px-4 pb-10 md:px-8 md:pb-12">
        <div className="border border-white/8 rounded-2xl p-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/30 mb-1">Danger zone</p>
          <p className="text-[15px] text-white/45 mb-4">Remove this client from your dashboard. Their data is kept and can be restored later.</p>
          <button
            onClick={archiveClient}
            disabled={archiving}
            className="h-[44px] px-5 rounded-[12px] border border-[#ff453a]/40 text-[#ff453a] text-[15px] font-medium active:opacity-75 disabled:opacity-40 transition-opacity"
          >
            {archiving ? 'Removing…' : 'Remove client'}
          </button>
        </div>
      </div>

    </div>
  );
}
