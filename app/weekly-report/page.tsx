'use client'

import { useState, useEffect } from 'react'
import { fetchAuthMe } from '@/lib/fetch-auth'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

interface WeeklyReport {
  id: string
  user_id: string
  week_start: string
  week_end: string
  exercise_days: number
  total_exercises: number
  exercise_completion_rate: number
  pain_average: number | null
  pain_change: number | null
  pain_logs_count: number
  prescription_count: number
  message_count: number
  self_test_rom: any
  self_test_pain: number | null
  ai_analysis_count: number
  ai_avg_quality_score: number | null
  ai_best_exercise: string | null
  ai_summary: string | null
  created_at: string
}

export default function WeeklyReportPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchAuthMe()
        if (!res.ok) { router.push('/login'); return }
        const data = await res.json()
        setUser(data.user)

        const { data: reps } = await supabase
          .from('weekly_reports')
          .select('*')
          .eq('user_id', data.user.id)
          .order('week_start', { ascending: false })
          .limit(12)

        if (reps && reps.length > 0) {
          setReports(reps)
          setSelectedReport(reps[0])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">리포트 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 50) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getCompletionEmoji = (rate: number) => {
    if (rate >= 80) return '🎉'
    if (rate >= 50) return '💪'
    return '📊'
  }

  const getPainChangeText = (change: number | null) => {
    if (change === null) return null
    if (change < 0) return { text: `${Math.abs(change)}점 감소`, color: 'text-green-600', emoji: '📉' }
    if (change > 0) return { text: `${change}점 증가`, color: 'text-red-500', emoji: '📈' }
    return { text: '변화 없음', color: 'text-gray-500', emoji: '➡️' }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return '훌륭해요!'
    if (score >= 80) return '잘하고 있어요'
    if (score >= 60) return '조금 더 신경 써봐요'
    return '개선이 필요해요'
  }

  const getDayLabels = () => ['월', '화', '수', '목', '금', '토', '일']

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">주간 리포트</h1>
          <button onClick={() => window.open("/api/report-pdf?type=weekly", "_blank")} className="text-sky-500 text-sm font-medium">PDF</button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">

        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-3">📋</p>
            <h3 className="font-bold text-gray-900 mb-2">아직 리포트가 없어요</h3>
            <p className="text-sm text-gray-500">매주 월요일 자동으로 주간 리포트가 생성됩니다.</p>
          </div>
        ) : (
          <>
            {/* 주차 선택 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {reports.map((r) => (
                <button
                  key={r.week_start}
                  onClick={() => setSelectedReport(r)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                    selectedReport?.week_start === r.week_start
                      ? 'bg-sky-500 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {formatDate(r.week_start)} ~ {formatDate(r.week_end)}
                </button>
              ))}
            </div>

            {selectedReport && (
              <>
                {/* 운동 완료율 */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="text-center mb-4">
                    <span className="text-4xl">{getCompletionEmoji(selectedReport.exercise_completion_rate)}</span>
                    <h2 className="text-lg font-bold text-gray-900 mt-2">이번 주 운동 리포트</h2>
                    <p className="text-xs text-gray-400">{formatDate(selectedReport.week_start)} ~ {formatDate(selectedReport.week_end)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center bg-sky-50 rounded-xl p-3">
                      <p className={`text-2xl font-bold ${getCompletionColor(selectedReport.exercise_completion_rate)}`}>
                        {selectedReport.exercise_completion_rate}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">운동 완료율</p>
                    </div>
                    <div className="text-center bg-sky-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-sky-600">{selectedReport.exercise_days}일</p>
                      <p className="text-xs text-gray-500 mt-1">운동한 날</p>
                    </div>
                    <div className="text-center bg-sky-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-sky-600">{selectedReport.total_exercises}회</p>
                      <p className="text-xs text-gray-500 mt-1">총 운동 횟수</p>
                    </div>
                  </div>

                  {/* 일별 운동 달성 바 */}
                  <div className="flex justify-between gap-1">
                    {getDayLabels().map((day, i) => (
                      <div key={day} className="flex-1 text-center">
                        <div className={`h-8 rounded-md flex items-center justify-center text-xs font-bold ${
                          i < selectedReport.exercise_days ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {i < selectedReport.exercise_days ? '✅' : '−'}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{day}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI 자세 분석 요약 */}
                {selectedReport.ai_analysis_count > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3">🤖 AI 자세 분석 요약</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-purple-600">{selectedReport.ai_analysis_count}건</p>
                        <p className="text-xs text-gray-500 mt-1">AI 분석 횟수</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        {selectedReport.ai_avg_quality_score !== null ? (
                          <>
                            <p className={`text-2xl font-bold ${getScoreColor(selectedReport.ai_avg_quality_score)}`}>
                              {selectedReport.ai_avg_quality_score}점
                            </p>
                            <p className="text-xs text-gray-500 mt-1">평균 자세 점수</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-gray-400">-</p>
                            <p className="text-xs text-gray-500 mt-1">평균 자세 점수</p>
                          </>
                        )}
                      </div>
                    </div>

                    {selectedReport.ai_avg_quality_score !== null && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">자세 점수</span>
                          <span className={`text-xs font-medium ${getScoreColor(selectedReport.ai_avg_quality_score)}`}>
                            {getScoreLabel(selectedReport.ai_avg_quality_score)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              selectedReport.ai_avg_quality_score >= 80 ? 'bg-green-500' :
                              selectedReport.ai_avg_quality_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(selectedReport.ai_avg_quality_score, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {selectedReport.ai_best_exercise && (
                      <div className="bg-green-50 rounded-lg p-3 mb-3">
                        <p className="text-xs text-green-700">
                          <span className="font-bold">🏆 가장 잘한 운동:</span> {selectedReport.ai_best_exercise}
                        </p>
                      </div>
                    )}

                    {selectedReport.ai_summary && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 leading-relaxed">
                          <span className="font-bold text-gray-700">💬 AI 코멘트:</span> {selectedReport.ai_summary}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => router.push('/my-exercise-video')}
                      className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium text-purple-600 border border-purple-200 hover:bg-purple-50 transition"
                    >
                      내 운동 영상 보기 →
                    </button>
                  </div>
                )}

                {/* AI 분석 없을 때 안내 */}
                {selectedReport.ai_analysis_count === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3">🤖 AI 자세 분석</h3>
                    <div className="text-center py-3">
                      <p className="text-3xl mb-2">📹</p>
                      <p className="text-sm text-gray-500 mb-1">이번 주 AI 자세 분석이 없어요</p>
                      <p className="text-xs text-gray-400 mb-3">운동 영상을 올리면 AI가 자세를 분석해줘요</p>
                      <button
                        onClick={() => router.push('/my-exercise-video')}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-purple-600 border border-purple-200 hover:bg-purple-50 transition"
                      >
                        영상 업로드하러 가기 →
                      </button>
                    </div>
                  </div>
                )}

                {/* 통증 변화 */}
                {selectedReport.pain_average !== null && (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 mb-3">📊 통증 변화</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-gray-800">{selectedReport.pain_average}</p>
                        <p className="text-xs text-gray-500 mt-1">평균 통증 (0~10)</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        {(() => {
                          const info = getPainChangeText(selectedReport.pain_change)
                          if (!info) return <p className="text-sm text-gray-400">데이터 부족</p>
                          return (
                            <>
                              <p className={`text-lg font-bold ${info.color}`}>{info.emoji} {info.text}</p>
                              <p className="text-xs text-gray-500 mt-1">주간 변화</p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">이번 주 통증 기록 {selectedReport.pain_logs_count}건</p>
                  </div>
                )}

                {/* 활동 요약 */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3">📝 활동 요약</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">💊 새 운동 제안</span>
                      <span className="text-sm font-bold text-gray-900">{selectedReport.prescription_count}건</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">💬 트레이너 메시지</span>
                      <span className="text-sm font-bold text-gray-900">{selectedReport.message_count}건</span>
                    </div>
                    {selectedReport.ai_analysis_count > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">🤖 AI 자세 분석</span>
                        <span className="text-sm font-bold text-purple-600">{selectedReport.ai_analysis_count}건</span>
                      </div>
                    )}
                    {selectedReport.self_test_rom && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">📐 자가테스트 ROM</span>
                        <span className="text-sm font-bold text-gray-900">
                          {typeof selectedReport.self_test_rom === 'object'
                            ? `${selectedReport.self_test_rom.flexion || '-'}°`
                            : `${selectedReport.self_test_rom}°`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 격려 메시지 */}
                <div className="bg-gradient-to-r from-sky-500 to-blue-500 rounded-2xl shadow-sm p-5 text-white">
                  <p className="text-sm font-medium">
                    {selectedReport.exercise_completion_rate >= 80
                      ? '🎉 훌륭해요! 이번 주도 성실하게 재활하셨습니다. 이 페이스를 유지하면 더 빠른 회복을 기대할 수 있어요!'
                      : selectedReport.exercise_completion_rate >= 50
                      ? '💪 좋아요! 조금만 더 힘내면 목표에 도달할 수 있어요. 꾸준함이 가장 중요합니다!'
                      : '🌱 이번 주는 조금 쉬어가셨네요. 괜찮아요, 다음 주에 다시 시작하면 됩니다!'}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <BottomNav role={user?.role || 'patient'} />
    </div>
  )
}
