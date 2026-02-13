'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Exercise {
  name: string
  sets: number
  reps: number
  reason: string
}

interface AiResult {
  estimated_condition: string
  confidence: string
  analysis: string
  recommended_exercises: Exercise[]
  weekly_frequency: string
  progression_note: string
  precautions: string
  see_doctor_flag: boolean
  see_doctor_reason: string
  disclaimer: string
}

export default function ResultPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AiResult | null>(null)
  const [surveyData, setSurveyData] = useState<any>(null)
  const [romData, setRomData] = useState<any>(null)

  useEffect(() => {
    const survey = sessionStorage.getItem('selftest_survey')
    const rom = sessionStorage.getItem('selftest_rom')

    if (!survey) {
      router.push('/self-test')
      return
    }

    const parsedSurvey = JSON.parse(survey)
    const parsedRom = rom ? JSON.parse(rom) : null
    setSurveyData(parsedSurvey)
    setRomData(parsedRom)

    // AI 분석 요청
    fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey: parsedSurvey, rom: parsedRom }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (data.error) throw new Error(data.error)
        setResult(data.result)
      })
      .catch(err => {
        console.error('AI analyze error:', err)
        setError(err.message || 'AI 분석에 실패했습니다')
      })
      .finally(() => setLoading(false))
  }, [router])

  // 로딩 화면
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}>
            <span className="text-4xl animate-pulse">🤖</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">AI가 분석 중이에요...</h2>
          <p className="text-sm text-slate-500 mb-6">설문과 측정 결과를 종합하고 있습니다</p>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-violet-400"
                style={{
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <style jsx>{`
            @keyframes bounce {
              0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
              40% { transform: translateY(-8px); opacity: 1; }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // 에러 화면
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <span className="text-5xl mb-4 block">😥</span>
          <h2 className="text-lg font-bold text-slate-900 mb-2">분석에 실패했어요</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => { setLoading(true); setError(''); location.reload() }}
              className="w-full py-3 rounded-xl text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
            >
              다시 시도
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl text-slate-500 font-medium text-sm hover:bg-slate-100"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  const confidenceLabel = result.confidence === 'high' ? '높음' : result.confidence === 'medium' ? '보통' : '낮음'
  const confidenceColor = result.confidence === 'high' ? '#22C55E' : result.confidence === 'medium' ? '#F59E0B' : '#94A3B8'

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 50%, #C4B5FD 100%)' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="text-white/80">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-base font-bold text-white">AI 분석 결과</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-2 space-y-3">
        {/* 전문의 상담 권고 (위험 신호) */}
        {result.see_doctor_flag && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏥</span>
              <div>
                <p className="text-sm font-bold text-red-800">전문의 상담을 권장합니다</p>
                <p className="text-xs text-red-600 mt-1">{result.see_doctor_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* 추정 상태 카드 */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔍</span>
            <h2 className="text-base font-bold text-slate-900">추정 상태</h2>
            <span
              className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${confidenceColor}20`, color: confidenceColor }}
            >
              신뢰도: {confidenceLabel}
            </span>
          </div>
          <p className="text-lg font-bold mb-3" style={{ color: '#7C3AED' }}>
            {result.estimated_condition}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {result.analysis}
          </p>
        </div>

        {/* ROM 결과 요약 (측정했을 경우) */}
        {romData && (romData.flexion !== null || romData.abduction !== null || romData.external_rotation !== null) && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📐</span>
              <h3 className="text-sm font-bold text-slate-900">ROM 측정 결과</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'flexion', label: '굴곡', normal: 180 },
                { key: 'abduction', label: '외전', normal: 180 },
                { key: 'external_rotation', label: '외회전', normal: 90 },
              ].map(({ key, label, normal }) => {
                const val = romData[key]
                const pct = val !== null ? Math.round((val / normal) * 100) : 0
                const color = pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'
                return (
                  <div key={key} className="text-center bg-slate-50 rounded-lg py-3">
                    <p className="text-xl font-bold" style={{ color: val !== null ? color : '#94A3B8' }}>
                      {val !== null ? `${val}°` : '-'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    {val !== null && (
                      <p className="text-[9px] mt-0.5" style={{ color }}>{pct}%</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 추천 운동 */}
        {result.recommended_exercises && result.recommended_exercises.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💪</span>
                <h3 className="text-sm font-bold text-slate-900">추천 운동</h3>
              </div>
              <span className="text-xs font-semibold" style={{ color: '#7C3AED' }}>{result.weekly_frequency}</span>
            </div>
            <div className="px-4 pb-4 space-y-2.5">
              {result.recommended_exercises.map((ex, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-slate-800">
                      <span className="text-violet-500 mr-1">{idx + 1}</span>
                      {ex.name}
                    </p>
                    <span className="text-xs text-slate-400 font-medium">{ex.sets}세트 × {ex.reps}회</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{ex.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 진행 가이드 + 주의사항 */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          {result.progression_note && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📈</span>
                <p className="text-xs font-bold text-slate-700">향후 진행 가이드</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed ml-6">{result.progression_note}</p>
            </div>
          )}
          {result.precautions && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">⚠️</span>
                <p className="text-xs font-bold text-slate-700">주의사항</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed ml-6">{result.precautions}</p>
            </div>
          )}
        </div>

        {/* 면책 조항 */}
        <div className="bg-slate-100 rounded-xl p-3.5">
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            {result.disclaimer || '이 결과는 AI 참고용이며 의학적 진단이 아닙니다. 정확한 진단은 전문의 상담을 받으세요.'}
          </p>
        </div>

        {/* 하단 버튼 */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            대시보드로 돌아가기
          </button>
          <button
            onClick={() => router.push('/self-test')}
            className="w-full py-3 rounded-xl text-slate-500 font-medium text-sm hover:bg-slate-100 transition"
          >
            다시 테스트하기
          </button>
        </div>
      </main>
    </div>
  )
}
