import type { AttendanceGroup, GroupType } from '../../../types/recognition';

interface MenuTopBarProps {
  selectedGroup: AttendanceGroup | null;
  groups: AttendanceGroup[];
  loading: boolean;
  onGroupChange: (group: AttendanceGroup | null) => void;
  onCreateGroup: () => void;
  onBack: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

const getGroupTypeIcon = (type: GroupType): string => {
  switch (type) {
    case 'employee':
      return '';
    case 'student':
      return '';
    case 'visitor':
      return '';
    case 'general':
    default:
      return '';
  }
};

export function MenuTopBar({
  selectedGroup,
  groups,
  loading,
  onGroupChange,
  onCreateGroup,
  onBack,
  onToggleSidebar,
  isSidebarCollapsed,
}: MenuTopBarProps) {
  return (
    <div className="h-16 border-b border-white/10 bg-black flex items-center justify-between px-6 flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle (hidden on desktop) */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <span className="text-xl">☰</span>
          </button>
        )}

        {/* Group Selector */}
        <select
          value={selectedGroup?.id ?? ''}
          onChange={(event) => {
            const group = groups.find((item) => item.id === event.target.value) ?? null;
            onGroupChange(group);
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          <option value="" className="bg-black text-white">
            Select group…
          </option>
          {groups.map((group) => (
            <option key={group.id} value={group.id} className="bg-black text-white">
              {group.name}
            </option>
          ))}
        </select>

        {/* Group Stats Badge */}
        {selectedGroup && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <div className="text-xs">
              <div className="text-white/60">Active Group</div>
              <div className="font-semibold text-white">{selectedGroup.name}</div>
            </div>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
            <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs text-white/70 hidden sm:inline">Loading...</span>
          </div>
        )}

        {/* Action Buttons */}
        <button
          onClick={onCreateGroup}
          className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors"
        >
          <span className="text-lg">+</span>
          <span className="hidden sm:inline">New Group</span>
        </button>

        <button
          onClick={onBack}
          className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors"
        >
          <span>✕</span>
          <span className="hidden sm:inline">Close</span>
        </button>
      </div>
    </div>
  );
}

