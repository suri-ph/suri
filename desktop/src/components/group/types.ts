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
  onRegistrationSourceChange?: (source: "upload" | "camera" | null) => void; // Callback when registration source changes
  registrationSource?: "upload" | "camera" | null; // Current registration source state
  onRegistrationModeChange?: (mode: "single" | "bulk" | "queue" | null) => void; // Callback when registration mode changes
  registrationMode?: "single" | "bulk" | "queue" | null; // Current registration mode state
  deselectMemberTrigger?: number; // When this changes, deselect the member in FaceCapture
  onHasSelectedMemberChange?: (hasSelectedMember: boolean) => void; // Callback when member selection changes
}
