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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4 text-red-400">⚠️ Delete Group</h3>

        <div className="mb-6">
          <p className="text-white mb-4">
            Are you sure you want to delete the group{" "}
            <strong>"{groupToDelete.name}"</strong>?
          </p>
          <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mb-4">
            <p className="text-red-300 text-sm">
              <strong>Warning:</strong> This action cannot be undone. All group
              data, members, and attendance records will be permanently removed.
            </p>
          </div>
          {currentGroup?.id === groupToDelete.id && (
            <div className="bg-orange-900/20 border border-orange-500/30 rounded p-3">
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
            className="flex-1 px-4 py-2 bg-gray-600 rounded"
          >
            Cancel
          </button>
          <button
            onClick={confirmDeleteGroup}
            className="flex-1 px-4 py-2 bg-red-600 rounded"
          >
            Delete Group
          </button>
        </div>
      </div>
    </div>
  );
}
