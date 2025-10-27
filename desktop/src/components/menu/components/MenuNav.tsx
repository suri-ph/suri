import { useState, useEffect } from 'react';
import type { MenuSection } from '../types';

interface MenuNavProps {
  activeSection: MenuSection;
  onSectionChange: (section: MenuSection) => void;
  selectedGroup: any;
  isCollapsed: boolean;
}

interface SectionConfig {
  id: MenuSection;
  label: string;
  icon: string;
  shortcut: string;
}

const SECTIONS: SectionConfig[] = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: '',
    shortcut: '1'
  },
  { 
    id: 'members', 
    label: 'Members', 
    icon: '',
    shortcut: '2'
  },
  { 
    id: 'reports', 
    label: 'Reports', 
    icon: '',
    shortcut: '3'
  },
  { 
    id: 'registration', 
    label: 'Registration', 
    icon: '',
    shortcut: '4'
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: '',
    shortcut: '5'
  },
];

export function MenuNav({ activeSection, onSectionChange, selectedGroup, isCollapsed }: MenuNavProps) {
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
    <nav className="flex-1 py-2 overflow-y-auto custom-scroll">
      <ul className="space-y-1 px-2">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          const isHovered = isCollapsed && hoveredSection === section.id;
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
  );
}