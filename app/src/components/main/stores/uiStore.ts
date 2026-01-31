import { create } from "zustand";
import type { QuickSettings } from "@/components/settings";
import type { GroupSection } from "@/components/group";
import { persistentSettings } from "@/services/PersistentSettingsService";

interface UIState {
  // Error state
  error: string | null;

  // Settings UI
  showSettings: boolean;
  isSettingsFullScreen: boolean;
  groupInitialSection: GroupSection | undefined;
  settingsInitialSection: string | undefined;

  // Quick settings
  quickSettings: QuickSettings;

  // Actions
  setError: (error: string | null) => void;
  setShowSettings: (show: boolean) => void;
  setIsSettingsFullScreen: (fullScreen: boolean) => void;
  setGroupInitialSection: (section: GroupSection | undefined) => void;
  setSettingsInitialSection: (section: string | undefined) => void;
  setQuickSettings: (
    settings: QuickSettings | ((prev: QuickSettings) => QuickSettings),
  ) => void;
}

// Load initial QuickSettings from store
const loadInitialQuickSettings = async (): Promise<QuickSettings> => {
  return await persistentSettings.getQuickSettings();
};

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  error: null,
  showSettings: false,
  isSettingsFullScreen: false,
  groupInitialSection: undefined,
  settingsInitialSection: undefined,
  quickSettings: {
    cameraMirrored: true,
    showFPS: false,
    showRecognitionNames: true,
    showLandmarks: true,
  },

  // Actions
  setError: (error) => set({ error }),
  setShowSettings: (show) => set({ showSettings: show }),
  setIsSettingsFullScreen: (fullScreen) =>
    set({ isSettingsFullScreen: fullScreen }),
  setGroupInitialSection: (section) => set({ groupInitialSection: section }),
  setSettingsInitialSection: (section) =>
    set({ settingsInitialSection: section }),
  setQuickSettings: (settings) => {
    const newSettings =
      typeof settings === "function"
        ? settings(useUIStore.getState().quickSettings)
        : settings;
    set({ quickSettings: newSettings });
    // Save to store asynchronously (don't block)
    persistentSettings.setQuickSettings(newSettings).catch(console.error);
  },
}));

// Load QuickSettings from store on initialization
if (typeof window !== "undefined") {
  loadInitialQuickSettings().then((settings) => {
    useUIStore.setState({ quickSettings: settings });
  });
}
