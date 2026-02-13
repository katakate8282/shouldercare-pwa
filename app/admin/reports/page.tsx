'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface Assignment {
  patient_id: string
  trainer_id: string
}

interface WeeklyStats {
  weekLabel: string
  startDate: string
  endDate: string
  totalPatients: number
  activePatients: number
  completionRate: number
  totalExercises: number
}

interface TrainerStats {
  trainerId: string
  trainerName: string
  patientCount: number
  patients: { id: string; name: string }[]
  totalExercises: number
  avgExercisesPerPatient: number
  avgPainReduction: number
  activeRate: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([])
  const [trainerStats, setTrainerStats] = useState<TrainerStats[]>([])
  const [totalPatients, setTotalPatients] = useState(0)
  const [totalTrainers, setTotalTrainers] = useState(0)
  const [generating, setGenerating] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          if (data.user.role !== 'admin') {
            router.push('/dashboard')
            return
          }
          setUser(data.user)
          fetchAllStats()
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const fetchAllStats = async () => {
    await Promise.all([fetchWeeklyStats(), fetchTrainerStats(), fetchCounts()])
  }

  const fetchCounts = async () => {
    const { count: pCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('role', 'in', '("trainer","admin")')
    setTotalPatients(pCount || 0)

    const { count: tCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'trainer')
    setTotalTrainers(tCount || 0)
  }

  const fetchWeeklyStats = async () => {
    const weeks: WeeklyStats[] = []

    // 최근 4주
    for (let i = 0; i < 4; i++) {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() - (i * 7))
      endDate.setHours(23, 59, 59, 999)

      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)

      const weekLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`

      // 해당 주 운동 기록
      const { data: exerciseLogs } = await supabase
        .from('exercise_logs')
        .select('user_id')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())

      const activeUsers = new Set(exerciseLogs?.map(l => l.user_id) || [])

      // 전체 환자 수
      const { count: patientCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('role', 'in', '("trainer","admin")')

      const total = patientCount || 1
      const active = activeUsers.size
      const rate = Math.round((active / total) * 100)

      weeks.push({
        weekLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalPatients: total,
        activePatients: active,
        completionRate: rate,
        totalExercises: exerciseLogs?.length || 0,
      })
    }

    setWeeklyStats(weeks)
  }

  const fetchTrainerStats = async () => {
    // 트레이너 목록
    const { data: trainers } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'trainer')

    if (!trainers) return

    // 배정 정보
    const { data: assignments } = await supabase
      .from('patient_assignments')
      .select('patient_id, trainer_id')

    // 환자 정보
    const { data: patients } = await supabase
      .from('users')
      .select('id, name')
      .not('role', 'in', '("trainer","admin")')

    const patientMap: Record<string, string> = {}
    patients?.forEach(p => { patientMap[p.id] = p.name })

    // 최근 7일 운동 기록
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: exerciseLogs } = await supabase
      .from('exercise_logs')
      .select('user_id')
      .gte('completed_at', weekAgo.toISOString())

    // 통증 데이터 (첫 기록 vs 최근 기록)
    const { data: painLogs } = await supabase
      .from('pain_logs')
      .select('user_id, pain_level, logged_at')
      .order('logged_at', { ascending: true })

    const stats: TrainerStats[] = trainers.map(trainer => {
      const assignedPatientIds = (assignments || [])
        .filter(a => a.trainer_id === trainer.id)
        .map(a => a.patient_id)

      const assignedPatients = assignedPatientIds.map(id => ({
        id,
        name: patientMap[id] || '알 수 없음'
      }))

      // 운동 수
      const trainerExercises = (exerciseLogs || [])
        .filter(l => assignedPatientIds.includes(l.user_id))

      const activePatients = new Set(trainerExercises.map(l => l.user_id))

      // 통증 감소율
      let painReductions: number[] = []
      assignedPatientIds.forEach(pid => {
        const pLogs = (painLogs || []).filter(l => l.user_id === pid)
        if (pLogs.length >= 2) {
          const first = pLogs[0].pain_level
          const last = pLogs[pLogs.length - 1].pain_level
          painReductions.push(first - last)
        }
      })

      const avgPainReduction = painReductions.length > 0
        ? Math.round(painReductions.reduce((a, b) => a + b, 0) / painReductions.length * 10) / 10
        : 0

      return {
        trainerId: trainer.id,
        trainerName: trainer.name,
        patientCount: assignedPatientIds.length,
        patients: assignedPatients,
        totalExercises: trainerExercises.length,
        avgExercisesPerPatient: assignedPatientIds.length > 0
          ? Math.round(trainerExercises.length / assignedPatientIds.length * 10) / 10
          : 0,
        avgPainReduction,
        activeRate: assignedPatientIds.length > 0
          ? Math.round((activePatients.size / assignedPatientIds.length) * 100)
          : 0,
      }
    })

    setTrainerStats(stats)
  }

  // PDF 다운로드 (브라우저 프린트)
  const handleDownloadPDF = () => {
    setGenerating(true)
    setTimeout(() => {
      window.print()
      setGenerating(false)
    }, 300)
  }

  // 간이 바 차트
  const BarChart = ({ value, max, color }: { value: number; max: number; color: string }) => {
    const width = max > 0 ? Math.round((value / max) * 100) : 0
    return (
      <div className="w-full bg-gray-100 rounded-full h-4">
        <div
          className={`h-4 rounded-full ${color}`}
          style={{ width: `${Math.min(width, 100)}%` }}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  const maxExercises = Math.max(...trainerStats.map(t => t.avgExercisesPerPatient), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* 프린트 스타일 */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <header className="bg-white shadow-sm sticky top-0 z-10 no-print">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/admin')} className="text-gray-600">
                <span className="text-2xl">←</span>
              </button>
              <h1 className="text-xl font-bold text-gray-900">통계 리포트</h1>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-blue-300"
            >
              {generating ? '생성 중...' : '📄 PDF 다운로드'}
            </button>
          </div>
        </div>
      </header>

      <div ref={reportRef}>
        {/* 프린트용 헤더 */}
        <div className="hidden print:block px-8 py-6">
          <h1 className="text-2xl font-bold">어깨케어 - 통계 리포트</h1>
          <p className="text-sm text-gray-500 mt-1">
            생성일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">

          {/* 전체 현황 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-blue-600">{totalTrainers}</p>
              <p className="text-xs text-gray-500 mt-1">트레이너</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-green-600">{totalPatients}</p>
              <p className="text-xs text-gray-500 mt-1">전체 환자</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-purple-600">
                {weeklyStats[0]?.completionRate || 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">이번 주 운동률</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-orange-600">
                {weeklyStats[0]?.totalExercises || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">이번 주 운동 수</p>
            </div>
          </div>

          {/* 주별 운동 완료율 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">📊 주별 운동 완료율</h2>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-left py-2 font-medium">기간</th>
                    <th className="text-center py-2 font-medium">활동 환자</th>
                    <th className="text-center py-2 font-medium">운동 수</th>
                    <th className="text-right py-2 font-medium">운동률</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStats.map((week, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="py-3 text-gray-900">{week.weekLabel}</td>
                      <td className="py-3 text-center text-gray-700">
                        {week.activePatients}/{week.totalPatients}명
                      </td>
                      <td className="py-3 text-center text-gray-700">{week.totalExercises}회</td>
                      <td className="py-3 text-right">
                        <span className={`font-bold ${
                          week.completionRate >= 70 ? 'text-green-600' :
                          week.completionRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {week.completionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 트레이너별 성과 비교 */}
          <div className="bg-white rounded-lg shadow-sm print-break">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">👨‍⚕️ 트레이너별 성과 비교</h2>
            </div>
            <div className="divide-y">
              {trainerStats.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  등록된 트레이너가 없습니다
                </div>
              ) : (
                trainerStats.map((trainer) => (
                  <div key={trainer.trainerId} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900 text-base">{trainer.trainerName}</p>
                        <p className="text-xs text-gray-500">
                          담당 환자 {trainer.patientCount}명
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          trainer.activeRate >= 70 ? 'text-green-600' :
                          trainer.activeRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {trainer.activeRate}%
                        </p>
                        <p className="text-xs text-gray-500">활동률</p>
                      </div>
                    </div>

                    {/* 담당 환자 목록 */}
                    {trainer.patients.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">담당 환자:</p>
                        <div className="flex flex-wrap gap-1">
                          {trainer.patients.map(p => (
                            <span key={p.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 성과 지표 */}
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-900">{trainer.totalExercises}</p>
                        <p className="text-[10px] text-gray-500">주간 운동 수</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-900">{trainer.avgExercisesPerPatient}</p>
                        <p className="text-[10px] text-gray-500">인당 평균 운동</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className={`text-sm font-bold ${trainer.avgPainReduction > 0 ? 'text-green-600' : trainer.avgPainReduction < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {trainer.avgPainReduction > 0 ? `-${trainer.avgPainReduction}` : trainer.avgPainReduction === 0 ? '-' : `+${Math.abs(trainer.avgPainReduction)}`}
                        </p>
                        <p className="text-[10px] text-gray-500">평균 통증 변화</p>
                      </div>
                    </div>

                    {/* 인당 평균 운동 바 차트 */}
                    <div className="mt-2">
                      <BarChart
                        value={trainer.avgExercisesPerPatient}
                        max={maxExercises}
                        color="bg-blue-500"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
