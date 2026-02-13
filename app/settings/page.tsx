'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { removeToken } from '@/lib/token-storage'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'

interface User {
  id: string
  name: string
  email: string
  subscription_type?: string
  role?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await fetch('/api/auth/logout', { method: 'POST' })
      await removeToken()
      router.push('/login')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  const subscriptionLabel =
    user.subscription_type === 'PREMIUM' ? '프리미엄 회원' :
    user.subscription_type === 'PLATINUM_PATIENT' ? '플래티넘 환자' :
    user.subscription_type === 'TRIAL' ? '무료 체험' : '일반 회원'

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
              <p className="text-xs text-blue-600 mt-1">{subscriptionLabel}</p>
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

      <BottomNav role={user.role || 'patient'} />
    </div>
  )
}
