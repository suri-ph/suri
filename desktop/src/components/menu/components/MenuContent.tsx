import type { AttendanceGroup, AttendanceMember } from '../../../types/recognition';
import type { MenuSection } from '../types';

import { Overview } from '../sections/Overview';
import { Members } from '../sections/Members';
import { Reports } from '../sections/Reports';
import { Registration } from '../sections/Registration';
import { GroupSettings } from '../sections/GroupSettings';
import { EmptyState } from '../shared/EmptyState';

interface MenuContentProps {
  selectedGroup: AttendanceGroup | null;
  groups: AttendanceGroup[];
  members: AttendanceMember[];
  activeSection: MenuSection;
  onMembersChange: () => void;
  onEditMember: (member: AttendanceMember) => void;
  onAddMember: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onGroupSelect: (group: AttendanceGroup | null) => void;
  onExportData: () => void;
  onCreateGroup: () => void;
}

export function MenuContent({
  selectedGroup,
  groups,
  members,
  activeSection,
  onMembersChange,
  onEditMember,
  onAddMember,
  onEditGroup,
  onDeleteGroup,
  onGroupSelect,
  onExportData,
  onCreateGroup,
}: MenuContentProps) {
  if (!selectedGroup) {
    return (
      <div className="h-full px-6 py-6">
        <EmptyState onCreateGroup={onCreateGroup} />
      </div>
    );
  }

  return (
    <div className="h-full px-6 py-6">
      {activeSection === 'overview' && (
        <Overview group={selectedGroup} members={members} />
      )}

      {activeSection === 'members' && (
        <Members
          group={selectedGroup}
          members={members}
          onMembersChange={onMembersChange}
          onEdit={onEditMember}
          onAdd={onAddMember}
        />
      )}

      {activeSection === 'reports' && <Reports group={selectedGroup} />}

      {activeSection === 'registration' && (
        <Registration
          group={selectedGroup}
          members={members}
          onRefresh={onMembersChange}
        />
      )}

      {activeSection === 'settings' && (
        <GroupSettings
          group={selectedGroup}
          groups={groups}
          memberCount={members.length}
          onEdit={onEditGroup}
          onDelete={onDeleteGroup}
          onGroupSelect={onGroupSelect}
          onExportData={onExportData}
          onRefresh={onMembersChange}
        />
      )}
    </div>
  );
}

