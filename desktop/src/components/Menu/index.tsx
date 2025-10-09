import { useState, useEffect, useCallback, useRef } from 'react';
import { attendanceManager } from '../../services/AttendanceManager.js';

// Sections
import { Overview } from './sections/Overview.js';
import { Members } from './sections/Members.js';
import { Reports } from './sections/Reports.js';
import { Registration } from './sections/Registration.js';
import { GroupSettings } from './sections/GroupSettings.js';

// Modals
import { AddMember } from './modals/AddMember.js';
import { EditMember } from './modals/EditMember.js';
import { CreateGroup } from './modals/CreateGroup.js';
import { EditGroup } from './modals/EditGroup.js';

// Shared
import { EmptyState } from './shared/EmptyState.js';

import type {
  AttendanceGroup,
  AttendanceMember,
  GroupType
} from '../../types/recognition.js';

export type MenuSection = 'overview' | 'members' | 'reports' | 'registration' | 'settings';

interface MenuProps {
  onBack: () => void;
  initialSection?: MenuSection;
}

interface SectionConfig {
  id: MenuSection;
  label: string;
}

const SECTION_CONFIG: SectionConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'reports', label: 'Reports' },
  { id: 'registration', label: 'Face registration' },
  { id: 'settings', label: 'Group Settings' }
];

const getGroupTypeIcon = (type: GroupType): string => {
  switch (type) {
    case 'employee':
      return '👔';
    case 'student':
      return '🎓';
    case 'visitor':
      return '👤';
    case 'general':
    default:
      return '👥';
  }
};

export function Menu({ onBack, initialSection }: MenuProps) {
  // Core state
  const [selectedGroup, setSelectedGroup] = useState<AttendanceGroup | null>(null);
  const [groups, setGroups] = useState<AttendanceGroup[]>([]);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [activeSection, setActiveSection] = useState<MenuSection>(initialSection ?? 'overview');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingMember, setEditingMember] = useState<AttendanceMember | null>(null);

  // Refs
  const selectedGroupRef = useRef<AttendanceGroup | null>(null);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const allGroups = await attendanceManager.getGroups();
      setGroups(allGroups);

      if (allGroups.length === 0) {
        setSelectedGroup(null);
        setMembers([]);
        return;
      }

      const existingSelection = selectedGroupRef.current;
      const resolved = existingSelection
        ? allGroups.find(group => group.id === existingSelection.id) ?? allGroups[0]
        : allGroups[0];

      setSelectedGroup(resolved);
    } catch (err) {
      console.error('Error loading groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch group details (members)
  const fetchGroupDetails = useCallback(async (groupId: string) => {
    setLoading(true);
    try {
      setError(null);
      const groupMembers = await attendanceManager.getGroupMembers(groupId);
      setMembers(groupMembers);
    } catch (err) {
      console.error('Error loading group data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Export data
  const exportData = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await attendanceManager.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `attendance-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete group
  const handleDeleteGroup = async () => {
    if (!selectedGroup) {
      return;
    }

    if (!confirm(`Delete group "${selectedGroup.name}"? This will remove all members and attendance records.`)) {
      return;
    }

    setLoading(true);
    try {
      await attendanceManager.deleteGroup(selectedGroup.id);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (err) {
      console.error('Error deleting group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  // Open edit member modal
  const openEditMember = (member: AttendanceMember) => {
    setEditingMember(member);
    setShowEditMemberModal(true);
  };

  // Initialize
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupDetails(selectedGroup.id);
    }
  }, [selectedGroup, fetchGroupDetails]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  return (
    <div className="pt-10 h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Menu</h1>
            <div className="h-6 w-px bg-white/10" />
            <select
              value={selectedGroup?.id ?? ''}
              onChange={event => {
                const group = groups.find(item => item.id === event.target.value) ?? null;
                setSelectedGroup(group);
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500/60"
            >
              <option value="">Select group…</option>
              {groups.map(group => (
                <option key={group.id} value={group.id} className="bg-black text-white">
                  {getGroupTypeIcon(group.type)} {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center gap-2 text-blue-300 text-xs">
                <span className="h-3 w-3 border-2 border-blue-400/40 border-t-blue-300 rounded-full animate-spin" />
              </div>
            )}
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 transition-colors text-xs flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" strokeWidth={2.5}/></svg>
              New Group
            </button>
            <button
              onClick={exportData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-200 hover:bg-blue-600/30 transition-colors text-xs disabled:opacity-50"
            >
              Export
            </button>
            <button
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-gray-100 transition-colors text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
        <nav className="mt-3 flex flex-wrap gap-1.5">
          {SECTION_CONFIG.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                activeSection === section.id
                  ? 'border-blue-500/60 bg-blue-600/20 text-blue-200'
                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-2 bg-red-600/20 border-b border-red-500/40 text-red-200 flex items-center justify-between text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-200 hover:text-red-100">
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-gradient-to-b from-black via-[#050505] to-black">
        <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
          {!selectedGroup ? (
            <EmptyState onCreateGroup={() => setShowCreateGroupModal(true)} />
          ) : (
            <>
              {activeSection === 'overview' && (
                <Overview group={selectedGroup} members={members} />
              )}

              {activeSection === 'members' && (
                <Members
                  group={selectedGroup}
                  members={members}
                  onMembersChange={() => fetchGroupDetails(selectedGroup.id)}
                  onEdit={openEditMember}
                  onAdd={() => setShowAddMemberModal(true)}
                />
              )}

              {activeSection === 'reports' && (
                <Reports group={selectedGroup} />
              )}

              {activeSection === 'registration' && (
                <Registration
                  group={selectedGroup}
                  members={members}
                  onRefresh={() => fetchGroupDetails(selectedGroup.id)}
                />
              )}

              {activeSection === 'settings' && (
                <GroupSettings
                  group={selectedGroup}
                  groups={groups}
                  memberCount={members.length}
                  onEdit={() => setShowEditGroupModal(true)}
                  onDelete={handleDeleteGroup}
                  onGroupSelect={setSelectedGroup}
                  onExportData={exportData}
                  onRefresh={() => fetchGroupDetails(selectedGroup.id)}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddMemberModal && selectedGroup && (
        <AddMember
          group={selectedGroup}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={() => fetchGroupDetails(selectedGroup.id)}
        />
      )}

      {showEditMemberModal && editingMember && (
        <EditMember
          member={editingMember}
          onClose={() => {
            setEditingMember(null);
            setShowEditMemberModal(false);
          }}
          onSuccess={() => selectedGroup && fetchGroupDetails(selectedGroup.id)}
        />
      )}

      {showCreateGroupModal && (
        <CreateGroup
          onClose={() => setShowCreateGroupModal(false)}
          onSuccess={(newGroup) => {
            fetchGroups();
            setSelectedGroup(newGroup);
          }}
        />
      )}

      {showEditGroupModal && selectedGroup && (
        <EditGroup
          group={selectedGroup}
          onClose={() => setShowEditGroupModal(false)}
          onSuccess={() => fetchGroups()}
        />
      )}
    </div>
  );
}

