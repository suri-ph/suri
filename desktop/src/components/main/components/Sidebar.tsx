import type { AttendanceGroup, AttendanceMember, AttendanceRecord } from '../types';
import { AttendancePanel } from './AttendancePanel';
import { CooldownList } from './CooldownList';
import { DetectionPanel } from './DetectionPanel';

interface SidebarProps {
  // Detection props
  currentDetections: any;
  currentRecognitionResults: Map<number, any>;
  recognitionEnabled: boolean;
  trackedFaces: Map<string, any>;
  trackingMode: 'auto' | 'manual';
  handleManualLog: (personId: string, name: string, confidence: number) => void;
  
  // Cooldown props
  persistentCooldowns: Map<string, any>;
  attendanceCooldownSeconds: number;
  
  // Attendance props
  attendanceEnabled: boolean;
  attendanceGroups: AttendanceGroup[];
  currentGroup: AttendanceGroup | null;
  recentAttendance: AttendanceRecord[];
  groupMembers: AttendanceMember[];
  handleSelectGroup: (group: AttendanceGroup) => void;
  setShowGroupManagement: (show: boolean) => void;
  
  // Menu props
  openMenuPanel: (section: any) => void;
  setShowSettings: (show: boolean) => void;
}

export function Sidebar({
  currentDetections,
  currentRecognitionResults,
  recognitionEnabled,
  trackedFaces,
  trackingMode,
  handleManualLog,
  persistentCooldowns,
  attendanceCooldownSeconds,
  attendanceEnabled,
  attendanceGroups,
  currentGroup,
  recentAttendance,
  groupMembers,
  handleSelectGroup,
  setShowGroupManagement,
  openMenuPanel,
  setShowSettings,
}: SidebarProps) {
  return (
    <div className="w-96 bg-white/[0.02] border-l border-b border-white/[0.08] flex flex-col max-h-full">
      <div className="px-4 py-2 border-b border-white/[0.08]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => openMenuPanel('overview')}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              <span>Menu</span>
            </button>

            <div
              onClick={() => setShowSettings(true)}
              className="text-xs px-3 py-1.5 cursor-pointer bg-transparent rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      <div className="sidebar h-screen max-h-screen flex flex-col overflow-hidden">
        {/* Face Detection Display - Half of remaining space */}
        <div className="flex-1 border-b border-white/[0.08] flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-2 custom-scroll">
            {/* Active Cooldowns - Only show in Auto mode */}
            <CooldownList
              trackingMode={trackingMode}
              persistentCooldowns={persistentCooldowns}
              attendanceCooldownSeconds={attendanceCooldownSeconds}
            />
            
            <DetectionPanel
              currentDetections={currentDetections}
              currentRecognitionResults={currentRecognitionResults}
              recognitionEnabled={recognitionEnabled}
              trackedFaces={trackedFaces}
              trackingMode={trackingMode}
              handleManualLog={handleManualLog}
            />
          </div>
        </div>

        {/* Attendance Management or Recent Logs - Using AttendancePanel Component */}
        <AttendancePanel
          attendanceEnabled={attendanceEnabled}
          attendanceGroups={attendanceGroups}
          currentGroup={currentGroup}
          recentAttendance={recentAttendance}
          groupMembers={groupMembers}
          handleSelectGroup={handleSelectGroup}
          setShowGroupManagement={setShowGroupManagement}
        />
      </div>
    </div>
  );
}
