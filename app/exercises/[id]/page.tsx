'use client'

import { getExerciseById, getDifficultyColor, getCategoryDisplayName } from '@/lib/data/exercises'
import type { Exercise } from '@/lib/data/exercises'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function ExerciseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    const load = async () => {
      const id = parseInt(params.id)
      if (isNaN(id)) {
        setLoading(false)
        return
      }
      const data = await getExerciseById(id)
      setExercise(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-4">🤔</p>
          <p className="text-gray-600">운동을 찾을 수 없습니다</p>
          <button
            onClick={() => router.push('/exercises')}
            className="mt-4 text-blue-500"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {exercise.name_ko}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Video Section */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {exercise.video_url ? (
            showVideo ? (
              <div className="aspect-video bg-black">
                <video
                  src={exercise.video_url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full"
                >
                  브라우저가 비디오를 지원하지 않습니다.
                </video>
              </div>
            ) : (
              <div
                onClick={() => setShowVideo(true)}
                className="aspect-video bg-gray-900 relative cursor-pointer group"
              >
                {exercise.thumbnail_url ? (
                  <img
                    src={exercise.thumbnail_url}
                    alt={exercise.name_ko}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800" />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-lg">
                    <span className="text-white text-4xl ml-1">▶</span>
                  </div>
                  <p className="text-white font-semibold mt-4 text-lg drop-shadow-lg">영상 재생</p>
                </div>
              </div>
            )
          ) : (
            <div className="aspect-video bg-gray-100 flex flex-col items-center justify-center">
              <span className="text-5xl mb-3">🎬</span>
              <p className="text-gray-500">영상 준비 중</p>
              <p className="text-xs text-gray-400 mt-1">곧 업로드 됩니다</p>
            </div>
          )}
        </div>

        {/* Exercise Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {exercise.name_ko}
            </h2>
            {exercise.name_en && (
              <p className="text-gray-600">{exercise.name_en}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`text-sm px-3 py-1 rounded-full ${getDifficultyColor(exercise.difficulty)}`}>
              {exercise.difficulty}
            </span>
            <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700">
              {exercise.equipment}
            </span>
            <span className="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700">
              {getCategoryDisplayName(exercise.category)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.default_sets}
              </p>
              <p className="text-xs text-gray-600">세트</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.default_reps || '-'}
              </p>
              <p className="text-xs text-gray-600">반복</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.duration_seconds ? `${exercise.duration_seconds}초` : '-'}
              </p>
              <p className="text-xs text-gray-600">유지시간</p>
            </div>
          </div>
        </div>

        {/* Target Area */}
        {exercise.target_area && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3">타겟 부위</h3>
            <div className="flex flex-wrap gap-2">
              {exercise.target_area.split('/').map((area, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm"
                >
                  {area.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {exercise.description && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3">운동 설명</h3>
            <p className="text-gray-700 leading-relaxed">{exercise.description}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => router.push('/exercises')}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-lg transition"
          >
            목록으로
          </button>
          <button
            onClick={() => {
              if (exercise.video_url) {
                setShowVideo(true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 rounded-lg transition"
          >
            {exercise.video_url ? '영상 보기' : '영상 준비중'}
          </button>
        </div>
      </main>
    </div>
  )
}
