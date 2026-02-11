'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { mockExercises } from "@/lib/data/exercises"
import { useAuthStore } from '@/lib/stores/authStore'
import { supabase } from '@/lib/supabase/client'

export default function WorkoutPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuthStore()
  const exerciseId = params.id as string
  const exercise = mockExercises.find((e) => e.id === exerciseId)

  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [currentRep, setCurrentRep] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [restSeconds, setRestSeconds] = useState(30)
  const [isSaving, setIsSaving] = useState(false)

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
    return <div>운동을 찾을 수 없습니다</div>
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
    setIsSaving(true)
    
    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .insert({
          user_id: user?.id,
          exercise_id: exerciseId,
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

      const exerciseLog = {
        userId: user?.id,
        exerciseId,
        exerciseName: exercise.name,
        setsCompleted: currentSet,
        repsCompleted: currentRep,
        durationSeconds: seconds,
        completedAt: new Date().toISOString(),
      }
      const existingLogs = JSON.parse(localStorage.getItem('exerciseLogs') || '[]')
      localStorage.setItem('exerciseLogs', JSON.stringify([...existingLogs, exerciseLog]))

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
            <h1 className="text-xl font-bold text-gray-900">{exercise.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="mb-8">
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {formatTime(seconds)}
            </div>
            <p className="text-gray-600">운동 시간</p>
          </div>

          {isResting ? (
            <div className="mb-8 bg-orange-50 rounded-xl p-6">
              <div className="text-5xl font-bold text-orange-600 mb-2">
                {restSeconds}초
              </div>
              <p className="text-orange-700 font-semibold">휴식 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-50 rounded-xl p-6">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {currentSet} / {exercise.defaultSets}
                </div>
                <p className="text-gray-700 font-semibold">세트</p>
              </div>
              <div className="bg-green-50 rounded-xl p-6">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {currentRep} / {exercise.defaultReps}
                </div>
                <p className="text-gray-700 font-semibold">반복</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
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
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 rounded-xl text-lg"
                >
                  {isPaused ? '계속하기' : '일시정지'}
                </button>

                {!isResting && (
                  <>
                    <button
                      onClick={handleRepComplete}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg"
                    >
                      반복 완료 ({currentRep}/{exercise.defaultReps})
                    </button>

                    <button
                      onClick={handleSetComplete}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 rounded-xl text-lg"
                    >
                      세트 완료 ({currentSet}/{exercise.defaultSets})
                    </button>
                  </>
                )}

                <button
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl text-lg"
                >
                  {isSaving ? '저장 중...' : '운동 종료'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-6">
          <h3 className="font-bold text-gray-900 mb-3">💡 운동 팁</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 천천히 정확한 자세로 수행하세요</li>
            <li>• 통증이 느껴지면 즉시 중단하세요</li>
            <li>• 호흡을 규칙적으로 유지하세요</li>
            <li>• 세트 간 충분한 휴식을 취하세요</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
