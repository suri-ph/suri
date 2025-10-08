import React, { useState, useEffect } from 'react';
import { backendService } from '../services/BackendService';
import { attendanceManager } from '../services/AttendanceManager';
import type { AttendanceGroup } from '../types/recognition';

export interface QuickSettings {
  showFPS: boolean;
  showPreprocessing: boolean;
  showBoundingBoxes: boolean;
  showLandmarks: boolean;
  showAntiSpoofStatus: boolean;
  showRecognitionNames: boolean;
  showDebugInfo: boolean;
}

interface SettingsOverview {
  totalPersons: number;
  totalEmbeddings: number;
  lastUpdated: string;
}

interface PersonDetails {
  person_id: string;
  embedding_count: number;
  last_seen?: string;
}

interface SettingsProps {
  onBack: () => void;
  isModal?: boolean;
  quickSettings?: QuickSettings;
  onQuickSettingsChange?: (settings: QuickSettings) => void;
  attendanceGroup?: AttendanceGroup;
  onAttendanceGroupUpdate?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  onBack, 
  isModal = false, 
  quickSettings: externalQuickSettings, 
  onQuickSettingsChange,
  attendanceGroup,
  onAttendanceGroupUpdate
}) => {
  const [expandedSection, setExpandedSection] = useState<string>('display');
  const [systemData, setSystemData] = useState<SettingsOverview>({
    totalPersons: 0,
    totalEmbeddings: 0,
    lastUpdated: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPersons, setAllPersons] = useState<PersonDetails[]>([]);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [localAttendanceGroup, setLocalAttendanceGroup] = useState<AttendanceGroup | null>(attendanceGroup || null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<PersonDetails | null>(null);

  const [internalQuickSettings, setInternalQuickSettings] = useState<QuickSettings>({
    showFPS: true,
    showPreprocessing: false,
    showBoundingBoxes: true,
    showLandmarks: false,
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

  useEffect(() => {
    if (attendanceGroup) {
      setLocalAttendanceGroup(attendanceGroup);
    }
  }, [attendanceGroup]);

  const loadSystemData = async () => {
    setIsLoading(true);
    try {
      const stats = await backendService.getDatabaseStats();
      setSystemData({
        totalPersons: stats.total_persons,
        totalEmbeddings: stats.total_embeddings,
        lastUpdated: new Date().toISOString()
      });
      const persons: PersonDetails[] = stats.persons.map(person => ({
        person_id: person.person_id,
        embedding_count: person.embedding_count,
        last_seen: person.last_seen
      }));
      setAllPersons(persons);
    } catch (error) {
      console.error('Failed to load system data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePerson = async (person: PersonDetails) => {
    setIsLoading(true);
    try {
      await backendService.removePerson(person.person_id);
      await loadSystemData();
      setShowDeleteDialog(null);
    } catch (error) {
      console.error('Failed to delete person:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (person: PersonDetails) => {
    setEditingPerson(person.person_id);
    setEditName(person.person_id);
  };

  const saveEdit = async () => {
    if (!editingPerson || !editName.trim() || editName.trim() === editingPerson) {
      setEditingPerson(null);
      setEditName('');
      return;
    }
    setIsLoading(true);
    try {
      await backendService.updatePerson(editingPerson, editName.trim());
      await loadSystemData();
      setEditingPerson(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update person:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('Clear entire database? This cannot be undone.')) return;
    setIsLoading(true);
    try {
      await backendService.clearDatabase();
      await loadSystemData();
    } catch (error) {
      console.error('Failed to clear database:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPersons = allPersons.filter(p => 
    p.person_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateAttendance = async (field: 'class_start_time' | 'late_threshold_minutes', value: string | number) => {
    if (!localAttendanceGroup) return;
    try {
      await attendanceManager.updateGroup(localAttendanceGroup.id, {
        settings: { ...localAttendanceGroup.settings, [field]: value }
      });
      const updatedGroup = await attendanceManager.getGroup(localAttendanceGroup.id);
      if (updatedGroup) {
        setLocalAttendanceGroup(updatedGroup);
        onAttendanceGroupUpdate?.();
      }
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const mainContent = (
    <div className={isModal ? "w-full p-6" : "min-h-screen bg-gradient-to-b from-black via-[#050505] to-black p-6"}>
      <div className={isModal ? "w-full" : "max-w-4xl mx-auto"}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" strokeWidth={2}/></svg>
            {!isModal && "Back"}
          </button>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent text-xs text-emerald-100 font-mono">{systemData.totalPersons} people</div>
            <div className="px-3 py-1.5 rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent text-xs text-blue-100 font-mono">{systemData.totalEmbeddings} embeddings</div>
          </div>
        </div>

        {/* Display Section */}
        <div className="mb-4">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'display' ? '' : 'display')}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all mb-3"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={1.5}/></svg>
              <span className="text-white font-light">Display</span>
            </div>
            <svg className={`w-5 h-5 text-white/40 transition-transform ${expandedSection === 'display' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
          </button>
          {expandedSection === 'display' && (
            <div className="grid grid-cols-3 gap-2 px-1">
              {[
                { key: 'showFPS' as keyof QuickSettings, icon: '⚡', label: 'FPS' },
                { key: 'showBoundingBoxes' as keyof QuickSettings, icon: '▢', label: 'Boxes' },
                { key: 'showLandmarks' as keyof QuickSettings, icon: '●', label: 'Landmarks' },
                { key: 'showAntiSpoofStatus' as keyof QuickSettings, icon: '🛡️', label: 'Anti-Spoof' },
                { key: 'showRecognitionNames' as keyof QuickSettings, icon: '👤', label: 'Names' },
                { key: 'showDebugInfo' as keyof QuickSettings, icon: '🔧', label: 'Debug' },
              ].map(({ key, icon, label }) => (
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
          )}
        </div>

        {/* Database Section */}
        <div className="mb-4">
          <button 
            onClick={() => setExpandedSection(expandedSection === 'database' ? '' : 'database')}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all mb-3"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" strokeWidth={1.5}/></svg>
              <span className="text-white font-light">Database</span>
            </div>
            <svg className={`w-5 h-5 text-white/40 transition-transform ${expandedSection === 'database' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
          </button>
          {expandedSection === 'database' && (
            <div className="space-y-3 px-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/60"
              />
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {filteredPersons.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-sm">No people</div>
                ) : (
                  filteredPersons.map((person) => (
                    <div key={person.person_id} className="group flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                      {editingPerson === person.person_id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') { setEditingPerson(null); setEditName(''); }
                            }}
                            className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/60"
                            autoFocus
                          />
                          <button onClick={saveEdit} className="px-2 py-1 rounded-lg bg-green-500/20 border border-green-400/40 text-green-100 hover:bg-green-500/30 text-xs">✓</button>
                          <button onClick={() => { setEditingPerson(null); setEditName(''); }} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 text-xs">✕</button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="text-white text-sm">{person.person_id}</div>
                            <div className="text-white/40 text-xs">{person.embedding_count} embeddings</div>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(person)} className="px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-100 hover:bg-blue-500/30 text-xs">Edit</button>
                            <button onClick={() => setShowDeleteDialog(person)} className="px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30 text-xs">Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              <button onClick={handleClearDatabase} disabled={isLoading} className="w-full px-3 py-2 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30 text-sm transition-all disabled:opacity-50">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Attendance Section */}
        {localAttendanceGroup && (
          <div className="mb-4">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'attendance' ? '' : 'attendance')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all mb-3"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" strokeWidth={1.5}/></svg>
                <span className="text-white font-light">Attendance</span>
              </div>
              <svg className={`w-5 h-5 text-white/40 transition-transform ${expandedSection === 'attendance' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
            </button>
            {expandedSection === 'attendance' && (
              <div className="space-y-4 px-1">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/60 text-sm">Start Time</span>
                    <span className="text-white font-mono text-sm">{localAttendanceGroup.settings?.class_start_time ?? '08:00'}</span>
                  </div>
                  <input
                    type="time"
                    value={localAttendanceGroup.settings?.class_start_time ?? '08:00'}
                    onChange={(e) => updateAttendance('class_start_time', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/60 text-sm">Late Threshold</span>
                    <span className="text-white font-medium text-sm">{localAttendanceGroup.settings?.late_threshold_minutes ?? 15}min</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={localAttendanceGroup.settings?.late_threshold_minutes ?? 15}
                    onChange={(e) => updateAttendance('late_threshold_minutes', parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
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

  return (
    <>
      {mainContent}
      
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 max-w-sm mx-4 shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
            <h3 className="text-white font-medium mb-2">Delete {showDeleteDialog.person_id}?</h3>
            <p className="text-white/60 text-sm mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteDialog(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-all">Cancel</button>
              <button onClick={() => showDeleteDialog && handleDeletePerson(showDeleteDialog)} className="flex-1 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 hover:bg-rose-500/30 text-sm transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
