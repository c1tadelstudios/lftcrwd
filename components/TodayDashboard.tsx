'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, Footprints, ChevronsUp, Bike, Waves } from 'lucide-react';

type CardioDetails = NonNullable<import('@/lib/supabase').DailyLog['cardio_details']>;

const CARDIO_FIELDS: Record<string, { key: keyof CardioDetails; label: string; unit: string; placeholder: string; step: string }[]> = {
  Treadmill: [
    { key: 'time_min',  label: 'Time',     unit: 'min', placeholder: '30',   step: '1'   },
    { key: 'incline',   label: 'Incline',  unit: '%',   placeholder: '5',    step: '0.5' },
    { key: 'speed',     label: 'Speed',    unit: 'mph', placeholder: '3.5',  step: '0.1' },
    { key: 'calories',  label: 'Calories', unit: 'kcal',placeholder: '250',  step: '1'   },
  ],
  Stepper: [
    { key: 'time_min',  label: 'Time',      unit: 'min', placeholder: '20',  step: '1' },
    { key: 'intensity', label: 'Intensity', unit: '',    placeholder: '7',   step: '1' },
    { key: 'calories',  label: 'Calories',  unit: 'kcal',placeholder: '180', step: '1' },
  ],
  Bike: [
    { key: 'time_min',  label: 'Time',      unit: 'min', placeholder: '20',  step: '1' },
    { key: 'intensity', label: 'Intensity', unit: '',    placeholder: '7',   step: '1' },
    { key: 'calories',  label: 'Calories',  unit: 'kcal',placeholder: '180', step: '1' },
  ],
  Rower: [
    { key: 'time_min',  label: 'Time',      unit: 'min', placeholder: '20',  step: '1' },
    { key: 'intensity', label: 'Intensity', unit: '',    placeholder: '7',   step: '1' },
    { key: 'calories',  label: 'Calories',  unit: 'kcal',placeholder: '150', step: '1' },
  ],
};
import { supabase, getOrCreateDailyLog, getRecentSessions, today, type DailyLog, type WorkoutSession } from '@/lib/supabase';
import { WORKOUT_PLAN, DAILY_TARGETS } from '@/lib/plan';

const GALLON_OZ = 128;

// ── iOS-style pill toggle ────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 flex-shrink-0 ${
        value ? 'bg-[#30d158]' : 'bg-white/20'
      }`}
    >
      <div className={`absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow transition-transform duration-200 ${
        value ? 'translate-x-[20px]' : 'translate-x-[2px]'
      }`} />
    </button>
  );
}

function countMealSections(plan: string): number {
  return plan.split('\n').filter(l => /^#{1,2}\s/.test(l)).length;
}

export default function TodayDashboard() {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [showAllDays, setShowAllDays] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customMealCount, setCustomMealCount] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const [l, s, mealRes] = await Promise.all([
        getOrCreateDailyLog(today()),
        getRecentSessions(10),
        fetch('/api/meal-plan').then(r => r.json()),
      ]);
      setLog(l);
      setSessions(s);
      if (mealRes.plan) {
        const count = countMealSections(mealRes.plan);
        if (count > 0) setCustomMealCount(count);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function update(fields: Partial<DailyLog>) {
    if (!log) return;
    setLog({ ...log, ...fields });
    await supabase.from('daily_logs').update(fields).eq('id', log.id);
  }

  function updateCardioDetail(key: keyof CardioDetails, raw: string) {
    if (!log) return;
    const blank: CardioDetails = { time_min: null, incline: null, speed: null, intensity: null, calories: null };
    const current = log.cardio_details ?? blank;
    const value = raw === '' ? null : parseFloat(raw);
    update({ cardio_details: { ...current, [key]: value } });
  }


  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-white/8 rounded-full w-48" />
      <div className="h-[120px] bg-[#111111] rounded-2xl" />
      <div className="h-[160px] bg-[#111111] rounded-2xl" />
      <div className="h-[110px] bg-[#111111] rounded-2xl" />
    </div>
  );
  if (!log) return null;

  // ── Onboarding empty state ────────────────────────────────────────────────
  // Show a welcome screen to brand-new clients who haven't logged anything yet.
  const isOnboarded = typeof window !== 'undefined' && localStorage.getItem('lftcrwd_onboarded');
  const isNewClient = !isOnboarded && sessions.length === 0 && log.protein_g === 0 && log.water_oz === 0;

  if (isNewClient) {
    return (
      <div className="flex flex-col gap-6 pt-4">
        <div className="bg-[#111111] rounded-2xl p-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#30d158] mb-3">Welcome</p>
          <h2 className="text-[26px] font-bold text-white leading-tight mb-3">
            You&apos;re all set up.
          </h2>
          <p className="text-[17px] text-white/55 leading-relaxed mb-6">
            Your coach has added you to lftcrwd. Start by logging today&apos;s workout or tracking your nutrition below.
          </p>
          <div className="space-y-3 mb-6">
            {[
              { emoji: '💪', title: 'Log a workout', desc: 'Track sets, reps, and weight' },
              { emoji: '🥗', title: 'Track nutrition', desc: 'Protein, water, and daily habits' },
              { emoji: '📈', title: 'See your progress', desc: 'Charts update as you log' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <span className="text-2xl">{emoji}</span>
                <div>
                  <p className="text-[15px] font-semibold text-white">{title}</p>
                  <p className="text-[13px] text-white/40">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              localStorage.setItem('lftcrwd_onboarded', '1');
              // Force re-render to exit the onboarding state
              window.location.reload();
            }}
            className="w-full h-[50px] bg-[#30d158] rounded-[14px] font-semibold text-[17px] text-black active:opacity-75 transition-opacity"
          >
            Let&apos;s go
          </button>
        </div>
      </div>
    );
  }

  const proteinPct  = Math.min(100, (log.protein_g / DAILY_TARGETS.proteinG) * 100);
  const waterPct    = Math.min(100, (log.water_oz / GALLON_OZ) * 100);
  const workedOutToday = sessions.some(s => s.date === today());

  const totalMeals = customMealCount ?? 5;
  const mealsDone = customMealCount !== null
    ? Object.values(log.custom_meals_done ?? {}).filter(Boolean).length
    : [log.meal_1_done, log.meal_2_done, log.meal_3_done, log.meal_4_done, log.meal_5_done].filter(Boolean).length;

  const goals = [
    { label: 'Protein',  done: log.protein_g >= DAILY_TARGETS.proteinG },
    { label: 'Water',    done: log.water_oz >= GALLON_OZ },
    { label: 'Meals',    done: mealsDone >= totalMeals },
    { label: 'Creatine', done: log.creatine },
    { label: 'Cardio',   done: log.cardio_done },
    { label: 'Workout',  done: workedOutToday },
  ];
  const goalsDone = goals.filter(g => g.done).length;
  const allDone = goalsDone === goals.length;

  const lastSession = sessions[0];
  const nextDayNum = lastSession ? (lastSession.day_number % WORKOUT_PLAN.length) + 1 : 1;
  const nextDay = WORKOUT_PLAN.find(d => d.day === nextDayNum) || WORKOUT_PLAN[0];

  return (
    <div className="space-y-6">

      {/* ── Completion ring ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        {/* SVG ring */}
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            {/* Track */}
            <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            {/* Progress arc */}
            <circle
              cx="44" cy="44" r="36" fill="none"
              stroke={allDone ? '#30d158' : '#30d158'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - goalsDone / goals.length)}`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          {/* Number inside ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-[28px] font-bold tabular-nums leading-none ${allDone ? 'text-[#30d158]' : 'text-white'}`}>
              {goalsDone}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold text-white mb-0.5">
            {allDone ? 'All done today 🎉' : `${goals.length - goalsDone} left today`}
          </p>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {goals.map(g => (
              <span
                key={g.label}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium transition-colors ${
                  g.done ? 'bg-[#30d158]/20 text-[#30d158]' : 'bg-white/8 text-white/30'
                }`}
              >
                {g.done && <Check size={9} strokeWidth={3} />}
                {g.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Workout CTA — hero banner, not just a card ─────────────────────── */}
      <div className={`rounded-2xl p-5 ${workedOutToday ? 'bg-[#111111]' : 'bg-[#30d158]'}`}>
        <p className={`text-[13px] font-semibold uppercase tracking-[0.06em] mb-2 ${workedOutToday ? 'text-white/45' : 'text-white/70'}`}>
          {workedOutToday ? 'Workout logged today' : 'Up next'}
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={`text-[28px] font-bold leading-[34px] ${workedOutToday ? 'text-white' : 'text-white'}`}>
              {nextDay.name}
            </p>
            <p className={`text-[15px] mt-1 ${workedOutToday ? 'text-white/45' : 'text-white/70'}`}>
              Day {nextDay.day} · {nextDay.exercises.length} exercises{nextDay.cardio ? ' · cardio' : ''}
            </p>
          </div>
          <Link
            href={`/workout?day=${nextDay.day}`}
            className={`flex-shrink-0 h-[50px] px-6 rounded-[14px] font-semibold text-[17px] flex items-center transition-opacity active:opacity-75 ${
              workedOutToday
                ? 'bg-[#30d158] text-white'
                : 'bg-white text-[#30d158]'
            }`}
          >
            {workedOutToday ? 'Again' : 'Start'}
          </Link>
        </div>

        {/* All days expander */}
        <button
          onClick={() => setShowAllDays(v => !v)}
          className={`mt-4 text-[13px] transition-colors ${workedOutToday ? 'text-white/35 hover:text-white/60' : 'text-white/60 hover:text-white/90'}`}
        >
          {showAllDays ? 'Hide days ↑' : 'All workout days ↓'}
        </button>
        {showAllDays && (
          <div className="mt-2 space-y-0.5">
            {WORKOUT_PLAN.map(d => (
              <Link
                key={d.day}
                href={`/workout?day=${d.day}`}
                className={`flex items-center justify-between h-10 text-[15px] transition-opacity active:opacity-60 ${
                  d.day === nextDay.day
                    ? workedOutToday ? 'text-[#30d158]' : 'text-white font-semibold'
                    : workedOutToday ? 'text-white/45' : 'text-white/60'
                }`}
              >
                <span>
                  <span className={`mr-2 tabular-nums text-[13px] ${workedOutToday ? 'text-white/25' : 'text-white/40'}`}>D{d.day}</span>
                  {d.name}
                </span>
                <span className={`text-[13px] ${workedOutToday ? 'text-white/25' : 'text-white/40'}`}>{d.exercises.length} ex →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Meals quick link ───────────────────────────────────────────────── */}
      <Link href="/nutrition" className="flex items-center justify-between px-4 h-[54px] bg-[#111111] rounded-2xl active:bg-white/5 transition-colors">
        <span className="text-[17px] text-white">Meals</span>
        <span className={`text-[15px] tabular-nums ${mealsDone >= totalMeals ? 'text-[#30d158] font-semibold' : 'text-white/30'}`}>
          {mealsDone} / {totalMeals} →
        </span>
      </Link>

      {/* ── Track section header ────────────────────────────────────────────── */}
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Track</p>

        {/* Protein + Water — one grouped container, two rows */}
        <div className="bg-[#111111] rounded-2xl overflow-hidden">

          {/* Protein row */}
          <div className="px-4 pt-4 pb-3 border-b border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[17px] font-semibold text-white">Protein</span>
              <span className={`text-[15px] tabular-nums ${proteinPct >= 100 ? 'text-[#0a84ff] font-semibold' : 'text-white/45'}`}>
                {log.protein_g} / {DAILY_TARGETS.proteinG}g
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${proteinPct}%`, background: 'linear-gradient(90deg, #3b82f6, #818cf8)' }} />
            </div>
            <div className="flex gap-2">
              {[20, 30, 40, 50].map(g => (
                <button key={g}
                  onClick={() => update({ protein_g: Math.min(log.protein_g + g, 300) })}
                  className="flex-1 h-10 bg-white/8 hover:bg-white/12 active:scale-[0.97] rounded-xl text-[15px] font-medium transition-all">
                  +{g}g
                </button>
              ))}
            </div>
          </div>

          {/* Water row */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[17px] font-semibold text-white">Water</span>
              <span className={`text-[15px] tabular-nums ${waterPct >= 100 ? 'text-[#64d2ff] font-semibold' : 'text-white/45'}`}>
                {(log.water_oz / GALLON_OZ).toFixed(2)} / 1 gal
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${waterPct}%`, background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }} />
            </div>
            <div className="flex gap-2">
              {[8, 16, 24, 32].map(oz => (
                <button key={oz}
                  onClick={() => update({ water_oz: Math.min(log.water_oz + oz, 200) })}
                  className="flex-1 h-10 bg-white/8 hover:bg-white/12 active:scale-[0.97] rounded-xl text-[15px] font-medium transition-all">
                  +{oz}oz
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Habits section — iOS grouped list with toggles ─────────────────── */}
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Habits</p>
        <div className="bg-[#111111] rounded-2xl overflow-hidden">
          {/* Creatine */}
          <div className="flex items-center justify-between px-4 h-[60px]">
            <div>
              <p className="text-[17px] text-white">Creatine 5g</p>
              <p className="text-[13px] text-white/35">Take with water</p>
            </div>
            <Toggle value={log.creatine} onChange={() => update({ creatine: !log.creatine })} />
          </div>

          <div className="h-px bg-white/8 ml-4" />

          {/* Cardio toggle + machine selector */}
          <div>
            <div className="flex items-center justify-between px-4 h-[60px]">
              <div>
                <p className="text-[17px] text-white">Cardio</p>
                <p className="text-[13px] text-white/35">
                  {log.cardio_done && log.cardio_type ? log.cardio_type : 'Any movement counts'}
                </p>
              </div>
              <Toggle value={log.cardio_done} onChange={() => update({ cardio_done: !log.cardio_done, cardio_type: !log.cardio_done ? log.cardio_type : null })} />
            </div>

            {/* Machine selector — slides in when cardio is on */}
            {log.cardio_done && (
              <>
                <div className="px-4 pb-4 flex gap-3">
                  {([
                    { id: 'Treadmill', Icon: Footprints },
                    { id: 'Stepper',   Icon: ChevronsUp },
                    { id: 'Bike',      Icon: Bike       },
                    { id: 'Rower',     Icon: Waves      },
                  ] as const).map(({ id, Icon }) => {
                    const active = log.cardio_type === id;
                    return (
                      <button
                        key={id}
                        onClick={() => update({ cardio_type: active ? null : id, cardio_details: active ? null : log.cardio_details })}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all active:scale-[0.96] ${
                          active
                            ? 'bg-[#30d158]/20 text-[#30d158]'
                            : 'bg-white/8 text-white/35 hover:text-white/60'
                        }`}
                      >
                        <Icon size={22} strokeWidth={1.75} />
                        <span className="text-[11px] font-medium">{id}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Detail inputs — shown when a machine is selected */}
                {log.cardio_type && CARDIO_FIELDS[log.cardio_type] && (
                  <div className="mx-4 mb-4 bg-black/30 rounded-xl overflow-hidden">
                    {CARDIO_FIELDS[log.cardio_type].map((field, i, arr) => {
                      const val = log.cardio_details?.[field.key];
                      return (
                        <div key={field.key}>
                          <div className="flex items-center px-4 h-[50px]">
                            <span className="flex-1 text-[15px] text-white/60">{field.label}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="decimal"
                                step={field.step}
                                value={val ?? ''}
                                onChange={e => updateCardioDetail(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-16 bg-transparent text-right text-[15px] text-white outline-none placeholder:text-white/20 tabular-nums"
                              />
                              {field.unit && (
                                <span className="text-[13px] text-white/25 w-8">{field.unit}</span>
                              )}
                            </div>
                          </div>
                          {i < arr.length - 1 && <div className="h-px bg-white/6 ml-4" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Listening to */}
                <div className="mx-4 mb-4 bg-black/30 rounded-xl overflow-hidden">
                  <div className="flex items-center px-4 h-[50px]">
                    <span className="flex-1 text-[15px] text-white/60">Listening to</span>
                    <input
                      type="text"
                      value={log.cardio_listening ?? ''}
                      onChange={e => update({ cardio_listening: e.target.value || null })}
                      placeholder="Podcast, album, playlist…"
                      className="w-40 bg-transparent text-right text-[15px] text-white outline-none placeholder:text-white/20 truncate"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Log section — steps only (weight lives on Progress) ────────────── */}
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-2 px-1">Log</p>
        <div className="bg-[#111111] rounded-2xl overflow-hidden">
          <div className="flex items-center px-4 h-[54px]">
            <span className="flex-1 text-[17px] text-white">Steps</span>
            <input
              type="number"
              value={log.steps || ''}
              onChange={e => update({ steps: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="text-right text-[17px] text-white/45 bg-transparent outline-none w-28 placeholder:text-white/20"
            />
          </div>
        </div>
      </div>



    </div>
  );
}
