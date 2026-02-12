'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface Patient {
  id: string
  name: string
  email: string
  onboarding_completed: boolean
  rehab_goal?: string
  pain_level_initial?: number
}

interface Prescription {
  id: string
  exercise_id: string
  exercise_name: string
  sets: number
  reps: number
  frequency_per_week: number
  rest_seconds: number
  resistance: string
  notes: string
  status: string
  prescribed_at: string
}

const EXERCISE_LIBRARY = [
  { id: 'ex-001', name: '밴드 외회전', category: '외회전', level: '초급', duration: '3:00' },
  { id: 'ex-002', name: '견갑골 후인', category: '견갑골', level: '초급', duration: '2:30' },
  { id: 'ex-003', name: '스캡션', category: 'ROM', level: '중급', duration: '2:00' },
  { id: 'ex-004', name: '진자 운동', category: 'ROM', level: '초급', duration: '4:00' },
  { id: 'ex-005', name: '벽 슬라이드', category: 'ROM', level: '초급', duration: '2:30' },
  { id: 'ex-006', name: '밴드 내회전', category: '내회전', level: '초급', duration: '3:00' },
  { id: 'ex-007', name: '어깨 굴곡', category: 'ROM', level: '초급', duration: '2:30' },
  { id: 'ex-008', name: '어깨 외전', category: 'ROM', level: '초급', duration: '2:30' },
  { id: 'ex-009', name: 'Y 레이즈', category: '근력', level: '중급', duration: '2:00' },
  { id: 'ex-010', name: 'T 레이즈', category: '근력', level: '중급', duration: '2:00' },
  { id: 'ex-011', name: '어깨 스트레칭', category: 'ROM', level: '초급', duration: '2:00' },
  { id: 'ex-012', name: '어깨 회전', category: 'ROM', level: '초급', duration: '2:30' },
  { id: 'ex-013', name: '견갑골 안정화', category: '견갑골', level: '초급', duration: '2:30' },
]

export default function TrainerPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [currentPrescriptions, setCurrentPrescriptions] = useState<Prescription[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('전체')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<typeof EXERCISE_LIBRARY[0] | null>(null)
  const [prescriptionForm, setPrescriptionForm] = useState({
    sets: 3,
    reps: 12,
    frequency_per_week: 5,
    rest_seconds: 60,
    resistance: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchPatients()
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const fetchPatients = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, onboarding_completed, rehab_goal, pain_level_initial')
      .order('name')

    if (!error && data) {
      setPatients(data)
    }
  }

  const fetchPrescriptions = async (patientId: string) => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('prescribed_at', { ascending: false })

    if (!error && data) {
      setCurrentPrescriptions(data)
    }
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    fetchPrescriptions(patient.id)
  }

  const handleAddExercise = (exercise: typeof EXERCISE_LIBRARY[0]) => {
    setSelectedExercise(exercise)
    setPrescriptionForm({
      sets: 3,
      reps: 12,
      frequency_per_week: 5,
      rest_seconds: 60,
      resistance: '',
      notes: '',
    })
    setShowAddModal(true)
  }

  const handlePrescribe = async () => {
    if (!selectedPatient || !selectedExercise || !user) return
    setSaving(true)

    const { error } = await supabase.from('prescriptions').insert({
      patient_id: selectedPatient.id,
      trainer_id: user.id,
      exercise_id: selectedExercise.id,
      exercise_name: selectedExercise.name,
      sets: prescriptionForm.sets,
      reps: prescriptionForm.reps,
      frequency_per_week: prescriptionForm.frequency_per_week,
      rest_seconds: prescriptionForm.rest_seconds,
      resistance: prescriptionForm.resistance,
      notes: prescriptionForm.notes,
      status: 'active',
    })

    if (!error) {
      setShowAddModal(false)
      fetchPrescriptions(selectedPatient.id)
    } else {
      console.error('Prescription error:', error)
    }
    setSaving(false)
  }

  const handleRemovePrescription = async (prescriptionId: string) => {
    const { error } = await supabase
      .from('prescriptions')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', prescriptionId)

    if (!error && selectedPatient) {
      fetchPrescriptions(selectedPatient.id)
    }
  }

  const categories = ['전체', ...Array.from(new Set(EXERCISE_LIBRARY.map(e => e.category)))]

  const filteredExercises = EXERCISE_LIBRARY.filter(e => {
    const matchSearch = e.name.includes(searchQuery) || e.category.includes(searchQuery)
    const matchCategory = categoryFilter === '전체' || e.category === categoryFilter
    return matchSearch && matchCategory
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  // ===== 환자 미선택 → 환자 리스트 =====
  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">트레이너 대시보드</h1>
              <button onClick={() => router.push('/dashboard')} className="text-sm text-blue-500">홈으로</button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-3">👤 환자 선택</h2>
            <input
              type="text"
              placeholder="환자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div className="space-y-2">
              {patients
                .filter(p => p.name.includes(searchQuery) || p.email.includes(searchQuery))
                .map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full text-left px-4 py-3 rounded-lg border hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.email}</p>
                    </div>
                    <div className="text-right">
                      {patient.onboarding_completed && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">온보딩 완료</span>
                      )}
                      {patient.rehab_goal && (
                        <p className="text-xs text-gray-400 mt-1">
                          {patient.rehab_goal === 'daily_life' ? '일상복귀' :
                           patient.rehab_goal === 'sports_return' ? '스포츠복귀' :
                           patient.rehab_goal === 'work_return' ? '업무복귀' : patient.rehab_goal}
                        </p>
                      )}
                    </div>
                  </button>
                ))}

              {patients.length === 0 && (
                <p className="text-center text-gray-500 py-8">등록된 환자가 없습니다</p>
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ===== 환자 선택됨 → 처방 관리 =====
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedPatient(null)} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selectedPatient.name}님</h1>
              <p className="text-xs text-gray-500">운동 처방 관리</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* 현재 처방 목록 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">📋 현재 처방 운동</h2>
            <span className="text-sm text-gray-500">{currentPrescriptions.length}개</span>
          </div>

          {currentPrescriptions.length === 0 ? (
            <p className="text-center text-gray-500 py-6">처방된 운동이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {currentPrescriptions.map((rx) => (
                <div key={rx.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{rx.exercise_name}</p>
                    <p className="text-sm text-gray-600">{rx.sets}세트 × {rx.reps}회 · 주 {rx.frequency_per_week}회</p>
                    {rx.resistance && <p className="text-xs text-gray-400">저항: {rx.resistance}</p>}
                    {rx.notes && <p className="text-xs text-blue-500 mt-1">💬 {rx.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      처방일: {new Date(rx.prescribed_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemovePrescription(rx.id)}
                    className="text-red-400 hover:text-red-600 text-xl"
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 운동 라이브러리 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">📚 운동 라이브러리</h2>

          {/* 카테고리 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredExercises.map((exercise) => {
              const alreadyPrescribed = currentPrescriptions.some(p => p.exercise_id === exercise.id)

              return (
                <div
                  key={exercise.id}
                  className={`border rounded-lg p-3 flex items-center justify-between ${
                    alreadyPrescribed ? 'bg-gray-50 opacity-60' : ''
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{exercise.name}</p>
                    <p className="text-xs text-gray-500">{exercise.category} · {exercise.level} · {exercise.duration}</p>
                  </div>
                  <button
                    onClick={() => handleAddExercise(exercise)}
                    disabled={alreadyPrescribed}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      alreadyPrescribed
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {alreadyPrescribed ? '처방됨' : '+ 처방'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* 처방 설정 모달 */}
      {showAddModal && selectedExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">운동 세부 설정</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 text-2xl">×</button>
            </div>

            <p className="font-semibold text-blue-600">{selectedExercise.name}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">세트</label>
                <select
                  value={prescriptionForm.sets}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, sets: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}세트</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">반복</label>
                <select
                  value={prescriptionForm.reps}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, reps: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {[5, 8, 10, 12, 15, 20].map(n => <option key={n} value={n}>{n}회</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">주당 빈도</label>
                <select
                  value={prescriptionForm.frequency_per_week}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, frequency_per_week: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>주 {n}일</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">휴식 시간</label>
                <select
                  value={prescriptionForm.rest_seconds}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, rest_seconds: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {[30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n}초</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">저항 강도</label>
              <select
                value={prescriptionForm.resistance}
                onChange={(e) => setPrescriptionForm({ ...prescriptionForm, resistance: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">선택 안 함</option>
                <option value="노란색 밴드 (가벼움)">노란색 밴드 (가벼움)</option>
                <option value="빨간색 밴드 (보통)">빨간색 밴드 (보통)</option>
                <option value="파란색 밴드 (강함)">파란색 밴드 (강함)</option>
                <option value="검정색 밴드 (매우 강함)">검정색 밴드 (매우 강함)</option>
                <option value="1kg 덤벨">1kg 덤벨</option>
                <option value="2kg 덤벨">2kg 덤벨</option>
                <option value="3kg 덤벨">3kg 덤벨</option>
                <option value="맨손">맨손</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">특별 지시사항</label>
              <textarea
                value={prescriptionForm.notes}
                onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                placeholder="예: 팔꿈치를 몸에 붙이고 천천히 움직이세요"
                className="w-full border rounded-lg px-3 py-2 h-20 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handlePrescribe}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 disabled:bg-blue-300 transition"
              >
                {saving ? '저장 중...' : '처방 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
