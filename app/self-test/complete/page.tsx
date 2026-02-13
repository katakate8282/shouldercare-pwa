'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SelfTestCompletePage() {
  const router = useRouter()
  const [surveyData, setSurveyData] = useState<any>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('selftest_survey')
    if (saved) {
      setSurveyData(JSON.parse(saved))
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
          <button onClick={() => router.push('/dashboard')} className="mr-3 text-slate-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="text-base font-bold text-slate-900">AI 자가테스트</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'linear-gradient(135deg, #22C55E, #4ADE80)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">설문 완료!</h2>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          통증 설문이 저장되었습니다.<br/>
          다음 단계(카메라 ROM 측정)는<br/>
          곧 업데이트될 예정입니다.
        </p>

        {surveyData && (
          <div className="w-full bg-white rounded-xl p-4 shadow-sm mb-6 text-left">
            <p className="text-xs font-semibold text-slate-500 mb-2">설문 요약</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">어깨</span>
                <span className="font-medium text-slate-700">
                  {surveyData.side === 'left' ? '왼쪽' : surveyData.side === 'right' ? '오른쪽' : '양쪽'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">통증 강도</span>
                <span className="font-medium text-slate-700">{surveyData.pain_intensity}/10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">야간 통증</span>
                <span className="font-medium text-slate-700">
                  {surveyData.night_pain === 'none' ? '없음' : surveyData.night_pain === 'sometimes' ? '가끔' : surveyData.night_pain === 'often' ? '자주' : '항상'}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3.5 rounded-xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
        >
          대시보드로 돌아가기
        </button>
      </main>
    </div>
  )
}
