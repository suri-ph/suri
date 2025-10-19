import type { MenuSection } from '../types';

interface MenuNavProps {
  activeSection: MenuSection;
  onSectionChange: (section: MenuSection) => void;
}

interface SectionConfig {
  id: MenuSection;
  label: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'reports', label: 'Reports' },
  { id: 'registration', label: 'Face registration' },
  { id: 'settings', label: 'Group Settings' },
];

export function MenuNav({ activeSection, onSectionChange }: MenuNavProps) {
  return (
    <nav className="mt-3 flex flex-wrap gap-1.5 px-6">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionChange(section.id)}
          className={`text-xs px-2 py-1 ${
            activeSection === section.id ? 'btn-accent' : 'btn-secondary'
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

