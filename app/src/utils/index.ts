export type {
  PersonWithName,
  HasPersonIdAndName,
  PersonWithDisplayName,
} from "@/utils/displayNameUtils.js";
export {
  generateDisplayNames,
  getDisplayName,
  createDisplayNameMap,
} from "@/utils/displayNameUtils.js";

export {
  getLocalDateString,
  parseLocalDate,
  generateDateRange,
} from "@/utils/dateUtils.js";

export type {
  AttendanceStatusDisplay,
  StatusConfig,
} from "@/utils/attendanceStatusUtils.js";
export {
  getStatusConfig,
  getStatusLabel,
  getStatusShortLabel,
  getStatusClassName,
  getStatusColor,
} from "@/utils/attendanceStatusUtils.js";
