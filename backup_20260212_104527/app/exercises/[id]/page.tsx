'use client'

import { getExerciseById } from '@/lib/data/exercises'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ExerciseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const exercise = getExerciseById(params.id)
  const [showVideo, setShowVideo] = useState(false)

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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800'
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800'
      case 'advanced':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '초급'
      case 'intermediate':
        return '중급'
      case 'advanced':
        return '고급'
      default:
        return difficulty
    }
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
              {exercise.koreanName}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Video Section */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {showVideo ? (
            <div className="aspect-video bg-black">
              <iframe
                width="100%"
                height="100%"
                src={exercise.demoVideoUrl}
                title={exercise.koreanName}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              onClick={() => setShowVideo(true)}
              className="aspect-video bg-gray-900 relative cursor-pointer group"
              style={{
                backgroundImage: `url(https://img.youtube.com/vi/${exercise.demoVideoUrl.split('/embed/')[1]}/maxresdefault.jpg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
              
              {/* Play button */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center group-hover:bg-red-700 transition-colors shadow-lg">
                  <span className="text-white text-4xl ml-1">▶</span>
                </div>
                <p className="text-white font-semibold mt-4 text-lg drop-shadow-lg">영상 재생</p>
              </div>
            </div>
          )}
        </div>

        {/* Exercise Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {exercise.koreanName}
            </h2>
            <p className="text-gray-600">{exercise.name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`text-sm px-3 py-1 rounded-full ${getDifficultyColor(
                exercise.difficulty
              )}`}
            >
              {getDifficultyText(exercise.difficulty)}
            </span>
            <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700">
              {exercise.equipment}
            </span>
            <span className="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700">
              {exercise.category}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.defaultSets}
              </p>
              <p className="text-xs text-gray-600">세트</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.defaultReps}
              </p>
              <p className="text-xs text-gray-600">반복</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {Math.floor(exercise.duration / 60)}'
              </p>
              <p className="text-xs text-gray-600">소요시간</p>
            </div>
          </div>
        </div>

        {/* Target Muscles */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-3">타겟 근육</h3>
          <div className="flex flex-wrap gap-2">
            {exercise.targetMuscles.map((muscle, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm"
              >
                {muscle}
              </span>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-3">운동 방법</h3>
          <ol className="space-y-3">
            {exercise.instructions.map((instruction, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-gray-700 pt-0.5">{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <span>💡</span>
            <span>주의사항 및 팁</span>
          </h3>
          <ul className="space-y-2">
            {exercise.tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-amber-900">
                <span>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => router.push(`/exercises/${exercise.id}/workout`)}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 rounded-lg transition"
          >
            운동 시작하기
          </button>
          <button
            onClick={() => {
              alert('즐겨찾기 기능은 곧 추가됩니다!')
            }}
            className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-lg transition"
          >
            ⭐
          </button>
        </div>
      </main>
    </div>
  )
}
