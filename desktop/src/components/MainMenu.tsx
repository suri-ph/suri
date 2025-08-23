import type { MenuOption } from '../App'
import AppDropdown from './AppDropdown.tsx'

interface MainMenuProps {
  onMenuSelect: (menu: MenuOption) => void
  isConnected: boolean
  systemStats: {
    legacy_faces: number
    enhanced_templates: number
    total_people: number
    today_records: number
    total_records: number
    success_rate: number
  } | null
  onRefreshStats: () => void
}

export default function MainMenu({ 
  onMenuSelect, 
  isConnected, 
  systemStats,
  onRefreshStats 
}: MainMenuProps) {
  const menuItems: Array<{
    id: MenuOption
    icon: React.ReactNode
    title: string
    description: string
    disabled: boolean
  }> = [
    {
      id: 'live-camera' as MenuOption,
      icon: (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      title: 'Live Camera',
      description: 'Real-time recognition',
      disabled: !isConnected
    },
    {
      id: 'single-image' as MenuOption,
      icon: (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
      title: 'Single Image',
      description: 'Upload & analyze',
      disabled: !isConnected
    },
    {
      id: 'batch-processing' as MenuOption,
      icon: (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      title: 'Batch Processing',
      description: 'Multiple images',
      disabled: !isConnected
    },
    {
      id: 'system-management' as MenuOption,
      icon: (
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: 'System Management',
      description: 'People & settings',
      disabled: !isConnected
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Ultra Subtle Glass Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-white/[0.02] rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-white/[0.015] rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute top-2/3 left-1/2 w-64 h-64 bg-white/[0.01] rounded-full blur-2xl animate-pulse delay-4000"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Compact Header */}
        <div className="px-6 pt-8 pb-6">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center space-x-5">
                <div>
                  <h1 className="text-5xl font-extralight text-white tracking-[-0.02em]">
                    SURI
                  </h1>
                  <p className="text-xs text-white/60 font-light tracking-widest uppercase mt-1">Face Recognition</p>
                </div>
              </div>

              {/* Glass Status */}
              <div className="flex items-center space-x-4">
                <AppDropdown isConnected={isConnected} onRefreshStats={onRefreshStats} />
              </div>
            </div>
          <div className="max-w-7xl mx-auto">
            {/* Minimalist Header */}

            {/* Glass Stats Cards */}
            {systemStats && (
              <div className="grid grid-cols-4 gap-6 mb-16">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl p-6 text-center group hover:bg-white/[0.04] transition-all duration-500">
                  <div className="text-2xl font-extralight text-white mb-2 tracking-tight">
                    {systemStats.total_people}
                  </div>
                  <div className="text-[10px] text-white/50 font-light uppercase tracking-[0.2em]">People</div>
                </div>
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl p-6 text-center group hover:bg-white/[0.04] transition-all duration-500">
                  <div className="text-2xl font-extralight text-white mb-2 tracking-tight">
                    {systemStats.enhanced_templates}
                  </div>
                  <div className="text-[10px] text-white/50 font-light uppercase tracking-[0.2em]">Templates</div>
                </div>
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl p-6 text-center group hover:bg-white/[0.04] transition-all duration-500">
                  <div className="text-2xl font-extralight text-white mb-2 tracking-tight">
                    {systemStats.today_records}
                  </div>
                  <div className="text-[10px] text-white/50 font-light uppercase tracking-[0.2em]">Today</div>
                </div>
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl p-6 text-center group hover:bg-white/[0.04] transition-all duration-500">
                  <div className="text-2xl font-extralight text-white mb-2 tracking-tight">
                    {Math.round(systemStats.success_rate * 100)}%
                  </div>
                  <div className="text-[10px] text-white/50 font-light uppercase tracking-[0.2em]">Success</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pure Glass Menu Grid */}
        <div className="flex-1 px-6 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && onMenuSelect(item.id)}
                  disabled={item.disabled}
                  className={`group relative overflow-hidden rounded-2xl transition-all duration-700 ${
                    item.disabled 
                      ? 'opacity-30 cursor-not-allowed' 
                      : 'hover:scale-[1.02] hover:-translate-y-1'
                  }`}
                >
                  {/* Pure Glass Background */}
                  <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08]"></div>
                  
                  {/* Hover Glass Enhancement */}
                  {!item.disabled && (
                    <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-xl border border-white/[0.12] opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
                  )}
                  
                  {/* Content */}
                  <div className="relative z-10 p-8 h-full flex flex-col min-h-[200px]">
                    <div className="flex items-start justify-between mb-8">
                      <div className="transition-transform duration-700 group-hover:scale-110">
                        {item.icon}
                      </div>
                      {!item.disabled && (
                        <div className="w-8 h-8 rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-x-2 group-hover:translate-x-0">
                          <svg className="w-3 h-3 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="text-lg font-light text-white mb-3 tracking-wide group-hover:text-white/90 transition-colors duration-500">
                        {item.title}
                      </h3>
                      <p className="text-sm text-white/60 group-hover:text-white/70 transition-colors duration-500 leading-relaxed font-light">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Disabled Overlay */}
                  {item.disabled && (
                    <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-xs text-white/40 font-light bg-white/[0.02] px-4 py-2 rounded-full border border-white/[0.05]">
                        Connection Required
                      </div>
                    </div>
                  )}

                  {/* Subtle Hover Glow */}
                  <div className="absolute inset-0 rounded-2xl bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Minimalist Footer */}
        <div className="px-6 pb-8">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-[10px] text-white/30 font-light tracking-[0.15em] uppercase">
              Face Recognition • Real-time Detection • Advanced Analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}