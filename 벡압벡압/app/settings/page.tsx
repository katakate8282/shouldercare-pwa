'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useEffect } from 'react'

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  if (!user) return null

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      logout()
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">설정</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">프로필</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="text-xs text-blue-600 mt-1">
                {user.subscriptionType === 'PREMIUM' ? '프리미엄 회원' : 
                 user.subscriptionType === 'PLATINUM_PATIENT' ? '플래티넘 환자' :
                 user.subscriptionType === 'TRIAL' ? '무료 체험' : '미구독'}
              </p>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">계정 설정</h2>
          <div className="divide-y">
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">👤</span>
                <span className="text-gray-900">프로필 수정</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <span className="text-gray-900">비밀번호 변경</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">앱 설정</h2>
          <div className="divide-y">
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔔</span>
                <span className="text-gray-900">알림 설정</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">🌙</span>
                <span className="text-gray-900">다크 모드</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">준비중</span>
                <span className="text-gray-400">→</span>
              </div>
            </button>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">구독 관리</h2>
          <div className="divide-y">
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">💳</span>
                <span className="text-gray-900">구독 플랜</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">📊</span>
                <span className="text-gray-900">결제 내역</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">지원</h2>
          <div className="divide-y">
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">❓</span>
                <span className="text-gray-900">도움말</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">📧</span>
                <span className="text-gray-900">문의하기</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>
                <span className="text-gray-900">이용약관</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔐</span>
                <span className="text-gray-900">개인정보처리방침</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>

        {/* Version */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>버전</span>
            <span>1.0.0</span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-4 rounded-lg transition-colors"
        >
          로그아웃
        </button>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 flex justify-around py-3">
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs">홈</span>
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
          <button className="flex flex-col items-center gap-1 text-blue-500">
            <span className="text-xl">⚙️</span>
            <span className="text-xs font-medium">설정</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
