'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function ProgressPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [painLogs, setPainLogs] = useState<any[]>([])
  const [weekDays, setWeekDays] = useState<string[]>([])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    const fetchPainLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('pain_logs')
          .select('*')
          .eq('user_id', user?.id)
          .order('logged_at', { ascending: false })

        if (error) {
          console.error('Supabase error:', error)
          const logs = JSON.parse(localStorage.getItem('painLogs') || '[]')
          setPainLogs(logs)
        } else {
          const convertedLogs = data.map((log) => ({
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
        console.error('Fetch error:', error)
        const logs = JSON.parse(localStorage.getItem('painLogs') || '[]')
        setPainLogs(logs)
      }
    }

    fetchPainLogs()

    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }))
    }
    setWeekDays(days)
  }, [isAuthenticated, router, user])

  if (!user) return null

  const totalLogs = painLogs.length
  const thisWeekLogs = painLogs.filter((log) => {
    const logDate = new Date(log.loggedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return logDate >= weekAgo
  }).length

  const avgPain = painLogs.length > 0
    ? (painLogs.reduce((sum, log) => sum + log.painLevel, 0) / painLogs.length).toFixed(1)
    : '0'

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
    const sum = dayLogs.reduce((total, log) => total + log.painLevel, 0)
    return Math.round(sum / dayLogs.length * 10) / 10
  })

  const maxPain = 10

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
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">총 기록</p>
            <p className="text-2xl font-bold text-blue-600">{totalLogs}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">이번 주</p>
            <p className="text-2xl font-bold text-green-600">{thisWeekLogs}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">평균 통증</p>
            <p className="text-2xl font-bold text-orange-600">{avgPain}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">지난 7일 통증 추이</h2>
          
          <div className="h-64 flex items-end justify-between gap-2">
            {last7DaysPain.map((painValue, index) => {
              const percentage = (painValue / maxPain) * 100
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-52">
                    {painValue > 0 && (
                      <span className="text-sm font-bold text-blue-600 mb-1">
                        {painValue}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        painValue === 0
                          ? 'bg-gray-200'
                          : painValue <= 3
                          ? 'bg-green-500'
                          : painValue <= 6
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ height: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 mt-2 text-center">
                    {weekDays[index]}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-200 mt-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0</span>
            <span>통증 수준</span>
            <span>10</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">최근 활동</h2>
          
          {painLogs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">아직 기록이 없습니다</p>
          ) : (
            <div className="space-y-4">
              {painLogs.slice(0, 10).map((log, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-gray-900">
                      통증 수준: {log.painLevel}
                    </p>
                    <span className="text-sm text-gray-500">
                      {new Date(log.loggedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  {log.painAreas.length > 0 && (
                    <p className="text-sm text-gray-600">
                      부위: {log.painAreas.join(', ')}
                    </p>
                  )}
                  {log.notes && (
                    <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
