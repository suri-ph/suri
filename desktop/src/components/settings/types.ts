// Settings types

export interface QuickSettings {
  showFPS: boolean;
  showPreprocessing: boolean;
  showBoundingBoxes: boolean;
  showLandmarks: boolean;
  showAntiSpoofStatus: boolean;
  showRecognitionNames: boolean;
  cameraMirrored: boolean;
}

export interface AttendanceSettings {
  trackingMode: 'auto' | 'manual';
  lateThresholdEnabled: boolean;
  lateThresholdMinutes: number;
  classStartTime: string;
}

export interface SettingsOverview {
  totalPersons: number;
  totalMembers: number;
  lastUpdated: string;
}

