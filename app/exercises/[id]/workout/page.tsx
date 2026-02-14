'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getExerciseById, getDifficultyColor } from '@/lib/data/exercises'
import type { Exercise } from '@/lib/data/exercises'
import { supabase } from '@/lib/supabase/client'
import { checkSubscription } from '@/lib/subscription'

interface User {
  id: string
  name: string
  email: string
  subscription_type?: string
  subscription_expires_at?: string | null
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
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
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
      setShowUploadModal(true)
    } catch (error) {
      console.error('Save error:', error)
      showToast('저장 중 오류가 발생했습니다.', 'error')
      setIsSaving(false)
    }
  }

  const handleVideoUpload = async (file: File) => {
    if (!user || !exercise) return
    setIsUploading(true)
    try {
      const res = await fetch('/api/video-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: exercise.id, exercise_name: exercise.name_ko, file_size: file.size }),
      })
      const { upload_url, record_id } = await res.json()
      if (!upload_url) throw new Error('URL error')
      await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' }, body: file })
      await fetch('/api/video-upload', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record_id }) })
      setUploadSuccess(true)
    } catch (err) {
      console.error(err)
      showToast('업로드 실패', 'error')
    }
    setIsUploading(false)
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = secs % 60
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  }

  const sub = user ? checkSubscription(user) : null
  const isPaid = sub && !sub.isExpired && (sub.type === 'PLATINUM_PATIENT' || sub.type === 'PREMIUM')

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

      {/* 영상 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6 pb-8">
            {uploadSuccess ? (
              <div className="text-center py-4">
                <span className="text-5xl">✅</span>
                <h3 className="text-lg font-bold text-gray-900 mt-3">영상이 전송되었어요!</h3>
                <p className="text-sm text-gray-500 mt-1">트레이너가 확인 후 피드백을 보내드립니다.</p>
                <button onClick={() => router.push('/dashboard')} className="mt-4 w-full py-3 bg-sky-500 text-white rounded-xl font-bold">대시보드로 이동</button>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <span className="text-4xl">🎉</span>
                  <h3 className="text-lg font-bold text-gray-900 mt-2">운동 완료!</h3>
                </div>
                {isPaid ? (
                  <>
                    <p className="text-sm text-gray-500 text-center mb-4">운동 영상을 트레이너에게 보내시겠어요?</p>
                    <label className="block w-full">
                      <input
                        type="file"
                        accept="video/*"
                        capture="user"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleVideoUpload(file)
                        }}
                      />
                      <div className={`w-full py-3 rounded-xl font-bold text-center ${isUploading ? 'bg-gray-300 text-gray-500' : 'bg-sky-500 text-white'}`}>
                        {isUploading ? '업로드 중...' : '📹 영상 촬영 / 선택하기'}
                      </div>
                    </label>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 mb-2">
                    <p className="text-sm text-gray-600 text-center">🔒 트레이너 영상 피드백은<br /><span className="font-bold text-sky-600">프리미엄 회원</span> 전용 기능입니다.</p>
                    <button onClick={() => router.push('/subscribe')} className="mt-3 w-full py-2.5 bg-sky-500 text-white rounded-lg text-sm font-bold">프리미엄 알아보기</button>
                  </div>
                )}
                <button onClick={() => router.push('/dashboard')} className="mt-3 w-full py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-50">
                  {isPaid ? '건너뛰고 대시보드로' : '대시보드로 이동'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
