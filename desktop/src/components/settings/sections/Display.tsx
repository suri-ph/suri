import type { QuickSettings } from '../types';

interface DisplayProps {
  quickSettings: QuickSettings;
  toggleQuickSetting: (key: keyof QuickSettings) => void;
}

export function Display({ quickSettings, toggleQuickSetting }: DisplayProps) {
  const settingItems = [
    { key: 'showFPS' as keyof QuickSettings, icon: '⚡', label: 'FPS' },
    { key: 'showBoundingBoxes' as keyof QuickSettings, icon: '▢', label: 'Boxes' },
    { key: 'showAntiSpoofStatus' as keyof QuickSettings, icon: '🛡️', label: 'Anti-Spoof' },
    { key: 'showRecognitionNames' as keyof QuickSettings, icon: '👤', label: 'Names' },
    { key: 'showDebugInfo' as keyof QuickSettings, icon: '🔧', label: 'Debug' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 px-1">
      {settingItems.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => toggleQuickSetting(key)}
          className={`p-3 rounded-xl border transition-all ${
            quickSettings[key]
              ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/20'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="text-2xl mb-1">{icon}</div>
          <div className={`text-xs ${quickSettings[key] ? 'text-emerald-100' : 'text-white/60'}`}>{label}</div>
          <div className={`w-full h-1 rounded-full mt-2 ${quickSettings[key] ? 'bg-emerald-500/60' : 'bg-white/10'}`}/>
        </button>
      ))}
    </div>
  );
}

