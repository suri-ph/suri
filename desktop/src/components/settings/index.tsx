import React, { useState, useEffect } from 'react';
import { backendService } from '../../services/BackendService';
import { Display } from './sections/Display';
import { Database } from './sections/Database';
import type { QuickSettings, SettingsOverview } from './types';

// Re-export QuickSettings for backward compatibility
export type { QuickSettings };

interface SettingsProps {
  onBack: () => void;
  isModal?: boolean;
  quickSettings?: QuickSettings;
  onQuickSettingsChange?: (settings: QuickSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  onBack, 
  isModal = false, 
  quickSettings: externalQuickSettings, 
  onQuickSettingsChange
}) => {
  const [expandedSection, setExpandedSection] = useState<string>('display');
  const [systemData, setSystemData] = useState<SettingsOverview>({
    totalPersons: 0,
    totalEmbeddings: 0,
    lastUpdated: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(false);

  const [internalQuickSettings, setInternalQuickSettings] = useState<QuickSettings>({
    showFPS: true,
    showPreprocessing: false,
    showBoundingBoxes: true,
    showAntiSpoofStatus: true,
    showRecognitionNames: true,
    showDebugInfo: false,
  });

  const quickSettings = externalQuickSettings || internalQuickSettings;

  const toggleQuickSetting = (key: keyof QuickSettings) => {
    const newSettings = { ...quickSettings, [key]: !quickSettings[key] };
    if (onQuickSettingsChange) {
      onQuickSettingsChange(newSettings);
    } else {
      setInternalQuickSettings(newSettings);
    }
  };

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    setIsLoading(true);
    try {
      const stats = await backendService.getDatabaseStats();
      setSystemData({
        totalPersons: stats.total_persons,
        totalEmbeddings: stats.total_embeddings,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to load system data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('⚠️ Clear ALL face recognition data? This will delete all registered faces and embeddings. This cannot be undone.')) return;
    setIsLoading(true);
    try {
      await backendService.clearDatabase();
      await loadSystemData();
      alert('✓ Database cleared successfully');
    } catch (error) {
      console.error('Failed to clear database:', error);
      alert('❌ Failed to clear database');
    } finally {
      setIsLoading(false);
    }
  };

  const mainContent = (
    <div className="h-full flex flex-col bg-[#0f0f0f] text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <h1 className="text-2xl font-light">Settings</h1>
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"
        >
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
        {/* Display Section */}
        <div className="mb-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'display' ? '' : 'display')}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all mb-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-lg">👁️</span>
              </div>
              <span className="text-white font-medium">Display</span>
            </div>
            <svg className={`w-5 h-5 text-white/40 transition-transform ${expandedSection === 'display' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
          </button>
          {expandedSection === 'display' && (
            <Display quickSettings={quickSettings} toggleQuickSetting={toggleQuickSetting} />
          )}
        </div>

        {/* Face Database Section */}
        <div className="mb-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'database' ? '' : 'database')}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all mb-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <span className="text-purple-400 text-lg">💾</span>
              </div>
              <span className="text-white font-medium">Face Database</span>
            </div>
            <svg className={`w-5 h-5 text-white/40 transition-transform ${expandedSection === 'database' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
          </button>
          {expandedSection === 'database' && (
            <Database 
              systemData={systemData} 
              isLoading={isLoading}
              onRefresh={loadSystemData}
              onClearDatabase={handleClearDatabase}
            />
          )}
        </div>
        
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50">
        <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
          {mainContent}
        </div>
      </div>
    );
  }

  return mainContent;
};

