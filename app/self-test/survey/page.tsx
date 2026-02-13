'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

// ===== 타입 =====
interface SurveyData {
  side: string
  pain_location: string[]
  pain_intensity: number
  duration: string
  night_pain: string
  painful_movements: string[]
  previous_diagnosis: string[]
  current_treatment: string[]
  treatment_detail: string[]
  chronic_disease: boolean | null
  chronic_medication: string
  regular_exercise: boolean | null
  regular_exercise_detail: string
}

const INITIAL_SURVEY: SurveyData = {
  side: '',
  pain_location: [],
  pain_intensity: 5,
  duration: '',
  night_pain: '',
  painful_movements: [],
  previous_diagnosis: [],
  current_treatment: [],
  treatment_detail: [],
  chronic_disease: null,
  chronic_medication: '',
  regular_exercise: null,
  regular_exercise_detail: '',
}

// ===== 상수 =====
const PAIN_LOCATIONS = [
  { id: 'front', label: '앞쪽' },
  { id: 'side', label: '옆쪽' },
  { id: 'back', label: '뒤쪽' },
  { id: 'top', label: '위쪽' },
  { id: 'deep', label: '깊숙이' },
]

const DURATIONS = [
  { id: '<1week', label: '1주 이내' },
  { id: '1-4weeks', label: '1~4주' },
  { id: '1-3months', label: '1~3개월' },
  { id: '3-6months', label: '3~6개월' },
  { id: '>6months', label: '6개월 이상' },
]

const NIGHT_PAIN_OPTIONS = [
  { id: 'none', label: '없음' },
  { id: 'sometimes', label: '가끔' },
  { id: 'often', label: '자주' },
  { id: 'always', label: '항상' },
]

const PAINFUL_MOVEMENTS = [
  { id: 'reaching_up', label: '팔 올리기' },
  { id: 'reaching_back', label: '뒤로 젖히기' },
  { id: 'lifting', label: '물건 들기' },
  { id: 'throwing', label: '던지기' },
  { id: 'sleeping_on_side', label: '옆으로 눕기' },
  { id: 'dressing', label: '옷 입기' },
  { id: 'night_pain', label: '야간통' },
  { id: 'rest_pain', label: '가만히 있어도 통증 극심' },
]

const DIAGNOSES = [
  { id: 'impingement', label: '충돌증후군' },
  { id: 'rotator_partial', label: '회전근개 부분파열' },
  { id: 'rotator_complete', label: '회전근개 완전파열' },
  { id: 'frozen_shoulder', label: '오십견' },
  { id: 'slap', label: '슬랩' },
  { id: 'bankart', label: '방카르트' },
  { id: 'calcific', label: '석회성건염' },
  { id: 'none', label: '없음' },
]

const TREATMENTS = [
  { id: 'none', label: '없음' },
  { id: 'physical_therapy', label: '물리치료' },
  { id: 'injection', label: '주사치료' },
  { id: 'non_surgical', label: '비수술적치료' },
  { id: 'surgical', label: '수술적치료' },
]

const INJECTION_DETAILS = [
  { id: 'dna', label: 'DNA주사' },
  { id: 'pdrn', label: 'PDRN주사' },
  { id: 'prolo', label: '프롤로치료' },
]

const NON_SURGICAL_DETAILS = [
  { id: 'shrinkage', label: '축소봉합술' },
  { id: 'marrow_stimulation', label: '골수자극재생술' },
  { id: 'calcific_removal', label: '석회분쇄흡입술' },
  { id: 'brisement', label: '브리즈망' },
]

const SURGICAL_DETAILS = [
  { id: 'regenerten', label: '리제네텐 패치보강술' },
  { id: 'arthroscopic_calcific', label: '어깨관절경 석회제거술' },
  { id: 'arthroscopic_rotator', label: '어깨관절경 회전근개 봉합수술' },
  { id: 'arthroplasty', label: '어깨인공관절수술' },
]

// ===== 유틸 =====
function getPainEmoji(value: number): string {
  if (value <= 1) return '😊'
  if (value <= 3) return '🙂'
  if (value <= 5) return '😐'
  if (value <= 7) return '😰'
  if (value <= 9) return '😫'
  return '🤯'
}

function getPainColor(value: number): string {
  if (value <= 2) return '#22C55E'
  if (value <= 4) return '#EAB308'
  if (value <= 6) return '#F97316'
  if (value <= 8) return '#EF4444'
  return '#991B1B'
}

function getPainLabel(value: number): string {
  if (value === 0) return '통증 없음'
  if (value <= 2) return '가벼운 통증'
  if (value <= 4) return '약한 통증'
  if (value <= 6) return '중간 통증'
  if (value <= 8) return '심한 통증'
  return '극심한 통증'
}

// ===== 컴포넌트 =====

// 단일 선택 버튼
function SingleSelect({ options, value, onChange }: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="space-y-2.5">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all ${
            value === opt.id
              ? 'bg-sky-50 border-2 border-sky-500 text-sky-700'
              : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// 다중 선택 버튼
function MultiSelect({ options, values, onChange, exclusiveId }: {
  options: { id: string; label: string }[]
  values: string[]
  onChange: (values: string[]) => void
  exclusiveId?: string
}) {
  const toggle = (id: string) => {
    if (exclusiveId && id === exclusiveId) {
      onChange([id])
      return
    }
    const filtered = values.filter(v => v !== exclusiveId)
    if (filtered.includes(id)) {
      onChange(filtered.filter(v => v !== id))
    } else {
      onChange([...filtered, id])
    }
  }

  return (
    <div className="space-y-2.5">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => toggle(opt.id)}
          className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all flex items-center justify-between ${
            values.includes(opt.id)
              ? 'bg-sky-50 border-2 border-sky-500 text-sky-700'
              : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span>{opt.label}</span>
          {values.includes(opt.id) && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0284C7" stroke="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

// 어깨 부위 선택 (SVG 다이어그램)
function ShoulderDiagram({ selected, onToggle, side }: {
  selected: string[]
  onToggle: (id: string) => void
  side: string
}) {
  const areas = [
    { id: 'front', label: '앞쪽', x: 50, y: 30 },
    { id: 'side', label: '옆쪽', x: 85, y: 50 },
    { id: 'back', label: '뒤쪽', x: 50, y: 70 },
    { id: 'top', label: '위쪽', x: 50, y: 10 },
    { id: 'deep', label: '깊숙이', x: 15, y: 50 },
  ]

  return (
    <div>
      <div className="relative w-full max-w-[280px] mx-auto mb-4">
        <svg viewBox="0 0 100 80" className="w-full">
          {/* 어깨 윤곽 */}
          <ellipse cx="50" cy="40" rx="38" ry="32" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1"/>
          <ellipse cx="50" cy="40" rx="25" ry="20" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5"/>
          
          {/* 터치 영역 */}
          {areas.map(area => (
            <g key={area.id} onClick={() => onToggle(area.id)} className="cursor-pointer">
              <circle
                cx={area.x} cy={area.y} r="10"
                fill={selected.includes(area.id) ? 'rgba(2,132,199,0.25)' : 'rgba(148,163,184,0.1)'}
                stroke={selected.includes(area.id) ? '#0284C7' : '#94A3B8'}
                strokeWidth={selected.includes(area.id) ? '1.5' : '0.8'}
                strokeDasharray={selected.includes(area.id) ? 'none' : '2,2'}
              />
              <text
                x={area.x} y={area.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fill={selected.includes(area.id) ? '#0369A1' : '#64748B'}
                fontWeight={selected.includes(area.id) ? 'bold' : 'normal'}
              >
                {area.label}
              </text>
            </g>
          ))}

          {/* 중앙 라벨 */}
          <text x="50" y="42" textAnchor="middle" fontSize="5" fill="#94A3B8">
            {side === 'left' ? '왼쪽' : side === 'right' ? '오른쪽' : '양쪽'} 어깨
          </text>
        </svg>
      </div>

      {/* 버튼 대체 선택 (접근성) */}
      <div className="grid grid-cols-3 gap-2">
        {areas.map(area => (
          <button
            key={area.id}
            onClick={() => onToggle(area.id)}
            className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
              selected.includes(area.id)
                ? 'bg-sky-100 border-2 border-sky-500 text-sky-700'
                : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {area.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ===== 메인 =====
export default function SurveyPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [survey, setSurvey] = useState<SurveyData>({ ...INITIAL_SURVEY })
  const [showTreatmentDetail, setShowTreatmentDetail] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  // 실제 스텝 수 계산 (Q8 하위선택 포함 시 +1)
  const needsTreatmentDetail = survey.current_treatment.some(t => 
    ['injection', 'non_surgical', 'surgical'].includes(t)
  )

  // Q9 크론질환 텍스트 입력 서브스텝
  const [showChronicInput, setShowChronicInput] = useState(false)
  // Q10 운동 텍스트 입력 서브스텝
  const [showExerciseInput, setShowExerciseInput] = useState(false)

  const getTotalSteps = () => {
    let total = 10
    if (needsTreatmentDetail) total++
    return total
  }

  const getDisplayStep = () => {
    if (step <= 8) return step
    if (step === 9 && showTreatmentDetail && needsTreatmentDetail) return 8 // 8의 하위
    return step - (needsTreatmentDetail ? 0 : 0)
  }

  // 자동 넘김 (단일 선택 질문)
  const goNext = useCallback(() => {
    if (animating) return
    setDirection('forward')
    setAnimating(true)
    setTimeout(() => {
      // Q8 하위선택 처리
      if (step === 8 && !showTreatmentDetail && needsTreatmentDetail) {
        setShowTreatmentDetail(true)
      } else if (step === 9 && survey.chronic_disease === true && !showChronicInput) {
        setShowChronicInput(true)
      } else if (step === 10 && survey.regular_exercise === true && !showExerciseInput) {
        setShowExerciseInput(true)
      } else {
        if (showTreatmentDetail) {
          setShowTreatmentDetail(false)
          setStep(9)
        } else if (showChronicInput) {
          setShowChronicInput(false)
          setStep(10)
        } else if (showExerciseInput) {
          setShowExerciseInput(false)
          // 설문 완료 → 다음 단계
          handleComplete()
          return
        } else {
          setStep(prev => prev + 1)
        }
      }
      setAnimating(false)
    }, 200)
  }, [step, animating, showTreatmentDetail, needsTreatmentDetail, showChronicInput, showExerciseInput, survey.chronic_disease, survey.regular_exercise])

  const goBack = () => {
    if (animating) return
    setDirection('back')
    setAnimating(true)
    setTimeout(() => {
      if (showExerciseInput) {
        setShowExerciseInput(false)
      } else if (showChronicInput) {
        setShowChronicInput(false)
      } else if (showTreatmentDetail) {
        setShowTreatmentDetail(false)
      } else if (step > 1) {
        // 뒤로 갈 때 서브스텝 복원
        if (step === 10 && survey.chronic_disease === true) {
          setStep(9)
          setShowChronicInput(true)
          setAnimating(false)
          return
        }
        if (step === 9 && needsTreatmentDetail) {
          setStep(8)
          setShowTreatmentDetail(true)
          setAnimating(false)
          return
        }
        setStep(prev => prev - 1)
      } else {
        router.push('/self-test')
        return
      }
      setAnimating(false)
    }, 200)
  }

  const handleComplete = () => {
    // sessionStorage에 설문 결과 저장 → 다음 단계(ROM 측정)로
    sessionStorage.setItem('selftest_survey', JSON.stringify(survey))
    router.push('/self-test/measure')
  }

  // 진행률 계산
  const getProgress = () => {
    let current = step
    if (showTreatmentDetail) current = 8.5
    if (showChronicInput) current = 9.5
    if (showExerciseInput) current = 10.5
    const total = getTotalSteps() + (survey.chronic_disease === true ? 0.5 : 0) + (survey.regular_exercise === true ? 0.5 : 0)
    return Math.min((current / (total || 1)) * 100, 100)
  }

  // ===== 각 질문 렌더링 =====
  const renderQuestion = () => {
    // Q1: 어느 쪽 어깨
    if (step === 1) {
      return (
        <QuestionWrapper
          num={1}
          title="어느 쪽 어깨가 아프세요?"
        >
          <SingleSelect
            options={[
              { id: 'left', label: '왼쪽 어깨' },
              { id: 'right', label: '오른쪽 어깨' },
              { id: 'both', label: '양쪽 모두' },
            ]}
            value={survey.side}
            onChange={(id) => {
              setSurvey(prev => ({ ...prev, side: id }))
              setTimeout(goNext, 300)
            }}
          />
        </QuestionWrapper>
      )
    }

    // Q2: 통증 부위
    if (step === 2) {
      return (
        <QuestionWrapper
          num={2}
          title="통증 부위를 선택해주세요"
          subtitle="여러 곳을 선택할 수 있어요"
          showNext
          nextEnabled={survey.pain_location.length > 0}
          onNext={goNext}
        >
          <ShoulderDiagram
            selected={survey.pain_location}
            onToggle={(id) => {
              setSurvey(prev => ({
                ...prev,
                pain_location: prev.pain_location.includes(id)
                  ? prev.pain_location.filter(v => v !== id)
                  : [...prev.pain_location, id]
              }))
            }}
            side={survey.side}
          />
        </QuestionWrapper>
      )
    }

    // Q3: 통증 강도
    if (step === 3) {
      return (
        <QuestionWrapper
          num={3}
          title="현재 통증 강도는 어느 정도인가요?"
          showNext
          nextEnabled={true}
          onNext={goNext}
        >
          <div className="py-4">
            <div className="text-center mb-6">
              <span className="text-5xl">{getPainEmoji(survey.pain_intensity)}</span>
              <p className="text-3xl font-bold mt-3" style={{ color: getPainColor(survey.pain_intensity) }}>
                {survey.pain_intensity}
              </p>
              <p className="text-sm text-slate-500 mt-1">{getPainLabel(survey.pain_intensity)}</p>
            </div>
            <div className="px-2">
              <input
                type="range"
                min="0"
                max="10"
                value={survey.pain_intensity}
                onChange={(e) => setSurvey(prev => ({ ...prev, pain_intensity: parseInt(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #22C55E 0%, #EAB308 30%, #F97316 60%, #EF4444 80%, #991B1B 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>0 없음</span>
                <span>10 극심</span>
              </div>
            </div>
          </div>
        </QuestionWrapper>
      )
    }

    // Q4: 통증 시작 시기
    if (step === 4) {
      return (
        <QuestionWrapper num={4} title="통증이 시작된 시기는?">
          <SingleSelect
            options={DURATIONS}
            value={survey.duration}
            onChange={(id) => {
              setSurvey(prev => ({ ...prev, duration: id }))
              setTimeout(goNext, 300)
            }}
          />
        </QuestionWrapper>
      )
    }

    // Q5: 야간 통증
    if (step === 5) {
      return (
        <QuestionWrapper num={5} title="야간 통증이 있나요?">
          <SingleSelect
            options={NIGHT_PAIN_OPTIONS}
            value={survey.night_pain}
            onChange={(id) => {
              setSurvey(prev => ({ ...prev, night_pain: id }))
              setTimeout(goNext, 300)
            }}
          />
        </QuestionWrapper>
      )
    }

    // Q6: 어떤 동작에서 통증
    if (step === 6) {
      return (
        <QuestionWrapper
          num={6}
          title="어떤 동작에서 통증이 심한가요?"
          subtitle="여러 개 선택 가능"
          showNext
          nextEnabled={survey.painful_movements.length > 0}
          onNext={goNext}
        >
          <MultiSelect
            options={PAINFUL_MOVEMENTS}
            values={survey.painful_movements}
            onChange={(vals) => setSurvey(prev => ({ ...prev, painful_movements: vals }))}
          />
        </QuestionWrapper>
      )
    }

    // Q7: 이전 진단
    if (step === 7) {
      return (
        <QuestionWrapper
          num={7}
          title="이전에 어깨 관련 진단을 받은 적 있나요?"
          subtitle="여러 개 선택 가능"
          showNext
          nextEnabled={survey.previous_diagnosis.length > 0}
          onNext={goNext}
        >
          <MultiSelect
            options={DIAGNOSES}
            values={survey.previous_diagnosis}
            onChange={(vals) => setSurvey(prev => ({ ...prev, previous_diagnosis: vals }))}
            exclusiveId="none"
          />
        </QuestionWrapper>
      )
    }

    // Q8: 현재 치료
    if (step === 8 && !showTreatmentDetail) {
      return (
        <QuestionWrapper
          num={8}
          title="현재 치료 중인 사항이 있나요?"
          subtitle="여러 개 선택 가능"
          showNext
          nextEnabled={survey.current_treatment.length > 0}
          onNext={goNext}
        >
          <MultiSelect
            options={TREATMENTS}
            values={survey.current_treatment}
            onChange={(vals) => setSurvey(prev => ({ ...prev, current_treatment: vals, treatment_detail: [] }))}
            exclusiveId="none"
          />
        </QuestionWrapper>
      )
    }

    // Q8 하위: 치료 상세
    if (showTreatmentDetail) {
      const detailOptions: { id: string; label: string }[] = []
      if (survey.current_treatment.includes('injection')) {
        detailOptions.push(...INJECTION_DETAILS)
      }
      if (survey.current_treatment.includes('non_surgical')) {
        detailOptions.push(...NON_SURGICAL_DETAILS)
      }
      if (survey.current_treatment.includes('surgical')) {
        detailOptions.push(...SURGICAL_DETAILS)
      }

      const getDetailTitle = () => {
        const parts: string[] = []
        if (survey.current_treatment.includes('injection')) parts.push('주사치료')
        if (survey.current_treatment.includes('non_surgical')) parts.push('비수술적치료')
        if (survey.current_treatment.includes('surgical')) parts.push('수술적치료')
        return `${parts.join(' / ')} 상세를 선택해주세요`
      }

      return (
        <QuestionWrapper
          num={8}
          title={getDetailTitle()}
          subtitle="해당하는 항목을 선택해주세요"
          showNext
          nextEnabled={survey.treatment_detail.length > 0}
          onNext={goNext}
        >
          <MultiSelect
            options={detailOptions}
            values={survey.treatment_detail}
            onChange={(vals) => setSurvey(prev => ({ ...prev, treatment_detail: vals }))}
          />
        </QuestionWrapper>
      )
    }

    // Q9: 만성질환
    if (step === 9 && !showChronicInput) {
      return (
        <QuestionWrapper
          num={9}
          title="고혈압, 당뇨 같은 만성질환을 앓고 있나요?"
        >
          <div className="space-y-2.5">
            <button
              onClick={() => {
                setSurvey(prev => ({ ...prev, chronic_disease: true }))
                setTimeout(goNext, 300)
              }}
              className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                survey.chronic_disease === true
                  ? 'bg-sky-50 border-2 border-sky-500 text-sky-700'
                  : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              네
            </button>
            <button
              onClick={() => {
                setSurvey(prev => ({ ...prev, chronic_disease: false, chronic_medication: '' }))
                setTimeout(goNext, 300)
              }}
              className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                survey.chronic_disease === false
                  ? 'bg-sky-50 border-2 border-sky-500 text-sky-700'
                  : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              아니요
            </button>
          </div>
        </QuestionWrapper>
      )
    }

    // Q9 하위: 복용 약물 입력
    if (showChronicInput) {
      return (
        <QuestionWrapper
          num={9}
          title="복용 중인 약을 알려주세요"
          subtitle="질환명과 약 이름을 적어주세요"
          showNext
          nextEnabled={survey.chronic_medication.trim().length > 0}
          onNext={goNext}
        >
          <textarea
            autoFocus
            value={survey.chronic_medication}
            onChange={(e) => setSurvey(prev => ({ ...prev, chronic_medication: e.target.value }))}
            placeholder="예: 고혈압 - 아모디핀 5mg&#10;당뇨 - 메트포르민 500mg"
            className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:outline-none text-sm text-slate-700 placeholder-slate-400 resize-none"
          />
        </QuestionWrapper>
      )
    }

    // Q10: 꾸준한 운동
    if (step === 10 && !showExerciseInput) {
      return (
        <QuestionWrapper
          num={10}
          title="평소 꾸준히 하는 운동이 있나요?"
        >
          <div className="space-y-2.5">
            <button
              onClick={() => {
                setSurvey(prev => ({ ...prev, regular_exercise: true }))
                setTimeout(goNext, 300)
              }}
              className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                survey.regular_exercise === true
                  ? 'bg-sky-50 border-2 border-sky-500 text-sky-700'
                  : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              네
            </button>
            <button
              onClick={() => {
                setSurvey(prev => ({ ...prev, regular_exercise: false, regular_exercise_detail: '' }))
                // 설문 완료
                setTimeout(() => {
                  const finalSurvey = { ...survey, regular_exercise: false, regular_exercise_detail: '' }
                  sessionStorage.setItem('selftest_survey', JSON.stringify(finalSurvey))
                  router.push('/self-test/measure')
                }, 300)
              }}
              className={`w-full py-3.5 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                survey.regular_exercise === false
                  ? 'bg-sky-50 border-2 border-sky-500 text-sky-700'
                  : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              아니요
            </button>
          </div>
        </QuestionWrapper>
      )
    }

    // Q10 하위: 운동 입력
    if (showExerciseInput) {
      return (
        <QuestionWrapper
          num={10}
          title="어떤 운동을 하고 계세요?"
          subtitle="운동 종류와 빈도를 적어주세요"
          showNext
          nextEnabled={survey.regular_exercise_detail.trim().length > 0}
          onNext={() => {
            sessionStorage.setItem('selftest_survey', JSON.stringify(survey))
            router.push('/self-test/measure')
          }}
          nextLabel="설문 완료"
        >
          <textarea
            autoFocus
            value={survey.regular_exercise_detail}
            onChange={(e) => setSurvey(prev => ({ ...prev, regular_exercise_detail: e.target.value }))}
            placeholder="예: 수영 주 3회, 걷기 매일 30분"
            className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:outline-none text-sm text-slate-700 placeholder-slate-400 resize-none"
          />
        </QuestionWrapper>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
          <button onClick={goBack} className="mr-3 text-slate-600 hover:text-slate-900 transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="text-base font-bold text-slate-900">통증 설문</h1>
          <span className="ml-auto text-xs text-slate-400">Q{step}/10</span>
        </div>
        {/* Progress Bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full transition-all duration-500 ease-out rounded-r-full"
            style={{
              width: `${getProgress()}%`,
              background: 'linear-gradient(90deg, #0284C7, #0EA5E9)',
            }}
          />
        </div>
      </header>

      {/* Content */}
      <main className={`flex-1 max-w-lg mx-auto w-full px-4 py-6 transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}>
        {renderQuestion()}
      </main>
    </div>
  )
}

// ===== 질문 래퍼 =====
function QuestionWrapper({ num, title, subtitle, children, showNext, nextEnabled, onNext, nextLabel }: {
  num: number
  title: string
  subtitle?: string
  children: React.ReactNode
  showNext?: boolean
  nextEnabled?: boolean
  onNext?: () => void
  nextLabel?: string
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-semibold text-sky-600 mb-1.5">Q{num}</p>
        <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>

      <div className="flex-1">
        {children}
      </div>

      {showNext && (
        <div className="mt-6 pb-4">
          <button
            onClick={onNext}
            disabled={!nextEnabled}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
              nextEnabled
                ? 'text-white shadow-md hover:brightness-110'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            style={nextEnabled ? { background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' } : {}}
          >
            {nextLabel || '다음'}
          </button>
        </div>
      )}
    </div>
  )
}
