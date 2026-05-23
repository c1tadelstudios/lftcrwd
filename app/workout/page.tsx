'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { WORKOUT_PLAN } from '@/lib/plan';
import { getMyWorkoutPlan } from '@/lib/supabase';
import WorkoutLogger from '@/components/WorkoutLogger';

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-[17px] font-bold text-white mb-2 mt-4 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[15px] font-bold text-white mb-1.5 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[15px] font-semibold text-white/80 mb-1 mt-2">{children}</h3>,
  p:  ({ children }) => <p className="text-[15px] text-white/60 mb-2 leading-5">{children}</p>,
  ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
  li: ({ children }) => <li className="text-[15px] text-white/60 flex gap-2"><span className="text-white/25 mt-0.5 flex-shrink-0">·</span><span>{children}</span></li>,
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  hr: () => <hr className="border-white/10 my-3" />,
};

function WorkoutContent() {
  const params = useSearchParams();
  const dayNum = parseInt(params.get('day') || '1');
  const day = WORKOUT_PLAN.find((d) => d.day === dayNum) || WORKOUT_PLAN[0];

  const [customPlan, setCustomPlan] = useState<string | null | undefined>(undefined);
  const [editing, setEditing]       = useState(false);
  const [draft, setDraft]           = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    getMyWorkoutPlan().then(setCustomPlan);
  }, []);

  async function savePlan() {
    setSaving(true);
    await fetch('/api/workout-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: draft.trim() || null }),
    });
    setCustomPlan(draft.trim() || null);
    setEditing(false);
    setSaving(false);
  }

  function openEditor() {
    setDraft(customPlan ?? '');
    setEditing(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[13px] text-white/45 mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-[34px] font-bold leading-[41px] tracking-[0.37px] text-white">{day.name}</h1>
      </div>

      {/* Program block */}
      {customPlan === undefined ? (
        <div className="animate-pulse h-16 bg-[#111111] rounded-2xl mb-5" />
      ) : editing ? (
        <div className="bg-[#111111] rounded-2xl p-4 mb-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45 mb-3">Your program</p>
          <textarea
            className="w-full bg-[#1c1c1c] text-[15px] text-white/80 rounded-xl p-3 min-h-[200px] resize-y border border-white/10 focus:outline-none focus:border-white/25 font-mono leading-relaxed"
            placeholder={"## Day 1 — Upper\n- Bench Press 4×8\n- Row 4×10\n\n## Day 2 — Lower\n- Squat 4×8\n- RDL 3×10"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-white/25 mt-2 mb-4">Supports markdown — use ## for headings, - for lists.</p>
          <div className="flex gap-2">
            <button
              onClick={savePlan}
              disabled={saving}
              className="flex-1 bg-[#30d158] text-black text-[15px] font-semibold rounded-xl py-3 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save program'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-5 bg-white/10 text-white/60 text-[15px] font-semibold rounded-xl py-3"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : customPlan ? (
        <div className="bg-[#111111] rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/45">Your program</p>
            <button
              onClick={openEditor}
              className="text-[13px] text-white/40 hover:text-white/70 transition-colors"
            >
              Edit
            </button>
          </div>
          <ReactMarkdown components={markdownComponents}>{customPlan}</ReactMarkdown>
        </div>
      ) : (
        <button
          onClick={openEditor}
          className="w-full bg-[#111111] rounded-2xl p-4 mb-5 text-left border border-dashed border-white/10 hover:border-white/20 transition-colors"
        >
          <p className="text-[15px] font-semibold text-white/40">+ Add your program</p>
          <p className="text-[13px] text-white/25 mt-0.5">Write your own workout plan in markdown.</p>
        </button>
      )}

      {/* Day selector */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
        {WORKOUT_PLAN.map((d) => {
          const active = d.day === dayNum;
          return (
            <Link
              key={d.day}
              href={`/workout?day=${d.day}`}
              className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-[14px] transition-colors min-w-[72px] min-h-[44px] justify-center ${
                active
                  ? 'bg-[#30d158] text-white'
                  : 'bg-[#111111] text-white/45 hover:bg-white/10'
              }`}
            >
              <span className={`text-[11px] font-bold uppercase tracking-wider ${active ? 'text-white/70' : 'text-white/25'}`}>
                Day {d.day}
              </span>
              <span className="text-[13px] font-semibold mt-0.5 leading-tight text-center">{d.name}</span>
            </Link>
          );
        })}
      </div>

      <WorkoutLogger day={day} />
    </div>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-[#111111] rounded-2xl" />}>
      <WorkoutContent />
    </Suspense>
  );
}
