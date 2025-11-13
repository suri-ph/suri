import type { AttendanceGroup } from "../../types/recognition";

export type GroupSection =
  | "overview"
  | "members"
  | "reports"
  | "registration"
  | "settings";

export interface GroupPanelProps {
  onBack: () => void;
  initialSection?: GroupSection;
  initialGroup?: AttendanceGroup | null; // Pre-select this group when GroupPanel opens
  onGroupsChanged?: (newGroup?: AttendanceGroup) => void; // Callback when groups are created/deleted, optionally with newly created group
  isEmbedded?: boolean; // Whether GroupPanel is embedded in Settings or standalone
  triggerCreateGroup?: number; // When set to a timestamp, opens create group modal
}
