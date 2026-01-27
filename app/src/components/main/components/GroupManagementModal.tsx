import { useEffect, useRef } from "react";
import type { AttendanceGroup } from "@/components/main/types";
import { FormInput } from "@/components/common";

interface GroupManagementModalProps {
  showGroupManagement: boolean;
  setShowGroupManagement: (show: boolean) => void;
  attendanceGroups: AttendanceGroup[];
  currentGroup: AttendanceGroup | null;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  handleCreateGroup: () => void;
  handleSelectGroup: (group: AttendanceGroup) => void;
  handleDeleteGroup: (group: AttendanceGroup) => void;
}

export function GroupManagementModal({
  showGroupManagement,
  setShowGroupManagement,
  attendanceGroups,
  currentGroup,
  newGroupName,
  setNewGroupName,
  handleCreateGroup,
  handleSelectGroup,
  handleDeleteGroup,
}: GroupManagementModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens (with delay for Electron focus handling)
  useEffect(() => {
    if (showGroupManagement && inputRef.current) {
      // Use requestAnimationFrame for better timing, then setTimeout for Electron
      const focusInput = () => {
        if (inputRef.current) {
          // Multiple focus attempts for Electron compatibility
          inputRef.current.focus();
          inputRef.current.select();
          // Force a click event to ensure Electron recognizes the focus
          inputRef.current.click();
        }
      };

      // First attempt after render
      requestAnimationFrame(() => {
        focusInput();
        // Second attempt after a short delay (Electron sometimes needs this)
        setTimeout(focusInput, 50);
        // Third attempt after longer delay (for stubborn Electron windows)
        setTimeout(focusInput, 150);
      });

      return () => {
        // Cleanup not needed but good practice
      };
    }
  }, [showGroupManagement]);

  if (!showGroupManagement) return null;

  // Prevent click events from propagating to overlay
  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Close modal when clicking overlay
  const handleOverlayClick = () => {
    setShowGroupManagement(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-[#0f0f0f] border border-white/10 rounded-3xl p-4 sm:p-6 w-full max-w-lg max-h-[80vh] flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
        onClick={handleModalContentClick}
      >
        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 pr-1 -mr-1 overflow-hidden">
          {/* Create New Group */}
          <div className="mb-4 sm:mb-6">
            <h4 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-white">
              Create New Group
            </h4>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-white/60">
                  Group Name:
                </label>
                <FormInput
                  ref={inputRef}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  focusColor="border-cyan-500/60"
                />
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="btn-success w-full px-4 py-2 text-sm sm:text-base disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          </div>

          {/* Existing Groups */}
          {attendanceGroups.length > 0 && (
            <div className="mb-3 sm:mb-4">
              <div className="space-y-2 overflow-y-auto max-h-[calc(80vh-350px)]">
                {attendanceGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-white">
                        {group.name}
                      </span>
                      {group.description && (
                        <div className="text-sm text-white/60">
                          {group.description}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSelectGroup(group)}
                        className={`px-3 py-1 rounded text-sm ${
                          currentGroup?.id === group.id
                            ? "btn-accent"
                            : "btn-secondary"
                        }`}
                      >
                        {currentGroup?.id === group.id ? "Active" : "Select"}
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group)}
                        className="btn-error px-3 py-1 text-sm"
                        title="Delete Group"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="flex gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => setShowGroupManagement(false)}
            className="btn-secondary flex-1 px-4 py-2 text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
