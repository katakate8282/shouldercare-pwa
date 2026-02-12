'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface ExerciseLog {
  id: string
  user_id: string
  exercise_name: string
  sets_completed: number
  reps_completed: number
  completed_at: string
}

interface RankItem {
  userId: string
  name: string
  weekExercises: number
  achievementRate: number
}

// 레벨 시스템 설정
const LEVEL_CONFIG = [
  { level: 1, name: '🌱 새싹', minXP: 0 },
  { level: 2, name: '🌿 성장', minXP: 50 },
  { level: 3, name: '🌳 든든', minXP: 150 },
  { level: 4, name: '💪 강인', minXP: 350 },
  { level: 5, name: '🔥 불꽃', minXP: 600 },
  { level: 6, name: '⭐ 스타', minXP: 1000 },
  { level: 7, name: '🏆 챔피언', minXP: 1500 },
  { level: 8, name: '👑 마스터', minXP: 2500 },
]

function getLevel(xp: number) {
  let current = LEVEL_CONFIG[0]
  for (const config of LEVEL_CONFIG) {
    if (xp >= config.minXP) current = config
    else break
  }
  const nextLevel = LEVEL_CONFIG.find(c => c.minXP > xp)
  const progress = nextLevel
    ? Math.round(((xp - current.minXP) / (nextLevel.minXP - current.minXP)) * 100)
    : 100
  return { ...current, xp, progress, nextLevelXP: nextLevel?.minXP || current.minXP }
}

export default function MyStatsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 주간 리포트
  const [weekExercises, setWeekExercises] = useState(0)
  const [weekPrescribedCount, setWeekPrescribedCount] = useState(0)
  const [achievementRate, setAchievementRate] = useState(0)
  const [painChange, setPainChange] = useState<{ first: number; latest: number } | null>(null)

  // 스트릭
  const [streak, setStreak] = useState(0)

  // 레벨
  const [totalXP, setTotalXP] = useState(0)

  // 순위
  const [rankings, setRankings] = useState<RankItem[]>([])
  const [myRank, setMyRank] = useState(0)

  // 운동 기록
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchAllStats(data.user.id)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const fetchAllStats = async (userId: string) => {
    await Promise.all([
      fetchWeeklyReport(userId),
      fetchStreak(userId),
      fetchXP(userId),
      fetchRankings(userId),
      fetchExerciseLogs(userId),
      fetchPainChange(userId),
    ])
  }

  const fetchWeeklyReport = async (userId: string) => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    // 이번 주 운동 수
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_at', weekAgo.toISOString())

    const weekCount = logs?.length || 0
    setWeekExercises(weekCount)

    // 처방 목표
    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('frequency_per_week')
      .eq('patient_id', userId)
      .eq('status', 'active')

    if (prescriptions && prescriptions.length > 0) {
      const totalTarget = prescriptions.reduce((sum, p) => sum + (p.frequency_per_week || 0), 0)
      setWeekPrescribedCount(totalTarget)
      setAchievementRate(totalTarget > 0 ? Math.min(Math.round((weekCount / totalTarget) * 100), 100) : 0)
    }
  }

  const fetchPainChange = async (userId: string) => {
    const { data: painLogs } = await supabase
      .from('pain_logs')
      .select('pain_level, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: true })

    if (painLogs && painLogs.length >= 2) {
      setPainChange({
        first: painLogs[0].pain_level,
        latest: painLogs[painLogs.length - 1].pain_level,
      })
    }
  }

  const fetchStreak = async (userId: string) => {
    // 최근 60일 운동 기록으로 스트릭 계산
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', sixtyDaysAgo.toISOString())
      .order('completed_at', { ascending: false })

    if (!logs || logs.length === 0) {
      setStreak(0)
      return
    }

    // 날짜별 그룹화 (KST)
    const exerciseDates = new Set<string>()
    logs.forEach(log => {
      const date = new Date(log.completed_at)
      // KST 변환
      date.setHours(date.getHours() + 9)
      exerciseDates.add(date.toISOString().split('T')[0])
    })

    // 오늘부터 거꾸로 연속 일수 계산
    let count = 0
    const today = new Date()
    today.setHours(today.getHours() + 9)
    const todayStr = today.toISOString().split('T')[0]

    // 오늘 운동 안 했으면 어제부터 체크
    let checkDate = new Date(today)
    if (!exerciseDates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0]
      if (exerciseDates.has(dateStr)) {
        count++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    setStreak(count)
  }

  const fetchXP = async (userId: string) => {
    // XP 계산: 운동 1회 = 10XP, 통증 기록 = 5XP
    const { count: exerciseCount } = await supabase
      .from('exercise_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: painCount } = await supabase
      .from('pain_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const xp = (exerciseCount || 0) * 10 + (painCount || 0) * 5
    setTotalXP(xp)
  }

  const fetchRankings = async (userId: string) => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    // 모든 환자
    const { data: patients } = await supabase
      .from('users')
      .select('id, name')
      .not('role', 'in', '("trainer","admin")')

    if (!patients) return

    // 모든 운동 기록
    const { data: allLogs } = await supabase
      .from('exercise_logs')
      .select('user_id')
      .gte('completed_at', weekAgo.toISOString())

    // 모든 처방
    const { data: allPrescriptions } = await supabase
      .from('prescriptions')
      .select('patient_id, frequency_per_week')
      .eq('status', 'active')

    const rankList: RankItem[] = patients.map(p => {
      const exercises = (allLogs || []).filter(l => l.user_id === p.id).length
      const prescriptions = (allPrescriptions || []).filter(rx => rx.patient_id === p.id)
      const target = prescriptions.reduce((sum, rx) => sum + (rx.frequency_per_week || 0), 0)
      const rate = target > 0 ? Math.min(Math.round((exercises / target) * 100), 100) : (exercises > 0 ? 100 : 0)

      return {
        userId: p.id,
        name: p.name,
        weekExercises: exercises,
        achievementRate: rate,
      }
    })

    // 달성률 높은 순 → 운동 수 높은 순
    rankList.sort((a, b) => {
      if (b.achievementRate !== a.achievementRate) return b.achievementRate - a.achievementRate
      return b.weekExercises - a.weekExercises
    })

    setRankings(rankList)
    const myIdx = rankList.findIndex(r => r.userId === userId)
    setMyRank(myIdx + 1)
  }

  const fetchExerciseLogs = async (userId: string) => {
    const { data } = await supabase
      .from('exercise_logs')
      .select('id, user_id, exercise_name, sets_completed, reps_completed, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(20)

    if (data) setExerciseLogs(data)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  const level = getLevel(totalXP)
  const rankEmoji = myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏅'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-600">
            <span className="text-2xl">←</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900">내 기록</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* 레벨 + 스트릭 */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm opacity-80">Lv.{level.level}</p>
              <p className="text-xl font-bold">{level.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">🔥 {streak}일</p>
              <p className="text-xs opacity-80">연속 운동</p>
            </div>
          </div>
          {/* XP 프로그레스 바 */}
          <div className="mb-1 flex items-center justify-between text-xs opacity-80">
            <span>{level.xp} XP</span>
            <span>{level.nextLevelXP} XP</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-white"
              style={{ width: `${level.progress}%` }}
            />
          </div>
          <p className="text-xs opacity-70 mt-1.5">운동 1회 = 10XP · 통증 기록 = 5XP</p>
        </div>

        {/* 주간 리포트 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">📊 이번 주 리포트</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{weekExercises}</p>
              <p className="text-xs text-gray-500">운동 횟수</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                achievementRate >= 80 ? 'text-green-600' :
                achievementRate >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {weekPrescribedCount > 0 ? `${achievementRate}%` : '-'}
              </p>
              <p className="text-xs text-gray-500">처방 달성률</p>
            </div>
            <div className="text-center">
              {painChange ? (
                <>
                  <p className={`text-2xl font-bold ${
                    painChange.latest < painChange.first ? 'text-green-600' :
                    painChange.latest > painChange.first ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {painChange.latest < painChange.first
                      ? `↓${painChange.first - painChange.latest}`
                      : painChange.latest > painChange.first
                        ? `↑${painChange.latest - painChange.first}`
                        : '→0'}
                  </p>
                  <p className="text-xs text-gray-500">통증 변화</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-400">-</p>
                  <p className="text-xs text-gray-500">통증 변화</p>
                </>
              )}
            </div>
          </div>
          {weekPrescribedCount > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>처방 달성</span>
                <span>{weekExercises}/{weekPrescribedCount}회</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    achievementRate >= 80 ? 'bg-green-500' :
                    achievementRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(achievementRate, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 순위 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">🏆 이번 주 순위</h2>
          {rankings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">순위 데이터 없음</p>
          ) : (
            <>
              {/* 내 순위 하이라이트 */}
              <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{rankEmoji}</span>
                  <div>
                    <p className="font-bold text-gray-900">{myRank}위</p>
                    <p className="text-xs text-gray-500">전체 {rankings.length}명 중</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{weekExercises}회</p>
                  <p className="text-xs text-gray-500">이번 주</p>
                </div>
              </div>

              {/* 상위 5명 */}
              <div className="space-y-2">
                {rankings.slice(0, 5).map((item, idx) => {
                  const isMe = item.userId === user.id
                  const emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
                  return (
                    <div
                      key={item.userId}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        isMe ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold w-6 text-center">{emoji}</span>
                        <p className={`text-sm ${isMe ? 'font-bold text-blue-700' : 'text-gray-700'}`}>
                          {item.name} {isMe && '(나)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{item.weekExercises}회</span>
                        <span className={`text-sm font-bold ${
                          item.achievementRate >= 80 ? 'text-green-600' :
                          item.achievementRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {item.achievementRate}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* 운동 기록 리스트 */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">📋 운동 기록</h2>
          </div>
          {exerciseLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-2xl mb-2">💪</p>
              <p className="text-sm">아직 운동 기록이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {exerciseLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{log.exercise_name}</p>
                    <p className="text-xs text-gray-500">
                      {log.sets_completed}세트 × {log.reps_completed}회
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{formatDate(log.completed_at)}</p>
                    <p className="text-xs text-gray-400">{formatTime(log.completed_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-lg mx-auto px-4 flex justify-around py-3">
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
          <button className="flex flex-col items-center gap-1 text-blue-500">
            <span className="text-xl">📊</span>
            <span className="text-xs font-medium">내 기록</span>
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
