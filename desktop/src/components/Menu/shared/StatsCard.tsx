interface StatsCardProps {
  type: 'present' | 'absent' | 'late';
  value: number;
  total?: number;
  label?: string;
}

export function StatsCard({ type, value, total, label }: StatsCardProps) {
  const config = {
    present: {
      color: 'emerald',
      label: label || 'Present Today',
      sublabel: total ? `out of ${total} members` : undefined,
      gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      border: 'border-emerald-500/20',
      textColor: 'text-emerald-200',
      subColor: 'text-emerald-100/40'
    },
    absent: {
      color: 'rose',
      label: label || 'Absent Today',
      sublabel: 'no check-in record',
      gradient: 'from-rose-500/20 via-rose-500/10 to-transparent',
      border: 'border-rose-500/20',
      textColor: 'text-rose-200',
      subColor: 'text-rose-100/40'
    },
    late: {
      color: 'amber',
      label: label || 'Late Today',
      sublabel: 'exceeded late threshold',
      gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
      border: 'border-amber-500/20',
      textColor: 'text-amber-200',
      subColor: 'text-amber-100/40'
    }
  }[type];

  return (
    <div className={`rounded-xl border ${config.border} bg-gradient-to-br ${config.gradient} p-4`}>
      <p className={`text-xs ${config.textColor} opacity-60 uppercase tracking-wider`}>
        {config.label}
      </p>
      <div className={`text-2xl font-semibold ${config.textColor} mt-1`}>{value ?? 0}</div>
      {config.sublabel && (
        <p className={`text-[10px] ${config.subColor} mt-1`}>{config.sublabel}</p>
      )}
    </div>
  );
}

