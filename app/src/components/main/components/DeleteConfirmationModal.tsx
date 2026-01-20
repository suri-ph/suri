import type { AttendanceGroup } from "../types";

interface DeleteConfirmationModalProps {
  showDeleteConfirmation: boolean;
  groupToDelete: AttendanceGroup | null;
  currentGroup: AttendanceGroup | null;
  cancelDeleteGroup: () => void;
  confirmDeleteGroup: () => void;
}

export function DeleteConfirmationModal({
  showDeleteConfirmation,
  groupToDelete,
  currentGroup,
  cancelDeleteGroup,
  confirmDeleteGroup,
}: DeleteConfirmationModalProps) {
  if (!showDeleteConfirmation || !groupToDelete) return null;

  const handleOverlayClick = () => {
    cancelDeleteGroup();
  };

  const handleModalClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-[#0f0f0f] border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        onClick={handleModalClick}
      >
        <h3 className="text-lg font-semibold mb-3 text-red-200 flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation"></i>
          Delete group
        </h3>

        <div className="mb-6">
          <p className="text-white mb-4">
            Are you sure you want to delete the group{" "}
            <strong>"{groupToDelete.name}"</strong>?
          </p>
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">
              <strong>Warning:</strong> This action cannot be undone. All group
              data, members, and attendance records will be permanently removed.
            </p>
          </div>
          {currentGroup?.id === groupToDelete.id && (
            <div className="bg-orange-900/30 border border-orange-500/40 rounded-lg p-3">
              <p className="text-orange-300 text-sm">
                <strong>Note:</strong> This is your currently active group.
                Deleting it will clear your current selection.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={cancelDeleteGroup}
            className="flex-1 px-4 py-2 rounded-md bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmDeleteGroup}
            className="flex-1 px-4 py-2 rounded-md bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition-colors"
          >
            Delete Group
          </button>
        </div>
      </div>
    </div>
  );
}
