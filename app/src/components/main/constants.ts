type LivenessStatus = "real" | "spoof" | "error" | "move_closer";

export const NON_LOGGING_ANTISPOOF_STATUSES = new Set<LivenessStatus>([
  "spoof",
  "error",
  "move_closer",
]);

export const TRACKING_HISTORY_LIMIT = 20;
