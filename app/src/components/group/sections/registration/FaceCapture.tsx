import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { attendanceManager } from "../../../../services";
import type {
  AttendanceGroup,
  AttendanceMember,
} from "../../../../types/recognition";
import { useCamera } from "./hooks/useCamera";
import { useFaceCapture } from "./hooks/useFaceCapture";
import type { CaptureSource } from "./types";

import { MemberSidebar } from "./components/MemberSidebar";
import { CaptureControls } from "./components/CaptureControls";
import { CameraFeed } from "./components/CameraFeed";
import { UploadArea } from "./components/UploadArea";
import { ResultView } from "./components/ResultView";

interface FaceCaptureProps {
  group: AttendanceGroup | null;
  members: AttendanceMember[];
  onRefresh?: () => Promise<void> | void;
  initialSource?: CaptureSource;
  deselectMemberTrigger?: number;
  onSelectedMemberChange?: (hasSelectedMember: boolean) => void;
}

export function FaceCapture({
  group,
  members,
  onRefresh,
  initialSource,
  deselectMemberTrigger,
  onSelectedMemberChange,
}: FaceCaptureProps) {
  // --- View State ---
  const [source, setSource] = useState<CaptureSource>(
    initialSource ?? "upload",
  );
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState<
    "all" | "registered" | "non-registered"
  >("all");
  const [memberStatus, setMemberStatus] = useState<Map<string, boolean>>(
    new Map(),
  );

  // --- Hooks ---
  const {
    videoRef,
    cameraDevices,
    selectedCamera,
    setSelectedCamera,
    isStreaming,
    isVideoReady,
    cameraError,
    startCamera,
    stopCamera,
  } = useCamera();

  const {
    frames,
    globalError,
    successMessage,
    isRegistering,
    setGlobalError,
    setSuccessMessage,
    resetFrames,
    captureProcessedFrame,
    handleRegister,
    handleRemoveFaceData,
  } = useFaceCapture(group, members, onRefresh);

  // --- Member Status Management ---
  const loadMemberStatus = useCallback(async () => {
    if (!group) {
      setMemberStatus(new Map());
      return;
    }
    try {
      const persons = await attendanceManager.getGroupPersons(group.id);
      const status = new Map<string, boolean>();
      persons.forEach((person) =>
        status.set(person.person_id, person.has_face_data),
      );
      setMemberStatus(status);
    } catch (error) {
      console.error("Failed to load member registration status:", error);
    }
  }, [group]);

  useEffect(() => {
    loadMemberStatus();
  }, [loadMemberStatus]);

  // --- Selection Lifecycle ---
  // Notify parent of selection change
  useEffect(() => {
    if (onSelectedMemberChange) {
      onSelectedMemberChange(!!selectedMemberId);
    }
  }, [selectedMemberId, onSelectedMemberChange]);

  // Handle external deselect trigger
  const deselectedMemberTriggerRef = useRef(deselectMemberTrigger ?? 0);
  useEffect(() => {
    if (
      deselectMemberTrigger !== undefined &&
      deselectedMemberTriggerRef.current !== deselectMemberTrigger
    ) {
      deselectedMemberTriggerRef.current = deselectMemberTrigger;
      if (selectedMemberId) {
        setSelectedMemberId("");
        resetFrames();
      }
    }
  }, [deselectMemberTrigger, selectedMemberId, resetFrames]);

  // Verify selection validity when group/members change
  useEffect(() => {
    if (!group) {
      setSelectedMemberId("");
      resetFrames();
      setSuccessMessage(null);
      setGlobalError(null);
      return;
    }
    if (selectedMemberId) {
      const memberExists = members.some(
        (m) => m.person_id === selectedMemberId,
      );
      if (!memberExists) {
        setSelectedMemberId("");
        resetFrames();
        setSuccessMessage(null);
        setGlobalError(null);
      }
    }
  }, [
    group,
    resetFrames,
    members,
    selectedMemberId,
    setGlobalError,
    setSuccessMessage,
  ]);

  // Stop camera when switching modes
  useEffect(() => {
    if (source !== "live") {
      stopCamera();
    }
  }, [source, stopCamera]);

  // --- Actions ---
  const handleCaptureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    await captureProcessedFrame("Front", dataUrl, canvas.width, canvas.height);
    stopCamera();
  }, [captureProcessedFrame, stopCamera, videoRef]);

  const handleWrapperRegister = useCallback(() => {
    handleRegister(selectedMemberId, loadMemberStatus, memberStatus);
  }, [handleRegister, selectedMemberId, loadMemberStatus, memberStatus]);

  const handleWrapperRemoveData = useCallback(
    (member: AttendanceMember & { displayName: string }) => {
      handleRemoveFaceData(member, loadMemberStatus);
    },
    [handleRemoveFaceData, loadMemberStatus],
  );

  const resetWorkflow = useCallback(() => {
    resetFrames();
    setSuccessMessage(null);
    setGlobalError(null);
    // If we retake, wait, we might want to restart camera if it was live?
    // Current behavior in filtered logic: if retake, we just clear frames.
    // If source is live, the user can hit Start Camera again.
  }, [resetFrames, setSuccessMessage, setGlobalError]);

  // --- Derived ---
  const framesReady = (() => {
    const frame = frames.find((item) => item.angle === "Front");
    return frame && (frame.status === "ready" || frame.status === "registered");
  })();

  const selectedMemberName = useMemo(() => {
    const m = members.find((m) => m.person_id === selectedMemberId);
    return m ? m.name || "Member" : ""; // Use name, or we can use generated display name if passed down, but MemberSidebar generates it internally.
    // We should probably rely on MemberSidebar passing the display name or regenerate it here.
    // We'll regenerate simply.
  }, [members, selectedMemberId]);

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Messages */}
      {successMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-sm px-4 py-3 text-sm text-cyan-200 flex items-center gap-3 min-w-[500px] max-w-[95%] intro-y">
          <span className="flex-1">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-cyan-200/50 hover:text-cyan-100 transition-colors flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      {globalError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200 flex items-center gap-3 flex-shrink-0 mx-6 mt-6">
          <span className="flex-1">{globalError}</span>
          <button
            onClick={() => setGlobalError(null)}
            className="text-red-200/50 hover:text-red-100 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-0">
        {!selectedMemberId && (
          <MemberSidebar
            members={members}
            memberStatus={memberStatus}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            memberSearch={memberSearch}
            setMemberSearch={setMemberSearch}
            registrationFilter={registrationFilter}
            setRegistrationFilter={setRegistrationFilter}
            onRemoveFaceData={handleWrapperRemoveData}
          />
        )}

        {selectedMemberId && (
          <div className="flex flex-col h-full overflow-hidden p-6 space-y-2">
            <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden">
              {!initialSource && (
                <CaptureControls
                  source={source}
                  setSource={setSource}
                  hasRequiredFrame={!!framesReady}
                  cameraDevices={cameraDevices}
                  selectedCamera={selectedCamera}
                  setSelectedCamera={setSelectedCamera}
                  isStreaming={isStreaming}
                  stopCamera={stopCamera}
                />
              )}

              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {!framesReady ? (
                  source === "live" ? (
                    <CameraFeed
                      videoRef={videoRef}
                      isStreaming={isStreaming}
                      isVideoReady={isVideoReady}
                      cameraError={cameraError}
                      onCapture={handleCaptureFromCamera}
                      onStart={startCamera}
                      onStop={stopCamera}
                      source={source}
                      isCameraSelected={!!selectedCamera}
                    />
                  ) : (
                    <UploadArea
                      onFileProcessed={(url, w, h) =>
                        captureProcessedFrame("Front", url, w, h)
                      }
                      onError={setGlobalError}
                    />
                  )
                ) : (
                  <ResultView
                    frames={frames}
                    selectedMemberName={selectedMemberName}
                    onRetake={resetWorkflow}
                    onRegister={handleWrapperRegister}
                    isRegistering={isRegistering}
                    framesReady={!!framesReady}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
