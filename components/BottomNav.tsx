'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface BottomNavProps {
  role?: string
  unreadCount?: number
  trainerId?: string | null
  isPremium?: boolean
}

// Aqua Blue Theme
const ACTIVE_COLOR = '#0284C7'
const INACTIVE_COLOR = '#94A3B8'

// SVG Icon Components
function IconHome({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconDumbbell({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M2 12h2M20 12h2M4 8v8M20 8v8M7 5v14M17 5v14"/>
    </svg>
  )
}

function IconChat({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

function IconChart({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function IconSettings({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

function IconUsers({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function IconClipboard({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <path d="M9 14l2 2 4-4"/>
    </svg>
  )
}

// Icon map
const ICON_MAP: Record<string, React.FC<{ color: string }>> = {
  home: IconHome,
  exercises: IconDumbbell,
  messages: IconChat,
  progress: IconChart,
  settings: IconSettings,
  trainer: IconUsers,
  admin: IconClipboard,
  reports: IconChart,
}

export default function BottomNav({ role = 'patient', unreadCount = 0, trainerId, isPremium = true }: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const getTabs = () => {
    if (role === 'admin') {
      return [
        { key: 'home', label: '홈', path: '/dashboard' },
        { key: 'admin', label: '관리', path: '/admin' },
        { key: 'messages', label: '메시지', path: '/messages' },
        { key: 'reports', label: '리포트', path: '/admin/reports' },
        { key: 'settings', label: '설정', path: '/settings' },
      ]
    }

    if (role === 'trainer') {
      return [
        { key: 'home', label: '홈', path: '/dashboard' },
        { key: 'trainer', label: '환자관리', path: '/trainer' },
        { key: 'messages', label: '메시지', path: '/messages' },
        { key: 'exercises', label: '운동', path: '/exercises' },
        { key: 'settings', label: '설정', path: '/settings' },
      ]
    }

    // 환자 (기본)
    return [
      { key: 'home', label: '홈', path: '/dashboard' },
      { key: 'exercises', label: '운동', path: '/exercises' },
      { key: 'messages', label: '메시지', path: trainerId ? `/messages/${trainerId}` : '/messages' },
      { key: 'progress', label: '진행상황', path: '/progress' },
      { key: 'settings', label: '설정', path: '/settings' },
    ]
  }

  const tabs = getTabs()

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.key === 'home') return pathname === '/dashboard'
    if (tab.key === 'messages') return pathname.startsWith('/messages')
    if (tab.key === 'admin') return pathname === '/admin'
    if (tab.key === 'trainer') return pathname.startsWith('/trainer')
    if (tab.key === 'exercises') return pathname.startsWith('/exercises')
    if (tab.key === 'progress') return pathname === '/progress' || pathname === '/my-stats'
    if (tab.key === 'reports') return pathname.startsWith('/admin/reports')
    if (tab.key === 'settings') return pathname === '/settings'
    return pathname === tab.path
  }

  const isMessageLocked = (tabKey: string) => {
    return tabKey === 'messages' && role === 'patient' && !isPremium
  }

  return (
    <>
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">프리미엄 기능입니다</h3>
              <p className="text-sm text-gray-500 mb-1">트레이너 1:1 메시지와 맞춤 운동 제안을</p>
              <p className="text-sm text-gray-500 mb-6">이용하려면 프리미엄 구독이 필요해요.</p>
              <div className="space-y-2">
                <button
                  onClick={() => { setShowPremiumModal(false); router.push('/subscribe') }}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
                >
                  구독 알아보기
                </button>
                <button
                  onClick={() => setShowPremiumModal(false)}
                  className="w-full py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-50"
                >
                  다음에 할게요
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40" style={{ boxShadow: '0 -2px 12px rgba(0,0,0,0.03)' }}>
        <div className="max-w-7xl mx-auto px-4 flex justify-around py-2 pb-4">
          {tabs.map((tab) => {
            const active = isActive(tab)
            const locked = isMessageLocked(tab.key)
            const showBadge = tab.key === 'messages' && unreadCount > 0 && !locked
            const IconComponent = ICON_MAP[tab.key] || IconHome
            const color = locked ? '#CBD5E1' : active ? ACTIVE_COLOR : INACTIVE_COLOR

            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (locked) {
                    setShowPremiumModal(true)
                    return
                  }
                  router.push(tab.path)
                }}
                className="flex flex-col items-center gap-1 relative"
              >
                {active && !locked && (
                  <div
                    className="absolute -top-2 rounded-full"
                    style={{ width: 18, height: 3, backgroundColor: ACTIVE_COLOR }}
                  />
                )}

                <IconComponent color={color} />

                {locked && (
                  <span className="absolute -top-1 -right-1 text-[9px]">🔒</span>
                )}

                {showBadge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}

                <span
                  className="text-[10px]"
                  style={{
                    color,
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
