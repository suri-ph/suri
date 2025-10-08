import { useState, useEffect, useCallback } from 'react';
import { attendanceManager } from '../../../services/AttendanceManager';
import type {
  AttendanceGroup,
  AttendanceMember,
  AttendanceSession
} from '../../../types/recognition.js';

interface MembersProps {
  group: AttendanceGroup;
  members: AttendanceMember[];
  onMembersChange: () => void;
  onEdit: (member: AttendanceMember) => void;
  onAdd: () => void;
}

export function Members({ group, members, onMembersChange, onEdit, onAdd }: MembersProps) {
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const sessions = await attendanceManager.getSessions({
        group_id: group.id,
        start_date: todayStr,
        end_date: todayStr
      });
      setTodaySessions(sessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  }, [group.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRemoveMember = async (personId: string) => {
    if (!confirm('Remove this member from the group?')) {
      return;
    }

    try {
      await attendanceManager.removeMember(personId);
      onMembersChange();
    } catch (err) {
      console.error('Error removing member:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members</h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-400/40 text-green-100 hover:bg-green-500/30 transition-colors text-xs"
        >
          Add member
        </button>
      </div>

      {members.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {members.map(member => {
            const session = todaySessions.find(item => item.person_id === member.person_id);

            const statusLabel = session?.status === 'present'
              ? 'Present'
              : session?.status === 'late'
                ? `Late (${session.late_minutes ?? 0}m)`
                : session?.status === 'checked_out'
                  ? 'Checked out'
                  : session?.status === 'absent'
                    ? 'Absent'
                    : 'No record';

            const statusClass = session?.status === 'present'
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
              : session?.status === 'late'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                : session?.status === 'checked_out'
                  ? 'bg-white/10 text-white/70 border border-white/20'
                  : 'bg-rose-500/20 text-rose-200 border border-rose-400/40';

            return (
              <div key={member.person_id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold truncate">{member.name}</div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {member.role && <span>{member.role} · </span>}
                      <span className="text-white/30">{member.person_id}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusClass}`}>
                    {statusLabel}
                  </div>
                </div>

                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => onEdit(member)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-100 hover:bg-blue-500/30 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.person_id)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

