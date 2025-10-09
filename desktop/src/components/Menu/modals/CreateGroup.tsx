import { useState } from 'react';
import { attendanceManager } from '../../../services/AttendanceManager.js';
import type { GroupType, AttendanceGroup } from '../../../types/recognition.js';

interface CreateGroupProps {
  onClose: () => void;
  onSuccess: (group: AttendanceGroup) => void;
}

export function CreateGroup({ onClose, onSuccess }: CreateGroupProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('general');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      return;
    }

    setLoading(true);
    try {
      const newGroup = await attendanceManager.createGroup(
        name.trim(),
        type,
        description.trim() || undefined
      );
      onSuccess(newGroup);
      onClose();
    } catch (err) {
      console.error('Error creating group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 px-4">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
        <h3 className="text-xl font-semibold mb-2">Create New Group</h3>
        <p className="text-sm text-white/60 mb-4">Set up a new attendance group</p>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-600/20 border border-red-500/40 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          <label className="text-sm">
            <span className="text-white/60 block mb-2">Group name *</span>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500/60"
              placeholder="e.g. CS101 Section A, Engineering Team"
            />
          </label>

          <label className="text-sm">
            <span className="text-white/60 block mb-2">Group type *</span>
            <select
              value={type}
              onChange={event => setType(event.target.value as GroupType)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500/60"
            >
              <option value="general" className="bg-black">👥 General</option>
              <option value="student" className="bg-black">🎓 Student</option>
              <option value="employee" className="bg-black">👔 Employee</option>
              <option value="visitor" className="bg-black">👤 Visitor</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="text-white/60 block mb-2">Description (optional)</span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500/60 min-h-[80px]"
              placeholder="Brief description of this group..."
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30 transition-colors text-sm disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

