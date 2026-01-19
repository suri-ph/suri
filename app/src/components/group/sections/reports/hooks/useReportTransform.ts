import { useMemo } from "react";
import { generateDateRange, createDisplayNameMap } from "../../../../../utils";
import type {
  AttendanceSession,
  AttendanceMember,
  AttendanceReport,
} from "../../../../../types/recognition";
import type { RowData, GroupByKey, ReportStatusFilter } from "../types";

export function useReportTransform(
  members: AttendanceMember[],
  sessions: AttendanceSession[],
  report: AttendanceReport | null,
  startDateStr: string,
  endDateStr: string,
  groupBy: GroupByKey,
  statusFilter: ReportStatusFilter,
  search: string,
) {
  // Build table rows from sessions + members
  const displayNameMap = useMemo(() => {
    return createDisplayNameMap(members);
  }, [members]);

  // Create a map of sessions by person_id and date for quick lookup
  const sessionsMap = useMemo(() => {
    const map = new Map<string, AttendanceSession>();
    sessions.forEach((s) => {
      const key = `${s.person_id}_${s.date}`;
      map.set(key, s);
    });
    return map;
  }, [sessions]);

  const filteredRows = useMemo(() => {
    const allDates = generateDateRange(startDateStr, endDateStr);
    const rows: RowData[] = [];

    for (const member of members) {
      let memberJoinedAt: Date | null = null;
      if (member.joined_at instanceof Date) {
        memberJoinedAt = member.joined_at;
      } else if (member.joined_at) {
        memberJoinedAt = new Date(member.joined_at);
        if (Number.isNaN(memberJoinedAt.getTime())) {
          memberJoinedAt = null;
        }
      }

      if (memberJoinedAt) {
        memberJoinedAt.setHours(0, 0, 0, 0);
      }

      for (const date of allDates) {
        const dateObj = new Date(date);
        dateObj.setHours(0, 0, 0, 0);
        const isBeforeJoined = memberJoinedAt && dateObj < memberJoinedAt;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isFutureEnrollment = memberJoinedAt && memberJoinedAt > today;
        const isFutureDate = dateObj > today;

        const shouldShowNoRecords =
          isBeforeJoined || isFutureEnrollment || isFutureDate;

        const sessionKey = `${member.person_id}_${date}`;
        const session = sessionsMap.get(sessionKey) || null;

        let finalSession: AttendanceSession | null = null;
        if (shouldShowNoRecords) {
          finalSession = null;
        } else if (session) {
          finalSession = session;
        } else {
          finalSession = null;
        }

        let status: ReportStatusFilter;
        if (shouldShowNoRecords) {
          status = "no_records";
        } else if (!finalSession) {
          status = "absent";
        } else {
          // Map session status to ReportStatusFilter.
          status = finalSession.status as ReportStatusFilter;
        }

        rows.push({
          person_id: member.person_id,
          name: displayNameMap.get(member.person_id) || "Unknown",
          date: date,
          check_in_time: finalSession?.check_in_time,
          status: status,
          is_late: finalSession?.is_late || false,
          late_minutes: finalSession?.late_minutes ?? 0,
          notes: finalSession?.notes || "",
          session: finalSession,
        });
      }
    }

    return rows.filter((r) => {
      if (statusFilter !== "all") {
        if (statusFilter === "present") {
          // Include 'late' in 'present' filter usually?
          // Or exact match.
          // In original code: `if (r.status !== statusFilter) return false;`
          // So if status is 'late', and filter is 'present', it hides it?
          // That might be a bug in original or intended.
          // Let's stick to original behavior: exact match.
          // If session status is 'late', it won't show in 'present' filter unless we map it.
          if (r.status !== statusFilter) return false;
        } else {
          if (r.status !== statusFilter) return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.name} ${r.status} ${r.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    sessionsMap,
    members,
    displayNameMap,
    statusFilter,
    search,
    startDateStr,
    endDateStr,
  ]);

  const groupedRows = useMemo(() => {
    if (groupBy === "none")
      return { __all__: filteredRows } as Record<string, typeof filteredRows>;
    const groups: Record<string, typeof filteredRows> = {};
    for (const r of filteredRows) {
      const key = groupBy === "person" ? `${r.name}` : r.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [filteredRows, groupBy]);

  const daysTracked = useMemo(() => {
    if (report?.summary?.total_working_days !== undefined) {
      return report.summary.total_working_days;
    }
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [report, startDateStr, endDateStr]);

  return {
    filteredRows,
    groupedRows,
    daysTracked,
    allColumns: [
      { key: "name", label: "Name", align: "left" },
      { key: "date", label: "Date", align: "left" },
      { key: "status", label: "Status", align: "center" },
      { key: "check_in_time", label: "Time In", align: "center" },
      { key: "is_late", label: "Late", align: "center" },
      { key: "late_minutes", label: "Minutes Late", align: "center" },
      { key: "notes", label: "Notes", align: "left" },
    ] as const,
  };
}
