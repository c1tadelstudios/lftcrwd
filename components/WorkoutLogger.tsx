'use client';

import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { supabase, getLastSession, type WorkoutSession, type ExerciseLog } from '@/lib/supabase';
import { type WorkoutDay } from '@/lib/plan';
import { today } from '@/lib/supabase';

type SetEntry = { weight: string; reps: string; saved: boolean; restSeconds?: number; prefilled?: boolean };

export default function WorkoutLogger({ day }: { day: WorkoutDay }) {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [lastSets, setLastSets] = useState<Record<string, ExerciseLog[]>>({});
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({});
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Rest timer state ────────────────────────────────────────────────────────
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerSetKey, setTimerSetKey] = useState<string | null>(null);
  const [timerSetId, setTimerSetId] = useState<string | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number>(0);
  const timerBaseRef = useRef<number>(0);
  const timerRunningRef = useRef<boolean>(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function load() {
      const { data: existing } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('date', today())
        .eq('day_number', day.day)
        .maybeSingle();

      let sess = existing;
      if (!sess) {
        const { data: created, error: createError } = await supabase
          .from('workout_sessions')
          .insert({ date: today(), day_number: day.day, day_name: day.name })
          .select()
          .single();
        if (createError) alert('Could not create session: ' + createError.message);
        sess = created;
      }

      setSession(sess);
      setCompleted(sess?.completed || false);

      const prev = await getLastSession(day.day);
      if (prev && prev.id !== sess?.id) {
        setLastSession(prev);
        const { data: logs } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('session_id', prev.id)
          .order('set_number');

        const prevByExercise: Record<string, ExerciseLog[]> = {};
        for (const log of logs || []) {
          if (!prevByExercise[log.exercise_name]) prevByExercise[log.exercise_name] = [];
          prevByExercise[log.exercise_name].push(log);
        }
        setLastSets(prevByExercise);

        if (sess) {
          const { data: todaySets } = await supabase
            .from('exercise_logs')
            .select('*')
            .eq('session_id', sess.id)
            .order('set_number')
            .order('created_at', { ascending: true });

          const setMap: Record<string, Record<number, SetEntry>> = {};
          for (const log of todaySets || []) {
            if (!setMap[log.exercise_name]) setMap[log.exercise_name] = {};
            setMap[log.exercise_name][log.set_number] = {
              weight: log.weight_lbs?.toString() || '',
              reps: log.reps?.toString() || '',
              saved: true,
              restSeconds: log.rest_seconds ?? undefined,
            };
          }

          const allEx = [...day.exercises, ...(day.core || [])];
          const byExercise: Record<string, SetEntry[]> = {};
          for (const exercise of allEx) {
            const map = setMap[exercise.name] || {};
            byExercise[exercise.name] = Array.from({ length: exercise.sets }, (_, i) => {
              if (map[i + 1]) return map[i + 1];
              const lastLog = prevByExercise[exercise.name]?.[i];
              const lastWeight = lastLog?.weight_lbs?.toString() ?? '15';
              return { weight: lastWeight, reps: '8', saved: false, prefilled: true };
            });
          }
          setSets(byExercise);
        }
      }

      if (sess && (!prev || prev.id === sess.id)) {
        const { data: todaySets } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('session_id', sess.id)
          .order('set_number')
          .order('created_at', { ascending: true });

        const setMap: Record<string, Record<number, SetEntry>> = {};
        for (const log of todaySets || []) {
          if (!setMap[log.exercise_name]) setMap[log.exercise_name] = {};
          setMap[log.exercise_name][log.set_number] = {
            weight: log.weight_lbs?.toString() || '',
            reps: log.reps?.toString() || '',
            saved: true,
            restSeconds: log.rest_seconds ?? undefined,
          };
        }

        const allEx = [...day.exercises, ...(day.core || [])];
        const byExercise: Record<string, SetEntry[]> = {};
        for (const exercise of allEx) {
          const map = setMap[exercise.name] || {};
          byExercise[exercise.name] = Array.from({ length: exercise.sets }, (_, i) =>
            map[i + 1] || { weight: '15', reps: '8', saved: false, prefilled: true }
          );
        }
        setSets(byExercise);
      }

      setLoading(false);
    }

    load();
  }, [day]);

  function updateSet(exerciseName: string, index: number, field: 'weight' | 'reps', value: string) {
    const currentSet = sets[exerciseName]?.[index] ?? { weight: '', reps: '8', saved: false };
    const merged = { ...currentSet, [field]: value, prefilled: false };
    const key = `${exerciseName}:${index}`;

    const weightVal = parseFloat(merged.weight);
    const repsVal = parseInt(merged.reps);
    const isValid = merged.weight && merged.reps && weightVal > 0 && repsVal > 0;

    setSets((prev) => {
      const updated = [...(prev[exerciseName] || [])];
      updated[index] = { ...updated[index], [field]: value, saved: false, prefilled: false };
      return { ...prev, [exerciseName]: updated };
    });

    clearTimeout(autoSaveTimers.current[key]);

    if (isValid) {
      autoSaveTimers.current[key] = setTimeout(() => {
        saveSet(exerciseName, index, merged.weight, merged.reps);
      }, 400);
    }
  }

  async function saveSet(exerciseName: string, index: number, overrideWeight?: string, overrideReps?: string) {
    if (!session) { alert('No session loaded — try refreshing.'); return; }
    const set = sets[exerciseName]?.[index];
    if (!set && !overrideWeight) return;

    const weightStr = overrideWeight ?? set?.weight ?? '';
    const repsStr   = overrideReps   ?? set?.reps   ?? '';

    const weight_lbs = weightStr !== '' ? parseFloat(weightStr) : null;
    const reps = repsStr !== '' ? parseInt(repsStr) : null;

    if (!weight_lbs || weight_lbs <= 0 || !reps || reps <= 0) return;

    const { data: updated, error: updateError } = await supabase
      .from('exercise_logs')
      .update({ weight_lbs, reps })
      .eq('session_id', session.id)
      .eq('exercise_name', exerciseName)
      .eq('set_number', index + 1)
      .select('id');

    if (updateError) {
      alert(`Save failed for ${exerciseName} set ${index + 1}: ${updateError.message}`);
      return;
    }

    let savedId: string | null = updated?.[0]?.id ?? null;

    if (!updated || updated.length === 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('exercise_logs')
        .insert({
          session_id: session.id,
          exercise_name: exerciseName,
          set_number: index + 1,
          weight_lbs,
          reps,
        })
        .select('id')
        .single();
      if (insertError) {
        alert(`Save failed for ${exerciseName} set ${index + 1}: ${insertError.message}`);
        return;
      }
      savedId = inserted?.id ?? null;
    }

    setSets((prev) => {
      const updated = [...prev[exerciseName]];
      updated[index] = { ...updated[index], saved: true };
      return { ...prev, [exerciseName]: updated };
    });

    // Start rest timer after a successful auto-save (only if timer is enabled)
    if (savedId && timerEnabled) {
      startTimer(`${exerciseName}:${index}`, savedId);
    }
  }

  // ── Rest timer helpers ──────────────────────────────────────────────────────
  const TARGET_REST_SECONDS = 120;

  function startTimer(setKey: string, setId: string) {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimerSetKey(setKey);
    setTimerSetId(setId);
    setTimerElapsed(0);
    timerBaseRef.current = 0;
    timerStartRef.current = Date.now();
    timerRunningRef.current = true;
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerElapsed(timerBaseRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000));
    }, 500);
  }

  function pauseTimer() {
    if (!timerRunningRef.current) {
      // Resume
      timerStartRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setTimerElapsed(timerBaseRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000));
      }, 500);
      timerRunningRef.current = true;
      setTimerRunning(true);
    } else {
      // Pause
      timerBaseRef.current = timerBaseRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerRunningRef.current = false;
      setTimerRunning(false);
    }
  }

  async function stopTimer() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    // Capture elapsed BEFORE clearing the running ref
    const elapsed = timerBaseRef.current + (timerRunningRef.current ? Math.floor((Date.now() - timerStartRef.current) / 1000) : 0);
    timerRunningRef.current = false;
    setTimerRunning(false);
    if (timerSetId) {
      await supabase
        .from('exercise_logs')
        .update({ rest_seconds: elapsed })
        .eq('id', timerSetId);
    }
    // Update local state so the rest time shows immediately
    if (timerSetKey) {
      const colonIdx = timerSetKey.lastIndexOf(':');
      const exerciseName = timerSetKey.slice(0, colonIdx);
      const index = parseInt(timerSetKey.slice(colonIdx + 1));
      if (exerciseName && !isNaN(index)) {
        setSets(prev => {
          const updated = [...(prev[exerciseName] ?? [])];
          updated[index] = { ...updated[index], restSeconds: elapsed };
          return { ...prev, [exerciseName]: updated };
        });
      }
    }
    setTimerSetKey(null);
    setTimerSetId(null);
    setTimerElapsed(0);
    timerBaseRef.current = 0;
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      wakeLockRef.current?.release();
    };
  }, []);

  // Wake lock — keep screen on while rest timer is running
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    async function acquireWakeLock() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // User denied or device doesn't support it — silent fail
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && timerRunning) {
        acquireWakeLock();
      }
    }

    if (timerRunning) {
      acquireWakeLock();
      document.addEventListener('visibilitychange', onVisibilityChange);
    } else {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [timerRunning]);

  async function markComplete() {
    if (!session) return;

    // Save any unsaved sets that have valid data before marking complete
    const allEx = [...day.exercises, ...(day.core || [])];
    const pending: Promise<void>[] = [];
    for (const exercise of allEx) {
      const exerciseSets = sets[exercise.name] || [];
      for (let i = 0; i < exerciseSets.length; i++) {
        const set = exerciseSets[i];
        if (!set.saved && parseFloat(set.weight) > 0 && parseInt(set.reps) > 0) {
          pending.push(saveSet(exercise.name, i));
        }
      }
    }
    await Promise.all(pending);

    await supabase.from('workout_sessions').update({ completed: true }).eq('id', session.id);
    setCompleted(true);
  }

  async function markIncomplete() {
    if (!session) return;
    await supabase.from('workout_sessions').update({ completed: false }).eq('id', session.id);
    setCompleted(false);
  }

  type HypertrophyStatus = 'achieved' | 'partial' | 'missed' | 'incomplete';

  function getHypertrophyStatus(exerciseName: string, repsMin: number, repsMax: number, totalSets: number): HypertrophyStatus {
    const exerciseSets = sets[exerciseName] || [];
    const saved = exerciseSets.filter(s => s.saved);
    if (saved.length === 0) return 'incomplete';

    const hits = saved.filter(s => {
      const reps = parseInt(s.reps);
      if (isNaN(reps) || reps < repsMin || reps > repsMax) return false;
      if (s.restSeconds != null && s.restSeconds > TARGET_REST_SECONDS) return false;
      return true;
    });

    if (hits.length === 0) return 'missed';
    if (hits.length === saved.length && saved.length === totalSets) return 'achieved';
    return 'partial';
  }

  function completedSets(exerciseName: string): number {
    return (sets[exerciseName] || []).filter(s => s.saved).length;
  }

  function totalVolume(exerciseName: string): number {
    return (sets[exerciseName] || [])
      .filter(s => s.saved && s.weight && s.reps)
      .reduce((acc, s) => acc + parseFloat(s.weight) * parseInt(s.reps), 0);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-36 bg-[#111111] rounded-2xl" />)}
      </div>
    );
  }

  const allExercises = [...day.exercises, ...(day.core || [])];
  const totalSets = allExercises.reduce((acc, e) => acc + e.sets, 0);
  const doneSets = allExercises.reduce((acc, e) => acc + completedSets(e.name), 0);

  return (
    <div className="space-y-4">

      {/* ── Rest timer toggle ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[15px] text-white/60">Hypertrophy Timer</span>
        <button
          type="button"
          onClick={() => setTimerEnabled(v => !v)}
          className="relative flex-shrink-0"
          style={{ width: 51, height: 31 }}
          aria-label="Toggle rest timer"
        >
          <div style={{
            width: 51, height: 31, borderRadius: 16,
            backgroundColor: timerEnabled ? '#34c759' : 'rgba(255,255,255,0.2)',
            transition: 'background-color 0.2s ease',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: 2,
              width: 27, height: 27, borderRadius: '50%',
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              transform: timerEnabled ? 'translateX(20px)' : 'translateX(0px)',
              transition: 'transform 0.2s ease',
            }} />
          </div>
        </button>
      </div>

      {/* ── Session progress ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between text-[13px] text-white/45 mb-2">
          <span>{doneSets} of {totalSets} sets logged</span>
          {lastSession && (
            <span>vs. {new Date(lastSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: totalSets > 0 ? `${(doneSets / totalSets) * 100}%` : '0%', background: '#30d158' }}
          />
        </div>
      </div>

      {/* ── Exercise cards ───────────────────────────────────────────────────── */}
      {allExercises.map((exercise) => {
        const prev = lastSets[exercise.name] || [];
        const current = sets[exercise.name] || [];
        const done = completedSets(exercise.name);
        const volume = totalVolume(exercise.name);
        const allDone = done === exercise.sets;

        return (
          <div key={exercise.name} className="bg-[#111111] rounded-2xl overflow-hidden">

            {/* Card header */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-semibold leading-snug text-white">{exercise.name}</h3>
                <p className="text-[13px] text-white/45 mt-0.5">
                  {exercise.sets} sets · {exercise.repsMin}–{exercise.repsMax} reps
                  {exercise.notes && <span> · {exercise.notes}</span>}
                </p>
                {volume > 0 && (
                  <p className="text-[13px] text-white/45 mt-0.5 tabular-nums">
                    {volume.toLocaleString()} lb volume
                  </p>
                )}
              </div>
              <div className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[13px] font-bold tabular-nums ${
                allDone
                  ? 'bg-[#30d158]/20 text-[#30d158]'
                  : done > 0
                    ? 'bg-[#30d158]/20 text-[#30d158]'
                    : 'bg-white/8 text-white/35'
              }`}>
                {done}/{exercise.sets}
              </div>
              {(() => {
                const status = getHypertrophyStatus(exercise.name, exercise.repsMin, exercise.repsMax, exercise.sets);
                if (status === 'incomplete') return null;
                return (
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    status === 'achieved' ? 'bg-[#30d158]/20' :
                    status === 'partial'  ? 'bg-[#30d158]/20' :
                                            'bg-[#ff453a]/15'
                  }`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={
                        status === 'achieved' ? 'text-[#30d158]' :
                        status === 'partial'  ? 'text-[#30d158]' :
                                                'text-[#ff453a]'
                      }
                    >
                      {status === 'achieved'
                        ? <><polyline points="20 6 9 17 4 12"/></>
                        : status === 'partial'
                        ? <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                        : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      }
                    </svg>
                  </div>
                );
              })()}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-x-2 px-4 pb-2 text-[11px] text-white/25 uppercase tracking-wider">
              <div></div>
              <div className="text-center">Weight</div>
              <div className="text-center">Reps</div>
              <div></div>
            </div>

            {/* Set rows */}
            <div className="divide-y divide-white/8">
              {Array.from({ length: exercise.sets }).map((_, i) => {
                const prevSet = prev[i];
                const currSet = current[i] || { weight: '', reps: '', saved: false };
                return (
                  <div key={i}>
                  <div
                    className={`grid grid-cols-[28px_1fr_1fr_44px] gap-x-2 items-center px-4 py-2.5 transition-colors ${
                      currSet.saved ? 'bg-[#30d158]/8' : currSet.prefilled ? 'bg-[#0a84ff]/5' : ''
                    }`}
                  >
                    <div className={`text-[15px] font-bold tabular-nums ${currSet.saved ? 'text-[#30d158]' : 'text-white/25'}`}>
                      {i + 1}
                    </div>
                    <div className={`flex items-center justify-between rounded-xl px-1 h-10 transition-colors ${
                      currSet.saved ? 'bg-[#30d158]/15' : currSet.prefilled ? 'bg-[#0a84ff]/15' : 'bg-white/8'
                    }`}>
                      <button
                        type="button"
                        onClick={() => updateSet(exercise.name, i, 'weight', String(Math.round((Math.max(0, parseFloat(currSet.weight || '0') - 2.5)) * 10) / 10))}
                        className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-white active:scale-90 transition-all text-lg font-bold"
                      >−</button>
                      <span className={`text-[15px] font-semibold tabular-nums w-10 text-center ${
                        currSet.saved ? 'text-[#30d158]' : currSet.prefilled ? 'text-[#0a84ff]' : currSet.weight ? 'text-white' : 'text-white/25'
                      }`}>
                        {currSet.weight || '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSet(exercise.name, i, 'weight', String(Math.round((parseFloat(currSet.weight || '0') + 2.5) * 10) / 10))}
                        className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-white active:scale-90 transition-all text-lg font-bold"
                      >+</button>
                    </div>
                    <div className={`flex items-center justify-between rounded-xl px-1 h-10 transition-colors ${
                      currSet.saved ? 'bg-[#30d158]/15' : 'bg-white/8'
                    }`}>
                      <button
                        type="button"
                        onClick={() => updateSet(exercise.name, i, 'reps', String(Math.max(1, parseInt(currSet.reps || '8') - 1)))}
                        className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-white active:scale-90 transition-all text-lg font-bold"
                      >−</button>
                      <span className={`text-[15px] font-semibold tabular-nums w-6 text-center ${currSet.saved ? 'text-[#30d158]' : 'text-white'}`}>
                        {currSet.reps || '8'}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSet(exercise.name, i, 'reps', String(parseInt(currSet.reps || '8') + 1))}
                        className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-white active:scale-90 transition-all text-lg font-bold"
                      >+</button>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => saveSet(exercise.name, i)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                          currSet.saved
                            ? 'bg-[#30d158] text-white'
                            : 'bg-white/8 text-white/35 hover:bg-[#30d158] hover:text-white'
                        }`}
                      >
                        <Check size={15} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  {/* Sub-row: rest time (saved) or prev session + copy-from-above button (unsaved) */}
                  {(currSet.saved && currSet.restSeconds != null && currSet.restSeconds > 0) ? (
                    <div className="flex items-center gap-1.5 px-4 pt-0.5 pb-2.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={currSet.restSeconds <= TARGET_REST_SECONDS ? 'text-[#30d158]/50' : 'text-[#ff453a]/50'}>
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span className={`text-[12px] font-medium tabular-nums ${
                        currSet.restSeconds <= TARGET_REST_SECONDS ? 'text-[#30d158]/60' : 'text-[#ff453a]/60'
                      }`}>
                        {formatTime(currSet.restSeconds)} rest
                      </span>
                    </div>
                  ) : !currSet.saved ? (
                    <div className="flex items-center justify-between px-4 pt-0.5 pb-2.5">
                      {prevSet ? (
                        <span className="text-[12px] text-white/25">
                          prev {prevSet.weight_lbs ?? '—'} × {prevSet.reps ?? '—'}
                        </span>
                      ) : <span />}
                      {i > 0 && current[i - 1]?.weight ? (
                        <button
                          type="button"
                          onClick={() => updateSet(exercise.name, i, 'weight', current[i - 1].weight)}
                          className="flex items-center gap-1 text-[12px] text-white/35 hover:text-white/60 active:opacity-60 transition-opacity"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15"/>
                          </svg>
                          {current[i - 1].weight} lbs
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  </div>
                );
              })}
            </div>

          </div>
        );
      })}


      {/* ── Finish ──────────────────────────────────────────────────────────── */}
      {!completed ? (
        <button
          onClick={async () => { await markComplete(); setShowSummary(true); }}
          className="w-full h-[50px] bg-[#30d158] active:opacity-75 rounded-[14px] font-semibold text-[17px] text-white transition-opacity"
        >
          Finish Workout
        </button>
      ) : (
        <div className="space-y-2">
          <div className="w-full h-[50px] bg-[#30d158] rounded-[14px] font-semibold text-[17px] text-white flex items-center justify-center gap-2">
            <Check size={20} strokeWidth={3} />
            Workout Complete
          </div>
          <button
            onClick={markIncomplete}
            className="w-full h-11 text-[15px] text-white/25 hover:text-white/50 transition-colors"
          >
            Mark as incomplete
          </button>
        </div>
      )}

      {/* ── Floating Rest Timer ─────────────────────────────────────────────── */}
      {timerSetKey !== null && (
        <div className="fixed bottom-[83px] left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-lg">
            <div className={`rounded-2xl px-5 py-4 shadow-2xl border transition-colors ${
              timerElapsed < TARGET_REST_SECONDS * 0.75
                ? 'bg-[#111111] border-[#30d158]/40'
                : timerElapsed < TARGET_REST_SECONDS
                ? 'bg-[#111111] border-[#30d158]/60'
                : 'bg-[#111111] border-[#ff453a]/60'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-0.5">Rest Timer</p>
                  <div className="flex items-end gap-2">
                    <span className={`text-[40px] font-bold leading-none tabular-nums ${
                      timerElapsed < TARGET_REST_SECONDS * 0.75
                        ? 'text-[#30d158]'
                        : timerElapsed < TARGET_REST_SECONDS
                        ? 'text-[#30d158]'
                        : 'text-[#ff453a]'
                    }`}>
                      {formatTime(timerElapsed)}
                    </span>
                    <span className="text-[15px] text-white/25 mb-1.5">/ {formatTime(TARGET_REST_SECONDS)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Pause / Resume */}
                  <button
                    onClick={pauseTimer}
                    className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:opacity-70 transition-opacity"
                  >
                    {timerRunning ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                        <rect x="6" y="4" width="4" height="16" rx="1"/>
                        <rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                  {/* Stop */}
                  <button
                    onClick={stopTimer}
                    className="w-11 h-11 rounded-full bg-[#ff453a]/20 flex items-center justify-center active:opacity-70 transition-opacity"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#ff453a]">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    timerElapsed < TARGET_REST_SECONDS * 0.75
                      ? 'bg-[#30d158]'
                      : timerElapsed < TARGET_REST_SECONDS
                      ? 'bg-[#30d158]'
                      : 'bg-[#ff453a]'
                  }`}
                  style={{ width: `${Math.min((timerElapsed / TARGET_REST_SECONDS) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-workout summary modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80">
          <div className="bg-[#111111] rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="px-5 pt-6 pb-4 text-center border-b border-white/8">
              <div className="w-14 h-14 rounded-full bg-[#30d158]/20 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#30d158]">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-[22px] font-bold text-white">Workout Complete</h2>
              <p className="text-[15px] text-white/45 mt-1">{day.name}</p>
            </div>

            {/* Overall score */}
            {(() => {
              const allExercises = [...day.exercises, ...(day.core || [])];
              const statuses = allExercises.map(ex => getHypertrophyStatus(ex.name, ex.repsMin, ex.repsMax, ex.sets));
              const achieved = statuses.filter(s => s === 'achieved').length;
              const total = allExercises.length;
              const pct = Math.round((achieved / total) * 100);
              const color = pct >= 80 ? '#30d158' : pct >= 50 ? '#30d158' : '#ff453a';
              return (
                <div className="px-5 py-4 border-b border-white/8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-2">Hypertrophy</p>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-[40px] font-bold leading-none tabular-nums" style={{ color }}>{pct}%</span>
                    <span className="text-[15px] text-white/35 mb-1.5">{achieved} of {total} exercises</span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })()}

            {/* Per-exercise breakdown */}
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-3">Breakdown</p>
              <div className="space-y-2">
                {[...day.exercises, ...(day.core || [])].map(ex => {
                  const status = getHypertrophyStatus(ex.name, ex.repsMin, ex.repsMax, ex.sets);
                  const exerciseSets = sets[ex.name] || [];
                  const saved = exerciseSets.filter(s => s.saved);
                  const hits = saved.filter(s => {
                    const reps = parseInt(s.reps);
                    if (isNaN(reps) || reps < ex.repsMin || reps > ex.repsMax) return false;
                    if (s.restSeconds != null && s.restSeconds > TARGET_REST_SECONDS) return false;
                    return true;
                  });
                  const statusLabel = status === 'achieved' ? 'Achieved' : status === 'partial' ? 'Partial' : status === 'missed' ? 'Missed' : 'Skipped';
                  const statusColor = status === 'achieved' ? 'text-[#30d158] bg-[#30d158]/15' : status === 'partial' ? 'text-[#30d158] bg-[#30d158]/15' : status === 'missed' ? 'text-[#ff453a] bg-[#ff453a]/10' : 'text-white/25 bg-white/8';
                  return (
                    <div key={ex.name} className="flex items-center justify-between h-[44px]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-white truncate">{ex.name}</p>
                        {saved.length > 0 && (
                          <p className="text-[11px] text-white/35">{hits.length}/{saved.length} sets in range</p>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Done button */}
            <div className="px-5 pb-8">
              <button
                onClick={() => setShowSummary(false)}
                className="w-full h-[50px] bg-[#30d158] active:opacity-75 rounded-[14px] font-semibold text-[17px] text-white transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
