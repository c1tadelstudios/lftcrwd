'use client';

import { useState, useEffect } from 'react';
import { supabase, getOrCreateDailyLog, today, type DailyLog } from '@/lib/supabase';
import { DAILY_TARGETS } from '@/lib/plan';

const GALLON_OZ = 128;

export default function DailyChecklist() {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getOrCreateDailyLog(today()).then((l) => {
      setLog(l);
      setLoading(false);
    });
  }, []);

  async function resetToday() {
    if (!log) return;
    if (!confirm('Reset all of today\'s progress to zero?')) return;
    setResetting(true);
    const zeros = {
      protein_g: 0,
      water_oz: 0,
      creatine: false,
      cardio_done: false,
      cardio_minutes: 0,
      steps: 0,
      weight_lbs: null as number | null,
      cheat_meal_used: false,
    };
    const { error } = await supabase.from('daily_logs').update(zeros).eq('id', log.id);
    if (error) {
      alert('Reset failed: ' + error.message);
    } else {
      setLog({ ...log, ...zeros });
    }
    setResetting(false);
  }

  async function update(fields: Partial<DailyLog>) {
    if (!log) return;
    const updated = { ...log, ...fields };
    setLog(updated);
    await supabase.from('daily_logs').update(fields).eq('id', log.id);
  }

  if (loading) return <div className="animate-pulse h-48 bg-zinc-800 rounded-2xl" />;
  if (!log) return null;

  const waterPct = Math.min(100, Math.round((log.water_oz / GALLON_OZ) * 100));
  const proteinPct = Math.min(100, Math.round((log.protein_g / DAILY_TARGETS.proteinG) * 100));

  return (
    <div className="space-y-3">
      {/* Protein */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-zinc-300">Protein</span>
          <span className="text-sm text-zinc-400">{log.protein_g} / {DAILY_TARGETS.proteinG}g</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${proteinPct}%` }} />
        </div>
        <div className="flex gap-2">
          {[20, 30, 40, 50].map((g) => (
            <button
              key={g}
              onClick={() => update({ protein_g: Math.min(log.protein_g + g, 300) })}
              className="flex-1 py-1.5 bg-zinc-700 hover:bg-orange-500 rounded-lg text-xs font-medium transition-colors"
            >
              +{g}g
            </button>
          ))}
        </div>
      </div>

      {/* Water */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-zinc-300">Water</span>
          <span className="text-sm text-zinc-400">{(log.water_oz / GALLON_OZ).toFixed(2)} / 1 gal</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${waterPct}%` }} />
        </div>
        <div className="flex gap-2">
          {[8, 16, 24, 32].map((oz) => (
            <button
              key={oz}
              onClick={() => update({ water_oz: Math.min(log.water_oz + oz, 200) })}
              className="flex-1 py-1.5 bg-zinc-700 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors"
            >
              +{oz}oz
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-3">
        <Toggle
          label="Creatine 5g"
          checked={log.creatine}
          onChange={(v) => update({ creatine: v })}
          color="purple"
        />
        <Toggle
          label="Cardio Done"
          checked={log.cardio_done}
          onChange={(v) => update({ cardio_done: v })}
          color="green"
        />
      </div>

      {/* Steps */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-zinc-300">Steps</span>
          <span className="text-sm text-zinc-400">{(log.steps ?? 0).toLocaleString()} / {DAILY_TARGETS.steps.max.toLocaleString()}</span>
        </div>
        <input
          type="number"
          value={log.steps || ''}
          onChange={(e) => update({ steps: parseInt(e.target.value) || 0 })}
          placeholder="Enter step count"
          className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {/* Weight */}
      <div className="bg-zinc-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-zinc-300">Body Weight</span>
          <span className="text-sm text-zinc-400">{log.weight_lbs ? `${log.weight_lbs} lbs` : '—'}</span>
        </div>
        <input
          type="number"
          step="0.1"
          value={log.weight_lbs || ''}
          onChange={(e) => update({ weight_lbs: parseFloat(e.target.value) || null })}
          placeholder="lbs (optional)"
          className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {/* Reset */}
      <button
        onClick={resetToday}
        disabled={resetting}
        className="w-full py-2 text-xs text-zinc-600 hover:text-red-400 transition-colors"
      >
        {resetting ? 'Resetting...' : 'Reset today'}
      </button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: 'purple' | 'green';
}) {
  const colors = {
    purple: 'bg-purple-600',
    green: 'bg-green-600',
  };
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`p-4 rounded-2xl text-left transition-colors ${
        checked ? colors[color] : 'bg-zinc-800'
      }`}
    >
      <div className="text-xl mb-1">{checked ? '✓' : '○'}</div>
      <div className="text-sm font-medium">{label}</div>
    </button>
  );
}
