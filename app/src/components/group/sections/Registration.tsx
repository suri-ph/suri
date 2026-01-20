import { useState, useEffect } from "react";

import { CameraQueue } from "./registration/CameraQueue";
import { BulkRegistration } from "./registration/BulkRegistration";
import { FaceCapture } from "../sections";
import type {
  AttendanceGroup,
  AttendanceMember,
} from "../../../types/recognition.js";

interface RegistrationProps {
  group: AttendanceGroup;
  members: AttendanceMember[];
  onRefresh: () => void;
  onSourceChange?: (source: "upload" | "camera" | null) => void;
  registrationSource?: "upload" | "camera" | null;
  onModeChange?: (mode: "single" | "bulk" | "queue" | null) => void;
  registrationMode?: "single" | "bulk" | "queue" | null;
  deselectMemberTrigger?: number;
  onHasSelectedMemberChange?: (hasSelectedMember: boolean) => void;
  onAddMember?: () => void;
}

type SourceType = "upload" | "camera" | null;
type RegistrationMode = "single" | "bulk" | "queue" | null;

export function Registration({
  group,
  members,
  onRefresh,
  onSourceChange,
  registrationSource,
  onModeChange,
  registrationMode,
  deselectMemberTrigger,
  onHasSelectedMemberChange,
  onAddMember,
}: RegistrationProps) {
  const [source, setSource] = useState<SourceType>(registrationSource || null);
  const [mode, setMode] = useState<RegistrationMode>(registrationMode || null);

  // Sync with parent state
  useEffect(() => {
    if (registrationSource !== undefined) {
      setSource(registrationSource);
    }
  }, [registrationSource]);

  useEffect(() => {
    if (registrationMode !== undefined) {
      setMode(registrationMode);
    }
  }, [registrationMode]);

  const handleSourceChange = (newSource: SourceType) => {
    setSource(newSource);
    if (onSourceChange) {
      onSourceChange(newSource);
    }
  };

  const handleModeChange = (newMode: RegistrationMode) => {
    setMode(newMode);
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  const handleBack = () => {
    if (mode) {
      setMode(null);
      if (onModeChange) {
        onModeChange(null);
      }
    } else {
      setSource(null);
      if (onSourceChange) {
        onSourceChange(null);
      }
    }
  };

  if (mode === "bulk" && source === "upload") {
    return (
      <BulkRegistration
        group={group}
        members={members}
        onRefresh={onRefresh}
        onClose={handleBack}
      />
    );
  }

  if (mode === "queue" && source === "camera") {
    return (
      <CameraQueue
        group={group}
        members={members}
        onRefresh={onRefresh}
        onClose={handleBack}
      />
    );
  }

  if (mode === "single" && source) {
    return (
      <FaceCapture
        group={group}
        members={members}
        onRefresh={onRefresh}
        initialSource={source === "camera" ? "live" : source}
        deselectMemberTrigger={deselectMemberTrigger}
        onSelectedMemberChange={onHasSelectedMemberChange}
      />
    );
  }

  if (members.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center justify-center space-y-3 max-w-md text-center">
          <div className="text-white/70 text-sm font-medium">
            Add your first member to start registration
          </div>
          <div className="text-white/40 text-xs">
            Create a member profile first so we can attach face data to it.
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
    );
  }

  if (!source) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg space-y-4">
          <div className="text-center text-white/60 text-sm">
            Choose how you want to capture faces for <span className="text-white">{group.name}</span>.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSourceChange("upload")}
              className="flex flex-col items-center gap-4 p-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <i className="fa-solid fa-cloud-arrow-up text-5xl text-white/80 mb-2"></i>
              <span className="text-base font-medium text-white">Upload</span>
            </button>

            <button
              onClick={() => handleSourceChange("camera")}
              className="flex flex-col items-center gap-4 p-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <i className="fa-solid fa-video text-5xl text-white/80 mb-2"></i>
              <span className="text-base font-medium text-white">Camera</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center text-white/60 text-sm">
          Pick a registration mode for <span className="text-white">{group.name}</span>.
        </div>
        <div className="grid gap-3">
          <button
            onClick={() => handleModeChange("single")}
            className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-center"
          >
            <span className="text-base font-medium text-white">Individual</span>
          </button>

          {source === "upload" && (
            <button
              onClick={() => handleModeChange("bulk")}
              className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-center"
            >
              <span className="text-base font-medium text-white">
                Batch Upload
              </span>
            </button>
          )}

          {source === "camera" && (
            <button
              onClick={() => handleModeChange("queue")}
              className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-center"
            >
              <span className="text-base font-medium text-white">
                Camera Queue
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
