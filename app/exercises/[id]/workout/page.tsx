'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { mockExercises } from "@/lib/data/exercises"
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
}

export default function WorkoutPage() {
  const router = useRouter()
  const params = useParams()
  const exerciseId = params.id as string
  const exercise = mockExercises.find((e) => e.id === exerciseId)

  const [user, setUser] = useState<User | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [currentRep, setCurrentRep] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [restSeconds, setRestSeconds] = useState(30)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
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
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    setIsSaving(true)

    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .insert({
          user_id: user.id,
          exercise_id: exerciseId,
          exercise_name: exercise.koreanName,
          sets_completed: currentSet,
          reps_completed: currentRep,
          duration_seconds: seconds,
          completed_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error('Supabase error:', error)
        alert('저장에 실패했습니다: ' + error.message)
        setIsSaving(false)
        return
      }

      alert('운동 완료! 🎉')
      router.push('/dashboard')
    } catch (error) {
      console.error('Save error:', error)
      alert('저장 중 오류가 발생했습니다.')
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
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{exercise.koreanName}</h1>
              <p className="text-xs text-gray-500">{exercise.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* 운동 영상 */}
        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={exercise.demoVideoUrl}
              title={exercise.koreanName}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        {/* 운동 정보 */}
        <div className="flex gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            {exercise.defaultSets}세트 × {exercise.defaultReps}회
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {exercise.equipment}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
            {exercise.difficulty === 'beginner' ? '초급' : exercise.difficulty === 'intermediate' ? '중급' : '고급'}
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
                  {currentSet} / {exercise.defaultSets}
                </div>
                <p className="text-gray-600 text-sm font-medium">세트</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {currentRep} / {exercise.defaultReps}
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
                      반복 완료 ({currentRep}/{exercise.defaultReps})
                    </button>

                    <button
                      onClick={handleSetComplete}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl"
                    >
                      세트 완료 ({currentSet}/{exercise.defaultSets})
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

        {/* 운동 방법 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-3">📖 운동 방법</h3>
          <ol className="space-y-2">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-blue-500 font-bold">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* 운동 팁 */}
        <div className="bg-blue-50 rounded-xl p-5">
          <h3 className="font-bold text-gray-900 mb-3">💡 운동 팁</h3>
          <ul className="space-y-1.5">
            {exercise.tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-700">• {tip}</li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
