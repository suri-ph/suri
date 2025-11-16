import type { QuickSettings } from "../types";

interface DisplayProps {
  quickSettings: QuickSettings;
  toggleQuickSetting: (key: keyof QuickSettings) => void;
}

export function Display({ quickSettings, toggleQuickSetting }: DisplayProps) {
  const settingItems = [
    {
      key: "cameraMirrored" as keyof QuickSettings,
      label: "Camera Mirroring",
      description: "Mirror camera display like a mirror (default: on)",
    },
    {
      key: "showFPS" as keyof QuickSettings,
      label: "FPS Counter",
      description: "Frame rate indicator",
    },
    {
      key: "showBoundingBoxes" as keyof QuickSettings,
      label: "Bounding Boxes",
      description: "Face detection outlines",
    },
    {
      key: "showLandmarks" as keyof QuickSettings,
      label: "Facial Landmarks",
      description: "5-point landmarks (eyes, nose, mouth)",
    },
    {
      key: "showRecognitionNames" as keyof QuickSettings,
      label: "Recognition Labels",
      description: "Identity name tags",
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl p-6">
      <div className="space-y-4">
        {settingItems.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center py-3 border-b border-white/5 gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white/90">{label}</div>
              <div className="text-xs text-white/50 mt-0.5">{description}</div>
            </div>

            <button
              onClick={() => toggleQuickSetting(key)}
              className={`relative w-11 h-6 rounded-full focus:outline-none transition-colors duration-150 flex-shrink-0 flex items-center ml-auto ${
                quickSettings[key] ? "bg-cyan-500/30" : "bg-white/10"
              }`}
            >
              <div
                className={`absolute left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-150 ${
                  quickSettings[key] ? "translate-x-5" : "translate-x-0"
                }`}
              ></div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
