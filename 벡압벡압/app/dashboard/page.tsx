'use client'

import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const router = useRouter()
  const [todayPain, setTodayPain] = useState<number | null>(null)

  useEffect(() => {
    // 로그인 안되어 있으면 로그인 페이지로
    if (!isAuthenticated) {
      router.push('/login')
    }
    
    // Load today's pain log
    if (typeof window !== 'undefined') {
      const painLogs = JSON.parse(localStorage.getItem('painLogs') || '[]')
      const today = new Date().toDateString()
      const todayLog = painLogs.find((log: any) => 
        new Date(log.loggedAt).toDateString() === today
      )
      if (todayLog) {
        setTodayPain(todayLog.painLevel)
      }
    }
  }, [isAuthenticated, router])

  if (!user) return null

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">어깨케어</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.subscriptionType}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              <span className="text-2xl">👤</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-3 space-y-3">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3 text-white">
          <h2 className="text-lg font-bold mb-1">{user.name}님 환영합니다! 👋</h2>
          <p className="text-xs text-blue-100">오늘도 건강한 하루 되세요</p>
          <div className="mt-1.5 inline-block bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {user.subscriptionType === 'PREMIUM' ? '프리미엄 회원' : 
             user.subscriptionType === 'PLATINUM_PATIENT' ? '플래티넘 환자' :
             user.subscriptionType === 'TRIAL' ? '무료 체험' : '미구독'}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg p-2.5 shadow-sm">
            <p className="text-xs text-gray-600 mb-0.5">이번 주 운동</p>
            <p className="text-lg font-bold text-gray-900">0/28</p>
            <p className="text-xs text-gray-500">0% 완료</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 shadow-sm">
            <p className="text-xs text-gray-600 mb-0.5">오늘 통증</p>
            <p className="text-lg font-bold text-gray-900">
              {todayPain !== null ? todayPain : '-'}
            </p>
            <p className="text-xs text-gray-500">
              {todayPain !== null ? '기록됨' : '아직 기록 없음'}
            </p>
          </div>
        </div>

        {/* Today's Exercises - Compact */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-2.5 border-b">
            <h3 className="text-sm font-semibold text-gray-900">오늘의 운동</h3>
          </div>
          <div className="p-3">
            <div className="text-center py-4 text-gray-500">
              <span className="text-2xl mb-2 block">📝</span>
              <p className="text-xs">아직 처방된 운동이 없습니다</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => router.push('/exercises')}
            className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <span className="text-xl mb-1.5 block">💪</span>
            <p className="font-semibold text-gray-900 text-sm">운동 보기</p>
            <p className="text-xs text-gray-600">운동 라이브러리</p>
          </button>
          <button 
            onClick={() => router.push('/pain')}
            className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <span className="text-xl mb-1.5 block">📊</span>
            <p className="font-semibold text-gray-900 text-sm">통증 기록</p>
            <p className="text-xs text-gray-600">오늘 통증 수준 입력</p>
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 flex justify-around py-3">
          <button className="flex flex-col items-center gap-1 text-blue-500">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">홈</span>
          </button>
          <button 
            onClick={() => router.push('/exercises')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">💪</span>
            <span className="text-xs">운동</span>
          </button>
          <button 
            onClick={() => router.push('/progress')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">📈</span>
            <span className="text-xs">진행상황</span>
          </button>
          <button 
            onClick={() => router.push('/settings')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs">설정</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
