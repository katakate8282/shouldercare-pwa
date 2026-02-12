'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
}

interface OnboardingData {
  painLevel: number
  limitations: string[]
  goal: string
  exerciseFrequency: string
  previousSports: string[]
  exerciseLocation: string
  equipment: string[]
}

export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    painLevel: 5,
    limitations: [],
    goal: '',
    exerciseFrequency: '',
    previousSports: [],
    exerciseLocation: '',
    equipment: [],
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(d => {
        if (d.user) setUser(d.user)
        else router.push('/login')
      })
      .catch(() => router.push('/login'))
  }, [router])

  const totalSteps = 5

  const toggleItem = (field: 'limitations' | 'previousSports' | 'equipment', item: string) => {
    setData(prev => {
      const arr = prev[field]
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter(i => i !== item) }
      } else {
        return { ...prev, [field]: [...arr, item] }
      }
    })
  }

  const handleFinish = async () => {
    if (!user) return
    setIsSaving(true)

    try {
      // Save onboarding data to users table
      const { error } = await supabase
        .from('users')
        .update({
          onboarding_completed: true,
          pain_level_initial: data.painLevel,
          limitations: data.limitations,
          rehab_goal: data.goal,
          exercise_frequency: data.exerciseFrequency,
          previous_sports: data.previousSports,
          exercise_location: data.exerciseLocation,
          equipment: data.equipment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        console.error('Onboarding save error:', error)
        // 컬럼이 없어도 일단 넘어가도록
      }

      // Also save to localStorage as backup
      localStorage.setItem('onboarding_data', JSON.stringify({
        userId: user.id,
        ...data,
        completedAt: new Date().toISOString(),
      }))

      setStep(6) // 완료 화면으로
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1: return true // painLevel always has default
      case 2: return data.limitations.length > 0
      case 3: return data.goal !== ''
      case 4: return data.exerciseFrequency !== ''
      case 5: return data.exerciseLocation !== ''
      default: return true
    }
  }

  const getPainEmoji = (level: number) => {
    if (level <= 2) return '😊'
    if (level <= 4) return '😐'
    if (level <= 6) return '😣'
    if (level <= 8) return '😖'
    return '😭'
  }

  const getPainText = (level: number) => {
    if (level === 0) return '통증 없음'
    if (level <= 2) return '가벼운 통증'
    if (level <= 4) return '약간 불편함'
    if (level <= 6) return '중간 정도 통증'
    if (level <= 8) return '심한 통증'
    return '매우 심한 통증'
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  // ===== 완료 화면 (Step 6) =====
  if (step === 6) {
    const intensity = data.painLevel >= 7 ? '낮음 (통증 고려)' : data.painLevel <= 3 ? '높음' : '중간'
    const totalWeeks = data.goal === 'sports_return' ? 16 : 12

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <main className="max-w-md mx-auto px-4 py-8 space-y-6">
          <div className="text-center">
            <span className="text-6xl block mb-4">✅</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              맞춤 재활 프로그램 준비 완료!
            </h1>
            <p className="text-gray-600">{user.name}님을 위한 분석 결과</p>
          </div>

          {/* 현재 상태 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📊</span> 현재 상태
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• 통증 수준: {getPainText(data.painLevel)} ({data.painLevel}/10)</p>
              <p>• 제한 활동: {data.limitations.join(', ')}</p>
            </div>
          </div>

          {/* 재활 목표 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🎯</span> 재활 목표
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• {data.goal === 'daily_life' ? '통증 없이 일상생활 복귀' :
                    data.goal === 'sports_return' ? '운동/스포츠 복귀' :
                    data.goal === 'work_return' ? '직장 업무 정상 수행' :
                    '특정 활동 복귀'}</p>
              <p>• 예상 기간: {totalWeeks}주</p>
            </div>
          </div>

          {/* 맞춤 프로그램 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💪</span> 맞춤 프로그램
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• 운동 강도: {intensity}</p>
              <p>• 장비: {data.equipment.length > 0 ? data.equipment.join(', ') : '맨몸 운동'}</p>
              <p>• 장소: {data.exerciseLocation === 'home' ? '집' :
                         data.exerciseLocation === 'gym' ? '헬스장' :
                         data.exerciseLocation === 'hospital' ? '병원/재활센터' : data.exerciseLocation}</p>
            </div>
          </div>

          {/* 예상 회복 단계 */}
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🏆</span> 예상 회복 단계
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>Week 1-4: 통증 감소, ROM 개선</p>
              <p>Week 5-8: 근력 회복, 일상 복귀</p>
              <p>Week 9-12: 스포츠 준비 단계</p>
              {totalWeeks > 12 && <p>Week 13-{totalWeeks}: 스포츠 점진적 복귀</p>}
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-lg transition"
          >
            재활 시작하기 🚀
          </button>
        </main>
      </div>
    )
  }

  // ===== 온보딩 단계 화면 =====
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress Bar */}
      <div className="bg-white border-b px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{step} / {totalSteps}</span>
            <button onClick={() => { if (step > 1) setStep(step - 1) }} className="text-sm text-gray-500">
              {step > 1 ? '← 이전' : ''}
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-md mx-auto px-4 py-8 w-full">

        {/* Step 1: 통증 수준 */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">현재 통증 수준은 어떠신가요?</h2>
              <p className="text-gray-500">가장 정확한 재활 프로그램을 위해 알려주세요</p>
            </div>

            <div className="text-center py-8">
              <span className="text-8xl block mb-4">{getPainEmoji(data.painLevel)}</span>
              <div className="text-4xl font-bold text-gray-900 mb-1">{data.painLevel}</div>
              <div className="text-lg text-gray-600">{getPainText(data.painLevel)}</div>
            </div>

            <input
              type="range"
              min="0"
              max="10"
              value={data.painLevel}
              onChange={(e) => setData({ ...data, painLevel: parseInt(e.target.value) })}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(134, 239, 172) 0%, rgb(253, 224, 71) 50%, rgb(252, 165, 165) 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 (없음)</span>
              <span>5 (중간)</span>
              <span>10 (최악)</span>
            </div>
          </div>
        )}

        {/* Step 2: 일상 활동 제한 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">현재 어려움을 겪고 있는 활동은?</h2>
              <p className="text-gray-500">해당하는 항목을 모두 선택해주세요</p>
            </div>

            <div className="space-y-3">
              {['머리 감기', '옷 입기 (뒤로 손 넘기기)', '물건 들기', '높은 곳 물건 꺼내기', '운전하기', '잠자기 (통증 때문에)', '일상생활 대부분 가능'].map((item) => (
                <button
                  key={item}
                  onClick={() => toggleItem('limitations', item)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                    data.limitations.includes(item)
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{data.limitations.includes(item) ? '☑' : '☐'}</span>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 재활 목표 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">재활의 목표는 무엇인가요?</h2>
              <p className="text-gray-500">하나를 선택해주세요</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'daily_life', label: '통증 없이 일상생활 복귀', icon: '🏠' },
                { value: 'sports_return', label: '이전처럼 운동/스포츠 복귀', icon: '⚽' },
                { value: 'work_return', label: '직장 업무 정상 수행', icon: '💼' },
                { value: 'specific_activity', label: '특정 활동 가능 (예: 골프)', icon: '🏌️' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, goal: option.value })}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    data.goal === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: 운동 경험 */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">평소 운동을 하셨나요?</h2>
              <p className="text-gray-500">운동 강도를 적절하게 설정해드립니다</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'none', label: '거의 안 함', icon: '🛋️' },
                { value: 'light', label: '가끔 (주 1-2회)', icon: '🚶' },
                { value: 'moderate', label: '규칙적으로 (주 3-4회)', icon: '🏃' },
                { value: 'active', label: '매우 활발 (주 5회 이상)', icon: '💪' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, exerciseFrequency: option.value })}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    data.exerciseFrequency === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>

            {data.exerciseFrequency && data.exerciseFrequency !== 'none' && (
              <div>
                <p className="text-sm text-gray-600 mb-3">주로 하시던 운동은? (선택)</p>
                <div className="flex flex-wrap gap-2">
                  {['골프', '테니스', '수영', '헬스', '요가', '등산', '배드민턴', '야구', '농구'].map((sport) => (
                    <button
                      key={sport}
                      onClick={() => toggleItem('previousSports', sport)}
                      className={`px-4 py-2 rounded-full border transition-all text-sm ${
                        data.previousSports.includes(sport)
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: 운동 환경 */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">어디서 운동하실 예정인가요?</h2>
              <p className="text-gray-500">환경에 맞는 운동을 추천해드립니다</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'home', label: '집', icon: '🏠' },
                { value: 'gym', label: '헬스장', icon: '🏋️' },
                { value: 'hospital', label: '병원/재활센터', icon: '🏥' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData({ ...data, exerciseLocation: option.value })}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    data.exerciseLocation === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-3">가지고 계신 운동 도구는? (다중 선택)</p>
              <div className="space-y-3">
                {[
                  { value: '탄력 밴드', icon: '🔴' },
                  { value: '아령/덤벨', icon: '🏋️' },
                  { value: '폼롤러', icon: '🧱' },
                  { value: '요가 매트', icon: '🧘' },
                  { value: '없음 (맨몸 운동만)', icon: '🤸' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      if (item.value === '없음 (맨몸 운동만)') {
                        setData({ ...data, equipment: ['없음 (맨몸 운동만)'] })
                      } else {
                        const filtered = data.equipment.filter(e => e !== '없음 (맨몸 운동만)')
                        if (filtered.includes(item.value)) {
                          setData({ ...data, equipment: filtered.filter(e => e !== item.value) })
                        } else {
                          setData({ ...data, equipment: [...filtered, item.value] })
                        }
                      }
                    }}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      data.equipment.includes(item.value)
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="mr-2">{data.equipment.includes(item.value) ? '☑' : '☐'}</span>
                    {item.value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Button */}
      <div className="border-t bg-white px-4 py-4">
        <div className="max-w-md mx-auto">
          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-lg transition"
            >
              다음
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSaving || !canProceed()}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-lg transition"
            >
              {isSaving ? '저장 중...' : '분석 결과 보기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
