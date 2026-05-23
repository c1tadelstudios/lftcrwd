'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import {
  supabase, getOrCreateDailyLog, today, type DailyLog,
} from '@/lib/supabase';
import { NUTRITION } from '@/lib/plan';

const MEAL_FIELDS = ['meal_1_done','meal_2_done','meal_3_done','meal_4_done','meal_5_done'] as const;
type MealField = (typeof MEAL_FIELDS)[number];
type MealSection = { title: string; body: string };
const DEFAULT_MEAL_CALORIES = 350;

function parseMealSections(markdown: string): MealSection[] {
  const sections: MealSection[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of markdown.split('\n')) {
    if (/^#{1,2}\s/.test(line)) {
      if (current) sections.push({ title: current.title, body: current.lines.join('\n').trim() });
      current = { title: line.replace(/^#{1,2}\s+/, ''), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join('\n').trim() });
  return sections;
}

function MealToggle({ value, onChange }: { value: boolean; onChange: () => void }) {
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

function MealCard({ title, body, done, calories, onToggle, onCaloriesChange }: {
  title: string; body?: React.ReactNode; done: boolean; calories: number;
  onToggle: () => void; onCaloriesChange: (cal: number) => void;
}) {
  const [editingCal, setEditingCal] = useState(false);
  const [calDraft, setCalDraft]     = useState('');

  function openCalEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setCalDraft(String(calories || ''));
    setEditingCal(true);
  }

  function commitCal() {
    const val = parseInt(calDraft, 10);
    if (!isNaN(val) && val > 0) onCaloriesChange(val);
    setEditingCal(false);
  }

  return (
    <div className={`bg-[#111111] rounded-2xl overflow-hidden transition-opacity ${done ? 'opacity-70' : ''}`}>
      <div className={`flex items-center gap-3 px-4 min-h-[60px] py-3 ${done ? 'bg-[#30d158]/8' : ''}`}>
        <div className="flex-1 min-w-0">
          <h3 className={`text-[17px] font-semibold ${done ? 'line-through text-white/40' : 'text-white'}`}>{title}</h3>
          {editingCal ? (
            <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
              <input
                type="number"
                value={calDraft}
                onChange={e => setCalDraft(e.target.value)}
                onBlur={commitCal}
                onKeyDown={e => { if (e.key === 'Enter') commitCal(); if (e.key === 'Escape') setEditingCal(false); }}
                className="w-20 bg-white/10 text-white text-[13px] rounded-md px-2 py-0.5 outline-none border border-white/20 focus:border-white/40"
                autoFocus
              />
              <span className="text-[13px] text-white/45">kcal</span>
            </div>
          ) : (
            <button onClick={openCalEdit} className="text-[13px] text-white/45 mt-0.5 hover:text-white/70 transition-colors text-left">
              {calories > 0 ? `${calories} kcal` : '+ add calories'}
            </button>
          )}
        </div>
        <MealToggle value={done} onChange={onToggle} />
      </div>
      {body && <div className="px-4 pb-4 pt-1 border-t border-white/8">{body}</div>}
    </div>
  );
}

const mdComponents: Components = {
  p:      ({ children }) => <p className="text-[15px] text-white/45 mb-1 leading-5">{children}</p>,
  ul:     ({ children }) => <ul className="space-y-0.5">{children}</ul>,
  li:     ({ children }) => <li className="text-[15px] text-white/45 flex gap-2"><span className="text-white/20 mt-0.5 flex-shrink-0">·</span><span>{children}</span></li>,
  strong: ({ children }) => <strong className="text-white/80 font-semibold">{children}</strong>,
};

export default function NutritionPage() {
  const [log, setLog]               = useState<DailyLog | null>(null);
  const [customPlan, setCustomPlan] = useState<string | null | undefined>(undefined);
  const [calories, setCalories]     = useState<Record<number, number>>({});
  const [editing, setEditing]       = useState(false);
  const [draft, setDraft]           = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    getOrCreateDailyLog(today()).then(setLog);
    fetch('/api/meal-plan').then(r => r.json()).then(d => setCustomPlan(d.plan ?? null));
    fetch('/api/meal-calories').then(r => r.json()).then(d => setCalories(d ?? {}));
  }, []);

  async function savePlan() {
    setSaving(true);
    const res = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: draft.trim() || null }),
    });
    if (res.ok) {
      const getRes = await fetch('/api/meal-plan');
      const d = await getRes.json();
      setCustomPlan(d.plan ?? null);
    }
    setEditing(false);
    setSaving(false);
  }

  function openEditor() {
    setDraft(customPlan ?? '');
    setEditing(true);
  }

  async function toggleMeal(field: MealField, current: boolean) {
    if (!log) return;
    setLog({ ...log, [field]: !current });
    await supabase.from('daily_logs').update({ [field]: !current }).eq('id', log.id);
  }

  async function saveCalorie(mealIndex: number, cal: number) {
    setCalories(prev => ({ ...prev, [mealIndex]: cal }));
    await fetch('/api/meal-calories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealIndex, calories: cal }),
    });
  }

  async function toggleCustomMeal(index: number, current: boolean) {
    if (!log) return;
    const updated = { ...(log.custom_meals_done || {}), [String(index)]: !current };
    setLog({ ...log, custom_meals_done: updated });
    await supabase.from('daily_logs').update({ custom_meals_done: updated }).eq('id', log.id);
  }

  const customSections = customPlan ? parseMealSections(customPlan) : [];
  const mealCount = customPlan && customSections.length > 0 ? customSections.length : NUTRITION.meals.length;

  const doneMealIndices: number[] = customPlan && customSections.length > 0
    ? customSections.map((_, i) => i).filter(i => !!(log?.custom_meals_done?.[String(i)]))
    : MEAL_FIELDS.map((f, i) => ({ f, i })).filter(({ f }) => log ? (log[f] as boolean) : false).map(({ i }) => i);

  const doneMeals    = doneMealIndices.length;
  const calForMeal   = (i: number) => calories[i] ?? DEFAULT_MEAL_CALORIES;
  const totalCalGoal = Array.from({ length: mealCount }, (_, i) => calForMeal(i)).reduce((a, b) => a + b, 0);
  const consumedCals = doneMealIndices.reduce((acc, i) => acc + calForMeal(i), 0);
  const remaining    = Math.max(0, totalCalGoal - consumedCals);
  const calPct       = totalCalGoal > 0 ? Math.min(100, (consumedCals / totalCalGoal) * 100) : 0;

  const MACROS = [
    { label: 'Protein',  value: `${NUTRITION.protein}g`,                          color: 'text-[#0a84ff]' },
    { label: 'Carbs',    value: `${NUTRITION.carbs.min}–${NUTRITION.carbs.max}g`, color: 'text-[#ff9f0a]' },
    { label: 'Fats',     value: `${NUTRITION.fats.min}–${NUTRITION.fats.max}g`,   color: 'text-[#ffd60a]' },
    { label: 'Water',    value: '1–1.25 gal',                                     color: 'text-[#64d2ff]' },
    { label: 'Creatine', value: '5g daily',                                       color: 'text-white/60'  },
  ];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-[13px] text-white/45 mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.37px] text-white">Meals</h1>
      </div>

      {/* ── Calorie hero — surface-less ──────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[13px] text-white/45 mb-1">{doneMeals} of {mealCount} meals</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[52px] font-bold leading-none tabular-nums text-white">{consumedCals.toLocaleString()}</span>
              {totalCalGoal > 0 && <span className="text-[17px] text-white/45">/ {totalCalGoal.toLocaleString()} kcal</span>}
            </div>
          </div>
          {totalCalGoal > 0 && (
            <div className="text-right pb-1">
              <p className="text-[11px] text-white/35 mb-0.5">Remaining</p>
              <p className={`text-[28px] font-bold tabular-nums ${remaining === 0 ? 'text-[#30d158]' : 'text-white'}`}>
                {remaining.toLocaleString()}
              </p>
            </div>
          )}
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${calPct}%`, background: '#30d158' }} />
        </div>
      </div>

      <div className="md:grid md:grid-cols-[260px_1fr] md:gap-8 md:items-start">

        {/* ── Left: targets + cheat meal ──────────────────────────────────────── */}
        <div className="order-2 md:order-1 mt-8 md:mt-0 space-y-6">

          {/* Macro targets — surface-less grid */}
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-3 px-1">Daily targets</p>
            <div className="grid grid-cols-2 gap-2">
              {totalCalGoal > 0 && (
                <div className="col-span-2 bg-[#111111] rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-white/35 uppercase tracking-wider mb-0.5">Calories</p>
                    <p className="text-[17px] font-bold text-white tabular-nums">{totalCalGoal.toLocaleString()} kcal</p>
                  </div>
                  <span className="text-[11px] text-white/25">from meal targets</span>
                </div>
              )}
              {MACROS.map(item => (
                <div key={item.label} className="bg-[#111111] rounded-xl p-3">
                  <p className="text-[11px] text-white/35 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`text-[15px] font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right: meals ────────────────────────────────────────────────────── */}
        <div className="order-1 md:order-2 space-y-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Meals</p>
            {customPlan !== undefined && !editing && (
              <button onClick={openEditor} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">
                {customPlan ? 'Edit' : '+ Add your plan'}
              </button>
            )}
          </div>

          {editing && (
            <div className="bg-[#111111] rounded-2xl p-4 mb-1">
              <textarea
                className="w-full bg-[#1c1c1c] text-[15px] text-white/80 rounded-xl p-3 min-h-[180px] resize-y border border-white/10 focus:outline-none focus:border-white/25 font-mono leading-relaxed"
                placeholder={"## Meal 1 — Breakfast\n- 6 egg whites\n- 1 cup oats\n\n## Meal 2 — Lunch\n- Chicken breast\n- Rice"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-white/25 mt-2 mb-3">Use ## headings for meal names so they appear as trackable cards.</p>
              <div className="flex gap-2">
                <button onClick={savePlan} disabled={saving} className="flex-1 bg-[#30d158] text-black text-[15px] font-semibold rounded-xl py-3 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save plan'}
                </button>
                <button onClick={() => setEditing(false)} className="px-5 bg-white/10 text-white/60 text-[15px] font-semibold rounded-xl py-3">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {customPlan === undefined ? (
            [...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-[60px] bg-[#111111] rounded-2xl" />)
          ) : customPlan && customSections.length > 0 ? (
            customSections.map((section, i) => {
              const done = !!(log?.custom_meals_done?.[String(i)]);
              return (
                <MealCard key={i} title={section.title} done={done} calories={calForMeal(i)}
                  onToggle={() => toggleCustomMeal(i, done)}
                  onCaloriesChange={cal => saveCalorie(i, cal)}
                  body={section.body ? <ReactMarkdown components={mdComponents}>{section.body}</ReactMarkdown> : undefined}
                />
              );
            })
          ) : customPlan ? (
            <div className="bg-[#111111] rounded-2xl p-4">
              <ReactMarkdown components={{
                p:      ({ children }) => <p className="text-[15px] text-white/60 mb-2 leading-5">{children}</p>,
                ul:     ({ children }) => <ul className="space-y-0.5 mb-2">{children}</ul>,
                li:     ({ children }) => <li className="text-[15px] text-white/60 flex gap-2"><span className="text-white/20 flex-shrink-0">·</span><span>{children}</span></li>,
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              } as Components}>{customPlan}</ReactMarkdown>
            </div>
          ) : (
            NUTRITION.meals.map((meal, i) => {
              const field = MEAL_FIELDS[i];
              const done  = log ? (log[field] as boolean) : false;
              return (
                <MealCard key={meal.name} title={meal.name} done={done} calories={calForMeal(i)}
                  onToggle={() => toggleMeal(field, done)}
                  onCaloriesChange={cal => saveCalorie(i, cal)}
                  body={
                    <ul className="space-y-1.5">
                      {meal.items.map(item => (
                        <li key={item} className="text-[15px] text-white/45 flex gap-2 leading-5">
                          <span className="text-white/20 flex-shrink-0 mt-0.5">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  }
                />
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
