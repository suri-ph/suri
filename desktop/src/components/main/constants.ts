type LivenessStatus = "live" | "spoof" | "error" | "too_small";

export const NON_LOGGING_ANTISPOOF_STATUSES = new Set<LivenessStatus>([
  "spoof",
  "error",
  "too_small",
]);

export const TRACKING_HISTORY_LIMIT = 20;
