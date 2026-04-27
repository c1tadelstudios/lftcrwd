import { STATUS_LABELS, STATUS_COLORS, type AvailabilityStatus } from '@/lib/supabase';

export default function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/8">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span style={{ color }}>{label}</span>
    </span>
  );
}
