'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fetchAuthMe } from '@/lib/fetch-auth'

export default function SelfTestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (!data.user) router.push('/login')
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-slate-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-900">AI 자가테스트</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0112 4.5V5a1 1 0 001 1h1.05a2.5 2.5 0 010 5H13a1 1 0 00-1 1v.5a2.5 2.5 0 01-5 0V12a1 1 0 00-1-1h-.5a2.5 2.5 0 010-5H6a1 1 0 001-1v-.5A2.5 2.5 0 019.5 2z"/>
              <circle cx="12" cy="12" r="1"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">AI가 어깨 상태를 분석해드려요</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            간단한 설문과 카메라 측정으로<br/>
            맞춤 운동을 추천받으세요
          </p>
        </div>

        {/* Steps Preview */}
        <div className="space-y-3 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#E0F2FE' }}>
              <span className="text-lg">📋</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Step 1. 통증 설문</p>
              <p className="text-xs text-slate-400 mt-0.5">통증 부위, 강도, 기간 등 10개 질문</p>
            </div>
            <span className="text-xs text-slate-400 ml-auto shrink-0">~3분</span>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
              <span className="text-lg">📸</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Step 2. 어깨 움직임 측정</p>
              <p className="text-xs text-slate-400 mt-0.5">카메라로 3가지 동작 ROM 측정</p>
            </div>
            <span className="text-xs text-slate-400 ml-auto shrink-0">~2분</span>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0FDF4' }}>
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Step 3. AI 분석 결과</p>
              <p className="text-xs text-slate-400 mt-0.5">추정 상태 + 맞춤 운동 추천</p>
            </div>
            <span className="text-xs text-slate-400 ml-auto shrink-0">~10초</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 rounded-xl p-3.5 mb-6">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">⚠️ 참고:</span> AI 분석 결과는 의학적 진단이 아니며, 참고용입니다. 정확한 진단은 전문의 상담을 받으세요.
          </p>
        </div>

        {/* Start Button */}
        <div className="mt-auto">
          <button
            onClick={() => router.push('/self-test/survey')}
            className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg hover:brightness-110 transition"
            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            테스트 시작하기
          </button>
          <p className="text-center text-xs text-slate-400 mt-3">총 소요시간 약 5분 · 무료</p>
        </div>
      </main>
    </div>
  )
}
