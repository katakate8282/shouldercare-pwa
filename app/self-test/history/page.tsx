'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface TestResult {
  id: string
  estimated_condition: string
  pain_intensity: number
  see_doctor_flag: boolean
  created_at: string
}

export default function HistoryPage() {
  const router = useRouter()
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login')
          return
        }
        setUserId(data.user.id)
        return fetch(`/api/ai/results?userId=${data.user.id}`)
      })
      .then(res => res?.json())
      .then(data => {
        if (data?.results) {
          setResults(data.results)
        }
      })
      .catch(err => console.error('History fetch error:', err))
      .finally(() => setLoading(false))
  }, [router])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const getPainColor = (level: number) => {
    if (level <= 3) return '#22C55E'
    if (level <= 6) return '#F59E0B'
    return '#EF4444'
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 50%, #C4B5FD 100%)' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center">
          <button onClick={() => router.push('/dashboard')} className="mr-3 text-white/80">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-base font-bold text-white">AI 분석 기록</h1>
          <span className="ml-auto text-xs text-white/60">{results.length}건</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* 새 테스트 버튼 */}
        <button
          onClick={() => router.push('/self-test')}
          className="w-full rounded-xl p-4 mb-4 text-left relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
        >
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-white/10 -mr-4 -mt-4" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-xl">🤖</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">새 AI 자가테스트</p>
              <p className="text-white/70 text-xs mt-0.5">설문 + ROM 측정 → 맞춤 분석</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">불러오는 중...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl mb-4 block">📋</span>
            <p className="text-base font-bold text-slate-700 mb-1">아직 분석 기록이 없어요</p>
            <p className="text-sm text-slate-400">AI 자가테스트를 시작해보세요!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 mb-1">분석 기록</p>
            {results.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => router.push(`/self-test/result?id=${item.id}`)}
                className="w-full bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition flex items-center gap-3"
              >
                {/* 번호/아이콘 */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  item.see_doctor_flag ? 'bg-red-50' : 'bg-violet-50'
                }`}>
                  {item.see_doctor_flag ? (
                    <span className="text-lg">🏥</span>
                  ) : (
                    <span className="text-lg">🔍</span>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {item.estimated_condition || 'AI 분석 완료'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-400">
                      {formatDate(item.created_at)}
                    </span>
                    <span className="text-[11px] text-slate-300">·</span>
                    <span className="text-[11px] text-slate-400">
                      {formatTime(item.created_at)}
                    </span>
                  </div>
                </div>

                {/* 통증 강도 배지 */}
                <div className="shrink-0 flex flex-col items-center">
                  <span
                    className="text-lg font-bold"
                    style={{ color: getPainColor(item.pain_intensity) }}
                  >
                    {item.pain_intensity}
                  </span>
                  <span className="text-[9px] text-slate-400">/10</span>
                </div>

                {/* 화살표 */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
