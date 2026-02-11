'use client'

import { mockExercises } from '@/lib/data/exercises'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ExercisesPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', '외회전', '내회전', 'ROM', '근력', '견갑골']

  const filteredExercises =
    selectedCategory === 'all'
      ? mockExercises
      : mockExercises.filter((ex) => ex.category === selectedCategory)

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">운동 라이브러리</h1>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? '전체' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exercise List */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-600 mb-4">
          총 {filteredExercises.length}개의 운동
        </p>

        <div className="space-y-3">
          {filteredExercises.map((exercise) => (
            <Link
              key={exercise.id}
              href={`/exercises/${exercise.id}`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                  <img 
                    src={exercise.thumbnailUrl} 
                    alt={exercise.koreanName}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {exercise.koreanName}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">
                    {exercise.name}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(
                        exercise.difficulty
                      )}`}
                    >
                      {getDifficultyText(exercise.difficulty)}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {exercise.equipment}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                      {exercise.defaultSets}세트 × {exercise.defaultReps}회
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center">
                  <span className="text-gray-400">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 flex justify-around py-3">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs">홈</span>
          </Link>
          <button className="flex flex-col items-center gap-1 text-blue-500">
            <span className="text-xl">💪</span>
            <span className="text-xs font-medium">운동</span>
          </button>
          <Link
            href="/progress"
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">📈</span>
            <span className="text-xs">진행상황</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs">설정</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
