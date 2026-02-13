'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

export default function ProgressPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [painLogs, setPainLogs] = useState<any[]>([])
  const [exerciseLogs, setExerciseLogs] = useState<any[]>([])
  const [weekDays, setWeekDays] = useState<string[]>([])
  const [tab, setTab] = useState<'all' | 'pain' | 'exercise'>('all')

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchPainLogs(data.user.id)
          fetchExerciseLogs(data.user.id)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))

    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }))
    }
    setWeekDays(days)
  }, [router])

  const fetchPainLogs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('pain_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })

      if (!error && data) {
        const convertedLogs = data.map((log) => ({
          type: 'pain' as const,
          userId: log.user_id,
          painLevel: log.pain_level,
          painAreas: log.pain_areas || [],
          painPatterns: log.pain_patterns || [],
          notes: log.notes || '',
          loggedAt: log.logged_at,
        }))
        setPainLogs(convertedLogs)
      }
    } catch (error) {
      console.error('Pain fetch error:', error)
    }
  }

  const fetchExerciseLogs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })

      if (!error && data) {
        const convertedLogs = data.map((log) => ({
          type: 'exercise' as const,
          exerciseId: log.exercise_id,
          exerciseName: log.exercise_name || '운동',
          duration: log.duration_seconds || 0,
          setsCompleted: log.sets_completed || 0,
          repsCompleted: log.reps_completed || 0,
          loggedAt: log.completed_at,
        }))
        setExerciseLogs(convertedLogs)
      }
    } catch (error) {
      console.error('Exercise fetch error:', error)
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

  // 통계
  const totalPainLogs = painLogs.length
  const totalExerciseLogs = exerciseLogs.length

  const thisWeekPain = painLogs.filter((log) => {
    const logDate = new Date(log.loggedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return logDate >= weekAgo
  }).length

  const thisWeekExercise = exerciseLogs.filter((log) => {
    const logDate = new Date(log.loggedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return logDate >= weekAgo
  }).length

  const avgPain = painLogs.length > 0
    ? (painLogs.reduce((sum, log) => sum + log.painLevel, 0) / painLogs.length).toFixed(1)
    : '-'

  // 7일 통증 데이터
  const last7DaysPain = weekDays.map((day, index) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - (6 - index))
    targetDate.setHours(0, 0, 0, 0)

    const dayLogs = painLogs.filter((l) => {
      const logDate = new Date(l.loggedAt)
      logDate.setHours(0, 0, 0, 0)
      return logDate.getTime() === targetDate.getTime()
    })

    if (dayLogs.length === 0) return 0
    const sum = dayLogs.reduce((total: number, log: any) => total + log.painLevel, 0)
    return Math.round(sum / dayLogs.length * 10) / 10
  })

  // 7일 운동 횟수 데이터
  const last7DaysExercise = weekDays.map((day, index) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - (6 - index))
    targetDate.setHours(0, 0, 0, 0)

    return exerciseLogs.filter((l) => {
      const logDate = new Date(l.loggedAt)
      logDate.setHours(0, 0, 0, 0)
      return logDate.getTime() === targetDate.getTime()
    }).length
  })

  const maxExercise = Math.max(...last7DaysExercise, 1)

  // 최근 활동 합치기
  const allActivities = [
    ...painLogs.map(log => ({ ...log, type: 'pain' as const })),
    ...exerciseLogs.map(log => ({ ...log, type: 'exercise' as const })),
  ].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())

  const filteredActivities = tab === 'all'
    ? allActivities
    : tab === 'pain'
    ? allActivities.filter(a => a.type === 'pain')
    : allActivities.filter(a => a.type === 'exercise')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">진행상황</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">이번 주 운동</p>
            <p className="text-2xl font-bold text-blue-600">{thisWeekExercise}회</p>
            <p className="text-xs text-gray-400">총 {totalExerciseLogs}회</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">이번 주 통증기록</p>
            <p className="text-2xl font-bold text-orange-600">{thisWeekPain}회</p>
            <p className="text-xs text-gray-400">평균 {avgPain}</p>
          </div>
        </div>

        {/* 통증 그래프 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">지난 7일 통증 추이</h2>
          <p className="text-xs text-gray-400 mb-4">낮을수록 좋아요</p>

          <div className="h-48 flex items-end justify-between gap-2">
            {last7DaysPain.map((painValue, index) => {
              const percentage = (painValue / 10) * 100
              return (
                <div key={`pain-${index}`} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-36">
                    {painValue > 0 && (
                      <span className="text-xs font-bold text-gray-700 mb-1">{painValue}</span>
                    )}
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        painValue === 0 ? 'bg-gray-100' :
                        painValue <= 3 ? 'bg-green-400' :
                        painValue <= 6 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ height: `${Math.max(percentage, painValue > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">{weekDays[index]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 운동 그래프 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">지난 7일 운동 기록</h2>
          <p className="text-xs text-gray-400 mb-4">많을수록 좋아요</p>

          <div className="h-48 flex items-end justify-between gap-2">
            {last7DaysExercise.map((count, index) => {
              const percentage = (count / maxExercise) * 100
              return (
                <div key={`ex-${index}`} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-36">
                    {count > 0 && (
                      <span className="text-xs font-bold text-gray-700 mb-1">{count}</span>
                    )}
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        count === 0 ? 'bg-gray-100' : 'bg-blue-400'
                      }`}
                      style={{ height: `${Math.max(percentage, count > 0 ? 15 : 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">{weekDays[index]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">최근 활동</h2>

          {/* 탭 */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all' as const, label: '전체' },
              { key: 'exercise' as const, label: '운동' },
              { key: 'pain' as const, label: '통증' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  tab === t.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filteredActivities.length === 0 ? (
            <p className="text-center text-gray-500 py-8">아직 기록이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {filteredActivities.slice(0, 15).map((activity, index) => (
                <div
                  key={index}
                  className={`border-l-4 pl-4 py-2 ${
                    activity.type === 'exercise' ? 'border-blue-500' : 'border-orange-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span>{activity.type === 'exercise' ? '💪' : '📊'}</span>
                      <p className="font-semibold text-gray-900 text-sm">
                        {activity.type === 'exercise'
                          ? activity.exerciseName
                          : `통증 수준: ${activity.painLevel}`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(activity.loggedAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {activity.type === 'exercise' && (
                    <p className="text-xs text-gray-500">
                      {activity.setsCompleted > 0 && `${activity.setsCompleted}세트`}
                      {activity.repsCompleted > 0 && ` ${activity.repsCompleted}회`}
                      {activity.duration > 0 && ` · ${Math.round(activity.duration / 60)}분`}
                    </p>
                  )}

                  {activity.type === 'pain' && activity.painAreas?.length > 0 && (
                    <p className="text-xs text-gray-500">
                      부위: {activity.painAreas.join(', ')}
                    </p>
                  )}

                  {activity.type === 'pain' && activity.notes && (
                    <p className="text-xs text-gray-500 mt-0.5">{activity.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav role={user.role || 'patient'} />
    </div>
  )
}
