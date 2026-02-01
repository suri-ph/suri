import type { AttendanceMember } from "@/types/recognition";

interface DeleteMemberModalProps {
  isOpen: boolean;
  member: AttendanceMember | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMemberModal({
  isOpen,
  member,
  onClose,
  onConfirm,
}: DeleteMemberModalProps) {
  if (!isOpen || !member) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f0f] border border-white/10 p-6 rounded-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3 text-red-200 flex items-center gap-2">
          <i className="fa-solid fa-user-xmark"></i>
          Remove Member
        </h3>

        <div className="mb-6">
          <p className="text-white mb-4">
            Are you sure you want to remove <strong>"{member.name}"</strong>{" "}
            from this group?
          </p>
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3">
            <p className="text-red-300 text-sm">
              <strong>Warning:</strong> This will also wipe their attendance
              records and registered face data for this group.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition-colors"
          >
            Remove Member
          </button>
        </div>
      </div>
    </div>
  );
}
