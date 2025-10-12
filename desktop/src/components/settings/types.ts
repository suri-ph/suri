// Settings types

export interface QuickSettings {
  showFPS: boolean;
  showPreprocessing: boolean;
  showBoundingBoxes: boolean;
  showLandmarks: boolean;
  showAntiSpoofStatus: boolean;
  showRecognitionNames: boolean;
  showDebugInfo: boolean;
}

export interface SettingsOverview {
  totalPersons: number;
  totalEmbeddings: number;
  lastUpdated: string;
}

