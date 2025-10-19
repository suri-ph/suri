import { useState, useEffect } from 'react';
import type { MenuSection } from '../types';
import type { AttendanceGroup } from '../../../types/recognition';

interface MenuSidebarProps {
  activeSection: MenuSection;
  onSectionChange: (section: MenuSection) => void;
  selectedGroup: AttendanceGroup | null;
  groups: AttendanceGroup[];
  loading: boolean;
  onGroupChange: (group: AttendanceGroup | null) => void;
  onCreateGroup: () => void;
  onBack: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface SectionConfig {
  id: MenuSection;
  label: string;
  icon: string;
  shortcut: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: '',
    shortcut: '1',
    description: 'Group statistics and activity'
  },
  { 
    id: 'members', 
    label: 'Members', 
    icon: '',
    shortcut: '2',
    description: 'Manage group members'
  },
  { 
    id: 'reports', 
    label: 'Reports', 
    icon: '',
    shortcut: '3',
    description: 'View attendance reports'
  },
  { 
    id: 'registration', 
    label: 'Registration', 
    icon: '',
    shortcut: '4',
    description: 'Register faces'
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: '',
    shortcut: '5',
    description: 'Group configuration'
  },
];

export function MenuSidebar({
  activeSection,
  onSectionChange,
  selectedGroup,
  groups,
  loading,
  onGroupChange,
  onCreateGroup,
  onBack,
  isCollapsed,
  onToggleCollapse,
}: MenuSidebarProps) {
  const [hoveredSection, setHoveredSection] = useState<MenuSection | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if Ctrl/Cmd is not pressed (to avoid conflicts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      // Check if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const section = SECTIONS.find(s => s.shortcut === e.key);
      if (section && selectedGroup) {
        e.preventDefault();
        onSectionChange(section.id);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSectionChange, selectedGroup]);

  return (
    <aside
      className={`
        flex flex-col border-r border-white/10 bg-black
        transition-all duration-300 ease-in-out flex-shrink-0
        ${isCollapsed ? 'w-16' : 'w-64'} h-full relative
      `}
    >
      {/* Collapse Button - Center of Right Border */}
      <button
        onClick={onToggleCollapse}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-black border border-white/10 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center z-10"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className={`text-xs transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
          ◀
        </span>
      </button>
      {/* Sidebar Header */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          {/* Group Selector */}
          {!isCollapsed && (
            <select
              value={selectedGroup?.id ?? ''}
              onChange={(event) => {
                const group = groups.find((item) => item.id === event.target.value) ?? null;
                onGroupChange(group);
              }}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer h-10"
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
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* New Group Button */}
            {!isCollapsed && (
              <button
                onClick={onCreateGroup}
                className="w-10 h-10 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
                aria-label="New Group"
                title="New Group"
              >
                <span className="text-lg">+</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-2 overflow-y-auto custom-scroll">
        <ul className="space-y-1 px-2">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            const isHovered = hoveredSection === section.id;
            const isDisabled = !selectedGroup;

            return (
              <li key={section.id}>
                <button
                  onClick={() => !isDisabled && onSectionChange(section.id)}
                  onMouseEnter={() => setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                  disabled={isDisabled}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200 group relative
                    ${isActive
                      ? 'bg-white/10 text-white'
                      : isDisabled
                      ? 'text-white/30 cursor-not-allowed'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }
                  `}
                  title={isCollapsed ? section.label : undefined}
                  aria-label={section.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Label (hidden when collapsed) */}
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium text-sm truncate">
                        {section.label}
                      </div>
                      {isHovered && !isDisabled && (
                        <div className="text-xs text-white/50 mt-0.5 truncate">
                          {section.description}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && isHovered && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-black border border-white/10 rounded-lg shadow-xl z-50 whitespace-nowrap">
                      <div className="font-medium text-sm text-white">
                        {section.label}
                      </div>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Close Button at Bottom */}
      <div className="px-4 py-3 border-t border-white/10 mt-auto">
        <button
          onClick={onBack}
          className="w-full p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-2"
          aria-label="Close"
          title="Close"
        >
          <span className="text-lg">✕</span>
          {!isCollapsed && <span className="text-sm">Close</span>}
        </button>
      </div>

    </aside>
  );
}

