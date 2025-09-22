import { useState, useRef, useEffect } from 'react'
import type { MenuOption } from '../App'

interface AppDropdownProps {
  isConnected: boolean
  onMenuSelect: (menu: MenuOption) => void
}

export default function AppDropdown({ isConnected, onMenuSelect }: AppDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const menuItems = [
    {
      id: 'system-management',
      label: 'System Management',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => {
        onMenuSelect('system-management')
        setIsOpen(false)
      }
    },
    {
      id: 'live-camera',
      label: 'Live Camera',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      action: () => {
        onMenuSelect('live-camera')
        setIsOpen(false)
      }
    },
    {
      id: 'backend-test',
      label: 'Backend Test',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3V6a3 3 0 013-3h13.5a3 3 0 013 3v5.25a3 3 0 01-3 3m-13.5 0h13.5m-13.5 0v5.25A2.25 2.25 0 007.5 21.75h9a2.25 2.25 0 002.25-2.25v-5.25m0 0A2.25 2.25 0 0021 12v-1.5a2.25 2.25 0 00-2.25-2.25H15.75" />
        </svg>
      ),
      action: () => {
        onMenuSelect('backend-test')
        setIsOpen(false)
      }
    },
    {
      id: 'about',
      label: 'About SURI',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      ),
      action: () => {
        // TODO: Implement about modal
        setIsOpen(false)
      }
    },
    {
      id: 'help',
      label: 'Help & Documentation',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      ),
      action: () => {
        // TODO: Implement help modal
        setIsOpen(false)
      }
    }
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center space-x-2 px-4 py-0 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.08] text-white/80 hover:text-white rounded-xl font-light transition-all duration-300"
      >
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-white/40'} transition-all duration-300`}></div>
          <span className="text-xs font-light tracking-wider uppercase">
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        <svg 
          className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Menu Header */}
          <div className="px-4 py-3 border-b border-white/[0.05] bg-black">
            <div className="flex items-center space-x-3">
                <div className="text-sm font-light text-white">Settings</div>
            </div>
          </div>

          {/* Menu Items */}
          <div className='bg-black'>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-white/80 hover:text-white hover:bg-white/[0.05] transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-5 h-5 text-white/60 group-hover:text-white/80 transition-colors duration-200 flex-shrink-0">
                  {item.icon}
                </div>
                <span className="text-sm font-light whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Menu Footer */}
          <div className="px-4 py-3 border-t border-white/[0.05]">
            <div className="text-xs text-white/40 font-light">
              Version 1.0.0 • Connected to Backend
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
