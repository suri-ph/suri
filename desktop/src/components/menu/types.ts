export type MenuSection = 'overview' | 'members' | 'reports' | 'registration' | 'settings';

export interface MenuProps {
  onBack: () => void;
  initialSection?: MenuSection;
}

