'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [isIOS, setIsIOS] = useState(false)
  const [isPWA, setIsPWA] = useState(false)

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)

    // Detect if running as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    setIsPWA(standalone)
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-4xl">🏥</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            어깨케어
          </h1>
          <p className="text-lg text-gray-600">
            AI 기반 어깨 재활 전문 플랫폼
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 py-8">
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm">
            <span className="text-2xl">📹</span>
            <div className="text-left">
              <p className="font-semibold text-gray-900">AI 자세 분석</p>
              <p className="text-sm text-gray-600">실시간 운동 피드백</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm">
            <span className="text-2xl">💬</span>
            <div className="text-left">
              <p className="font-semibold text-gray-900">1:1 전문 트레이너</p>
              <p className="text-sm text-gray-600">물리치료사 상담</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm">
            <span className="text-2xl">📊</span>
            <div className="text-left">
              <p className="font-semibold text-gray-900">진행 상황 추적</p>
              <p className="text-sm text-gray-600">통증, ROM 자동 기록</p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Link 
            href="/login"
            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
          >
            카카오로 시작하기
          </Link>
          
          {!isPWA && (
            <div className="text-sm text-gray-600 p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold mb-2">💡 앱처럼 사용하기</p>
              <p className="text-xs">
                {isIOS 
                  ? 'Safari에서 공유 버튼 → 홈 화면에 추가'
                  : 'Chrome 메뉴 → 홈 화면에 추가'}
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 pt-4">
          <p>플래티넘의원 제휴 서비스</p>
          <p className="mt-1">이동규 원장 감수</p>
        </div>
      </div>

      {/* Dev Info */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-400">
        <p>v0.1.0-alpha</p>
        <p>iOS: {isIOS ? '✅' : '❌'}</p>
        <p>PWA: {isPWA ? '✅' : '❌'}</p>
      </div>
    </main>
  )
}
