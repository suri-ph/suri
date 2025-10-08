import { useState, useEffect, useCallback } from 'react';
import { attendanceManager } from '../../../services/AttendanceManager';
import { StatsCard } from '../shared/StatsCard';
import type {
  AttendanceGroup,
  AttendanceMember,
  AttendanceStats,
  AttendanceRecord
} from '../../../types/recognition.js';

interface OverviewProps {
  group: AttendanceGroup;
  members: AttendanceMember[];
}

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

const formatTime = (value: Date | string): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function Overview({ group, members }: OverviewProps) {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);

  const loadOverviewData = useCallback(async () => {
    try {
      const [groupStats, records] = await Promise.all([
        attendanceManager.getGroupStats(group.id, new Date()),
        attendanceManager.getRecords({
          group_id: group.id,
          limit: 100
        })
      ]);

      setStats(groupStats);
      setRecentRecords(records);
    } catch (err) {
      console.error('Error loading overview data:', err);
    }
  }, [group.id]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  if (!stats) {
    return (
      <section className="flex items-center justify-center py-12">
        <div className="text-white/40 text-sm">Loading overview...</div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatsCard type="present" value={stats.present_today} total={stats.total_members} />
        <StatsCard type="absent" value={stats.absent_today} />
        <StatsCard type="late" value={stats.late_today} />
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Recent activity</h3>
        <div className="max-h-64 overflow-y-auto pr-2 space-y-2 text-sm">
          {recentRecords.length > 0 ? (
            recentRecords.slice(0, 24).map(record => {
              const member = members.find(item => item.person_id === record.person_id);
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                >
                  <div>
                    <div className="font-medium text-white text-sm">{member?.name ?? record.person_id}</div>
                    <div className="text-xs text-white/40">
                      {toDate(record.timestamp).toLocaleDateString()} · {formatTime(record.timestamp)}
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{(record.confidence * 100).toFixed(0)}%</div>
                </div>
              );
            })
          ) : (
            <div className="text-white/40 text-xs py-6 text-center">No activity</div>
          )}
        </div>
      </div>
    </section>
  );
}

