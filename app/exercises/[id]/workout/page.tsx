'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getExerciseById, getDifficultyColor } from '@/lib/data/exercises'
import type { Exercise } from '@/lib/data/exercises'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className={`px-6 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`}>
        {message}
      </div>
    </div>
  )
}

export default function WorkoutPage() {
  const router = useRouter()
  const params = useParams()
  const exerciseId = params.id as string
  
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [currentRep, setCurrentRep] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [restSeconds, setRestSeconds] = useState(30)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    const load = async () => {
      const id = parseInt(exerciseId)
      if (!isNaN(id)) {
        const data = await getExerciseById(id)
        setExercise(data)
      }
      setLoading(false)
    }
    load()
  }, [exerciseId])

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        if (isResting) {
          setRestSeconds((prev) => {
            if (prev <= 1) {
              setIsResting(false)
              return 30
            }
            return prev - 1
          })
        } else {
          setSeconds((prev) => prev + 1)
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, isPaused, isResting])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">운동을 찾을 수 없습니다</p>
        <button onClick={() => router.push('/dashboard')} className="text-blue-500 font-medium">
          대시보드로 돌아가기
        </button>
      </div>
    )
  }

  const handleStart = () => {
    setIsRunning(true)
    setIsPaused(false)
  }

  const handlePause = () => {
    setIsPaused(!isPaused)
  }

  const handleRepComplete = () => {
    setCurrentRep(currentRep + 1)
  }

  const handleSetComplete = () => {
    setCurrentSet(currentSet + 1)
    setCurrentRep(0)
    setIsResting(true)
    setRestSeconds(30)
  }

  const handleFinish = async () => {
    if (!user) {
      showToast('로그인이 필요합니다.', 'error')
      router.push('/login')
      return
    }

    setIsSaving(true)

    try {
      const { data, error } = await supabase!
        .from('exercise_logs')
        .insert({
          user_id: user.id,
          exercise_id: String(exercise.id),
          exercise_name: exercise.name_ko,
          sets_completed: currentSet,
          reps_completed: currentRep,
          duration_seconds: seconds,
          completed_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error('Supabase error:', error)
        showToast('저장에 실패했습니다.', 'error')
        setIsSaving(false)
        return
      }

      showToast('운동 완료! 🎉', 'success')
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (error) {
      console.error('Save error:', error)
      showToast('저장 중 오류가 발생했습니다.', 'error')
      setIsSaving(false)
    }
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = secs % 60
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{exercise.name_ko}</h1>
              {exercise.name_en && <p className="text-xs text-gray-500">{exercise.name_en}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* 운동 영상 */}
        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          {exercise.video_url ? (
            <video
              src={exercise.video_url}
              controls
              playsInline
              className="w-full aspect-video"
            >
              브라우저가 비디오를 지원하지 않습니다.
            </video>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center bg-gray-800">
              <span className="text-4xl mb-2">🎬</span>
              <p className="text-gray-400 text-sm">영상 준비 중</p>
            </div>
          )}
        </div>

        {/* 운동 정보 */}
        <div className="flex gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            {exercise.default_sets}세트{exercise.default_reps ? ` × ${exercise.default_reps}회` : ''}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {exercise.equipment}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(exercise.difficulty)}`}>
            {exercise.difficulty}
          </span>
        </div>

        {/* 타이머 & 카운터 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="mb-6">
            <div className="text-5xl font-bold text-blue-600 mb-1">
              {formatTime(seconds)}
            </div>
            <p className="text-sm text-gray-500">운동 시간</p>
          </div>

          {isResting ? (
            <div className="mb-6 bg-orange-50 rounded-xl p-5">
              <div className="text-4xl font-bold text-orange-600 mb-1">
                {restSeconds}초
              </div>
              <p className="text-orange-700 font-semibold text-sm">휴식 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {currentSet} / {exercise.default_sets}
                </div>
                <p className="text-gray-600 text-sm font-medium">세트</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {currentRep} / {exercise.default_reps || '-'}
                </div>
                <p className="text-gray-600 text-sm font-medium">반복</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-lg"
              >
                운동 시작
              </button>
            ) : (
              <>
                <button
                  onClick={handlePause}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl"
                >
                  {isPaused ? '계속하기' : '일시정지'}
                </button>

                {!isResting && (
                  <>
                    <button
                      onClick={handleRepComplete}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl"
                    >
                      반복 완료 ({currentRep}/{exercise.default_reps || '-'})
                    </button>

                    <button
                      onClick={handleSetComplete}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl"
                    >
                      세트 완료 ({currentSet}/{exercise.default_sets})
                    </button>
                  </>
                )}

                <button
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl"
                >
                  {isSaving ? '저장 중...' : '운동 종료'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 운동 설명 */}
        {exercise.description && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-3">📖 운동 설명</h3>
            <p className="text-sm text-gray-700">{exercise.description}</p>
          </div>
        )}
      </main>
    </div>
  )
}
