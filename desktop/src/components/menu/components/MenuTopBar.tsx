import type { AttendanceGroup } from '../../../types/recognition';

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

export function MenuTopBar({
  selectedGroup,
  groups,
  loading,
  onGroupChange,
  onCreateGroup,
  onBack,
  onToggleSidebar
}: MenuTopBarProps) {
  return (
    <div className="h-16 border-b border-white/10 bg-black flex items-center justify-between px-6 flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle (hidden on desktop) */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors group"
            aria-label="Toggle menu"
          >
            <div className="relative w-4 h-4">
              <div className="absolute top-1 left-1/2 w-2 h-0.5 bg-white/70 group-hover:bg-white transition-all duration-200 -translate-x-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-2 h-0.5 bg-white/70 group-hover:bg-white transition-all duration-200 -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-1 left-1/2 w-2 h-0.5 bg-white/70 group-hover:bg-white transition-all duration-200 -translate-x-1/2"></div>
            </div>
          </button>
        )}

        {/* Group Selector */}
        <div className="relative">
          <select
            value={selectedGroup?.id ?? ''}
            onChange={(event) => {
              const group = groups.find((item) => item.id === event.target.value) ?? null;
              onGroupChange(group);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer appearance-none w-full"
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
          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className="w-3 h-3 text-white/50 transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

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
          <span className="hidden sm:inline">Close</span>
        </button>
      </div>
    </div>
  );
}

