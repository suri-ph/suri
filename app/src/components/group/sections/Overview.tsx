import { useState, useEffect, useCallback, useMemo } from "react";
import { attendanceManager } from "@/services";
import { getLocalDateString, createDisplayNameMap } from "@/utils";
import { StatsCard } from "@/components/group/shared";
import type {
  AttendanceGroup,
  AttendanceMember,
  AttendanceStats,
  AttendanceRecord,
  AttendanceSession,
} from "@/types/recognition.js";

interface OverviewProps {
  group: AttendanceGroup;
  members: AttendanceMember[];
  onAddMember?: () => void;
}

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const formatTime = (value: Date | string): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value: Date | string): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
};

export function Overview({ group, members, onAddMember }: OverviewProps) {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [activeNow, setActiveNow] = useState<number>(0);

  const displayNameMap = useMemo(() => {
    return createDisplayNameMap(members);
  }, [members]);

  const loadOverviewData = useCallback(async () => {
    if (members.length === 0) {
      return;
    }

    try {
      const todayStr = getLocalDateString();
      const [groupStats, records, sessions] = await Promise.all([
        attendanceManager.getGroupStats(group.id, new Date()),
        attendanceManager.getRecords({
          group_id: group.id,
          limit: 100,
        }),
        attendanceManager.getSessions({
          group_id: group.id,
          start_date: todayStr,
          end_date: todayStr,
        }),
      ]);

      setStats(groupStats);
      setRecentRecords(records);
      const activeCount = (sessions as AttendanceSession[]).filter(
        (s) => s.status === "present",
      ).length;
      setActiveNow(activeCount);
    } catch (err) {
      console.error("Error loading overview data:", err);
    }
  }, [group.id, members.length]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  if (members.length === 0) {
    return (
      <section className="h-full flex flex-col overflow-hidden p-6">
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-md text-center">
            <div className="text-white/70 text-sm font-medium">
              No members yet
            </div>
            <div className="text-white/40 text-xs">
              Add members to start seeing live attendance stats and activity.
            </div>
            {onAddMember && (
              <button
                onClick={onAddMember}
                className="px-4 py-2 text-xs bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded text-white/70 hover:text-white/90 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-user-plus text-xs"></i>
                Add Member
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="flex items-center justify-center py-12">
        <div className="text-white/40 text-sm">Loading overview...</div>
      </section>
    );
  }

  return (
    <section className="space-y-4 h-full flex flex-col overflow-hidden p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <StatsCard type="active" value={activeNow} label="Active Now" />
        <StatsCard
          type="present"
          value={stats.present_today}
          total={stats.total_members}
          label="Timed-in Today"
        />
        <StatsCard
          type="absent"
          value={Math.max(
            0,
            (stats.total_members ?? 0) - (stats.present_today ?? 0),
          )}
          label="Not yet timed-in"
        />
        <StatsCard type="late" value={stats.late_today} label="Late arrivals" />
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 overflow-hidden flex-1 flex flex-col min-h-0">
        <h3 className="text-sm font-semibold mb-3 flex-shrink-0">
          Recent activity
        </h3>
        <div className="flex-1 overflow-y-auto custom-scroll overflow-x-hidden pr-2 space-y-2 text-sm">
          {recentRecords.length > 0 ? (
            recentRecords.slice(0, 24).map((record) => {
              const displayName =
                displayNameMap.get(record.person_id) || "Unknown";
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                >
                  <div>
                    <div className="font-medium text-white text-sm">
                      {displayName}
                    </div>
                    <div className="text-xs text-white/40">
                      {formatDate(record.timestamp)} ·{" "}
                      {formatTime(record.timestamp)}
                    </div>
                  </div>
                  <div className="text-xs text-white/40">
                    {(record.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-white/40 text-xs py-6 text-center">
              No activity
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
