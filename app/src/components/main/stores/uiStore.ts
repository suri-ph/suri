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
  hasSeenIntro: boolean;
  isHydrated: boolean;

  // Quick settings
  quickSettings: QuickSettings;

  // Actions
  setError: (error: string | null) => void;
  setShowSettings: (show: boolean) => void;
  setIsSettingsFullScreen: (fullScreen: boolean) => void;
  setGroupInitialSection: (section: GroupSection | undefined) => void;
  setSettingsInitialSection: (section: string | undefined) => void;
  setHasSeenIntro: (seen: boolean) => void;
  setQuickSettings: (
    settings: QuickSettings | ((prev: QuickSettings) => QuickSettings),
  ) => void;
  setIsHydrated: (isHydrated: boolean) => void;
}

// Load initial QuickSettings from store
const loadInitialSettings = async () => {
  const quickSettings = await persistentSettings.getQuickSettings();
  const uiState = await persistentSettings.getUIState();
  return { quickSettings, hasSeenIntro: uiState.hasSeenIntro };
};

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  error: null,
  showSettings: false,
  isSettingsFullScreen: false,
  groupInitialSection: undefined,
  settingsInitialSection: undefined,
  hasSeenIntro: false, // Default to false
  isHydrated: false, // Wait for hydration before rendering decisions

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
  setHasSeenIntro: (seen) => {
    set({ hasSeenIntro: seen });
    persistentSettings.setUIState({ hasSeenIntro: seen }).catch(console.error);
  },
  setQuickSettings: (settings) => {
    const newSettings =
      typeof settings === "function"
        ? settings(useUIStore.getState().quickSettings)
        : settings;
    set({ quickSettings: newSettings });
    // Save to store asynchronously (don't block)
    persistentSettings.setQuickSettings(newSettings).catch(console.error);
  },
  setIsHydrated: (isHydrated: boolean) => set({ isHydrated }),
}));

// Load Settings from store on initialization
if (typeof window !== "undefined") {
  loadInitialSettings().then(({ quickSettings, hasSeenIntro }) => {
    useUIStore.setState({ quickSettings, hasSeenIntro, isHydrated: true });
  });
}
