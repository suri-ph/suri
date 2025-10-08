import { useState } from 'react';
import { FaceRegistrationLab } from '../../FaceRegistrationLab';
import { BulkFaceRegistration } from '../../BulkFaceRegistration';
import { AssistedCameraRegistration } from '../../AssistedCameraRegistration';
import type {
  AttendanceGroup,
  AttendanceMember
} from '../../../types/recognition.js';

interface RegistrationProps {
  group: AttendanceGroup;
  members: AttendanceMember[];
  onRefresh: () => void;
}

export function Registration({ group, members, onRefresh }: RegistrationProps) {
  const [showBulkRegistration, setShowBulkRegistration] = useState(false);
  const [showCameraQueue, setShowCameraQueue] = useState(false);

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Face registration</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkRegistration(true)}
              className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-400/40 text-purple-100 hover:bg-purple-500/30 transition-colors text-xs"
            >
              📁 Bulk
            </button>
            <button
              onClick={() => setShowCameraQueue(true)}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/30 transition-colors text-xs"
            >
              🎥 Camera
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <FaceRegistrationLab
            group={group}
            members={members}
            onRefresh={onRefresh}
          />
        </div>
      </section>

      {/* Bulk Registration Modal */}
      {showBulkRegistration && (
        <BulkFaceRegistration
          group={group}
          members={members}
          onRefresh={onRefresh}
          onClose={() => setShowBulkRegistration(false)}
        />
      )}

      {/* Assisted Camera Queue Modal */}
      {showCameraQueue && (
        <AssistedCameraRegistration
          group={group}
          members={members}
          onRefresh={onRefresh}
          onClose={() => setShowCameraQueue(false)}
        />
      )}
    </>
  );
}

