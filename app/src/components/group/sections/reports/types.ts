import type { AttendanceSession } from "../../../../types/recognition";

export type ColumnKey =
  | "name"
  | "date"
  | "check_in_time"
  | "status"
  | "is_late"
  | "late_minutes"
  | "notes";

export type GroupByKey = "none" | "person" | "date";

export type ReportStatusFilter = "all" | "present" | "absent" | "no_records";

export interface SavedViewConfig {
  name: string;
  columns: ColumnKey[];
  groupBy: GroupByKey;
  statusFilter: ReportStatusFilter;
  search: string;
}

export interface RowData {
  person_id: string;
  name: string;
  date: string;
  check_in_time?: Date;
  status: ReportStatusFilter;
  is_late: boolean;
  late_minutes: number;
  notes: string;
  session: AttendanceSession | null;
}
