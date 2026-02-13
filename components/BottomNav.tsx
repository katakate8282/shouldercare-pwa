'use client'

import { useRouter, usePathname } from 'next/navigation'

interface BottomNavProps {
  role?: string
  unreadCount?: number
  trainerId?: string | null
}

export default function BottomNav({ role = 'patient', unreadCount = 0, trainerId }: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  // 역할별 탭 구성
  const getTabs = () => {
    if (role === 'admin') {
      return [
        { key: 'home', icon: '🏠', label: '홈', path: '/dashboard' },
        { key: 'admin', icon: '⚙️', label: '관리', path: '/admin' },
        { key: 'messages', icon: '💬', label: '메시지', path: '/messages' },
        { key: 'reports', icon: '📊', label: '리포트', path: '/admin/reports' },
        { key: 'settings', icon: '⚙️', label: '설정', path: '/settings' },
      ]
    }

    if (role === 'trainer') {
      return [
        { key: 'home', icon: '🏠', label: '홈', path: '/dashboard' },
        { key: 'trainer', icon: '👨‍⚕️', label: '환자관리', path: '/trainer' },
        { key: 'messages', icon: '💬', label: '메시지', path: '/messages' },
        { key: 'exercises', icon: '💪', label: '운동', path: '/exercises' },
        { key: 'settings', icon: '⚙️', label: '설정', path: '/settings' },
      ]
    }

    // 환자 (기본)
    return [
      { key: 'home', icon: '🏠', label: '홈', path: '/dashboard' },
      { key: 'exercises', icon: '💪', label: '운동', path: '/exercises' },
      { key: 'messages', icon: '💬', label: '메시지', path: trainerId ? `/messages/${trainerId}` : '/messages' },
      { key: 'progress', icon: '📈', label: '진행상황', path: '/progress' },
      { key: 'settings', icon: '⚙️', label: '설정', path: '/settings' },
    ]
  }

  const tabs = getTabs()

  // 현재 경로와 탭 경로 매칭
  const isActive = (tab: typeof tabs[0]) => {
    if (tab.key === 'home') return pathname === '/dashboard'
    if (tab.key === 'messages') return pathname.startsWith('/messages')
    if (tab.key === 'admin') return pathname === '/admin'
    if (tab.key === 'trainer') return pathname.startsWith('/trainer')
    if (tab.key === 'exercises') return pathname.startsWith('/exercises')
    if (tab.key === 'progress') return pathname === '/progress'
    if (tab.key === 'reports') return pathname.startsWith('/admin/reports')
    if (tab.key === 'settings') return pathname === '/settings'
    // my-stats는 진행상황의 하위 개념
    if (tab.key === 'progress' && pathname === '/my-stats') return true
    return pathname === tab.path
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
      <div className="max-w-7xl mx-auto px-4 flex justify-around py-3">
        {tabs.map((tab) => {
          const active = isActive(tab)
          const showBadge = tab.key === 'messages' && unreadCount > 0

          return (
            <button
              key={tab.key}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center gap-1 relative ${
                active ? 'text-blue-500' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              {showBadge && (
                <span className="absolute -top-1 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className={`text-xs ${active ? 'font-medium' : ''}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
