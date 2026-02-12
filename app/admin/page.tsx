'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
  created_at?: string
}

interface Assignment {
  id: string
  patient_id: string
  trainer_id: string
  assigned_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [trainers, setTrainers] = useState<User[]>([])
  const [patients, setPatients] = useState<User[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [viewMode, setViewMode] = useState<'main' | 'trainers' | 'assignments'>('main')
  const [selectedTrainer, setSelectedTrainer] = useState<User | null>(null)

  // 트레이너 추가 폼
  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [newTrainerEmail, setNewTrainerEmail] = useState('')
  const [addingTrainer, setAddingTrainer] = useState(false)
  const [addMessage, setAddMessage] = useState('')

  // 환자 배정 모달
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTrainerId, setAssignTrainerId] = useState('')
  const [assignPatientId, setAssignPatientId] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          if (data.user.role !== 'admin') {
            router.push('/dashboard')
            return
          }
          setUser(data.user)
          fetchAll()
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const fetchAll = async () => {
    await Promise.all([fetchTrainers(), fetchPatients(), fetchAssignments()])
  }

  const fetchTrainers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'trainer')
      .order('name')
    if (data) setTrainers(data)
  }

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .not('role', 'in', '("trainer","admin")')
      .order('name')
    if (data) setPatients(data)
  }

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('patient_assignments')
      .select('*')
      .order('assigned_at', { ascending: false })
    if (data) setAssignments(data)
  }

  // 트레이너 추가 (기존 유저의 role을 trainer로 변경)
  const handleAddTrainer = async () => {
    if (!newTrainerEmail.trim() || addingTrainer) return
    setAddingTrainer(true)
    setAddMessage('')

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', newTrainerEmail.trim())
      .single()

    if (!existingUser) {
      setAddMessage('해당 이메일로 가입된 유저가 없습니다.')
      setAddingTrainer(false)
      return
    }

    if (existingUser.role === 'trainer') {
      setAddMessage('이미 트레이너입니다.')
      setAddingTrainer(false)
      return
    }

    if (existingUser.role === 'admin') {
      setAddMessage('관리자 계정은 트레이너로 변경할 수 없습니다.')
      setAddingTrainer(false)
      return
    }

    const { error } = await supabase
      .from('users')
      .update({ role: 'trainer' })
      .eq('id', existingUser.id)

    if (error) {
      setAddMessage('트레이너 추가 실패')
    } else {
      setAddMessage(`${existingUser.name}님이 트레이너로 등록되었습니다.`)
      setNewTrainerEmail('')
      await fetchAll()
    }
    setAddingTrainer(false)
  }

  // 트레이너 삭제 (role을 patient로 변경)
  const handleRemoveTrainer = async (trainer: User) => {
    if (!confirm(`${trainer.name}님을 트레이너에서 해제하시겠습니까?`)) return

    // 해당 트레이너의 배정 삭제
    await supabase
      .from('patient_assignments')
      .delete()
      .eq('trainer_id', trainer.id)

    await supabase
      .from('users')
      .update({ role: 'patient' })
      .eq('id', trainer.id)

    await fetchAll()
  }

  // 환자 배정
  const handleAssign = async () => {
    if (!assignTrainerId || !assignPatientId || assigning) return
    setAssigning(true)

    // 이미 배정되어 있는지 확인
    const existing = assignments.find(
      a => a.patient_id === assignPatientId && a.trainer_id === assignTrainerId
    )
    if (existing) {
      alert('이미 배정되어 있습니다.')
      setAssigning(false)
      return
    }

    const { error } = await supabase
      .from('patient_assignments')
      .insert({
        patient_id: assignPatientId,
        trainer_id: assignTrainerId,
      })

    if (error) {
      alert('배정 실패: ' + error.message)
    } else {
      setShowAssignModal(false)
      setAssignTrainerId('')
      setAssignPatientId('')
      await fetchAssignments()
    }
    setAssigning(false)
  }

  // 배정 해제
  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('배정을 해제하시겠습니까?')) return
    await supabase.from('patient_assignments').delete().eq('id', assignmentId)
    await fetchAssignments()
  }

  // 트레이너별 배정된 환자 수
  const getAssignedCount = (trainerId: string) => {
    return assignments.filter(a => a.trainer_id === trainerId).length
  }

  // 트레이너별 배정된 환자 목록
  const getAssignedPatients = (trainerId: string) => {
    const patientIds = assignments
      .filter(a => a.trainer_id === trainerId)
      .map(a => a.patient_id)
    return patients.filter(p => patientIds.includes(p.id))
  }

  // 배정되지 않은 환자
  const getUnassignedPatients = () => {
    const assignedIds = assignments.map(a => a.patient_id)
    return patients.filter(p => !assignedIds.includes(p.id))
  }

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || '알 수 없음'
  const getTrainerName = (id: string) => trainers.find(t => t.id === id)?.name || '알 수 없음'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {viewMode !== 'main' && (
                <button onClick={() => { setViewMode('main'); setSelectedTrainer(null) }} className="text-gray-600">
                  <span className="text-2xl">←</span>
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900">
                {viewMode === 'main' && '관리자 대시보드'}
                {viewMode === 'trainers' && '트레이너 관리'}
                {viewMode === 'assignments' && `${selectedTrainer?.name} - 환자 배정`}
              </h1>
            </div>
            <button onClick={() => router.push('/dashboard')} className="text-sm text-blue-500">홈으로</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* ===== 메인 대시보드 ===== */}
        {viewMode === 'main' && (
          <>
            {/* 현황 카드 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-blue-600">{trainers.length}</p>
                <p className="text-xs text-gray-500 mt-1">트레이너</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-green-600">{patients.length}</p>
                <p className="text-xs text-gray-500 mt-1">전체 환자</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-orange-600">{getUnassignedPatients().length}</p>
                <p className="text-xs text-gray-500 mt-1">미배정 환자</p>
              </div>
            </div>

            {/* 트레이너 관리 */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">트레이너 목록</h2>
                <button
                  onClick={() => setShowAddTrainer(!showAddTrainer)}
                  className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600"
                >
                  + 트레이너 추가
                </button>
              </div>

              {/* 트레이너 추가 폼 */}
              {showAddTrainer && (
                <div className="p-4 bg-blue-50 border-b">
                  <p className="text-sm text-gray-600 mb-2">기존 가입된 유저의 이메일을 입력하면 트레이너로 등록됩니다.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newTrainerEmail}
                      onChange={(e) => setNewTrainerEmail(e.target.value)}
                      placeholder="이메일 입력"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleAddTrainer}
                      disabled={addingTrainer}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:bg-blue-300"
                    >
                      등록
                    </button>
                  </div>
                  {addMessage && (
                    <p className="text-sm mt-2 text-gray-700">{addMessage}</p>
                  )}
                </div>
              )}

              {/* 트레이너 리스트 */}
              <div className="divide-y">
                {trainers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p>등록된 트레이너가 없습니다</p>
                  </div>
                ) : (
                  trainers.map((trainer) => (
                    <div key={trainer.id} className="p-4 flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => { setSelectedTrainer(trainer); setViewMode('assignments') }}
                      >
                        <p className="font-semibold text-gray-900">{trainer.name}</p>
                        <p className="text-xs text-gray-500">{trainer.email}</p>
                        <p className="text-xs text-blue-500 mt-0.5">
                          담당 환자 {getAssignedCount(trainer.id)}명
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedTrainer(trainer); setViewMode('assignments') }}
                          className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                        >
                          환자 배정
                        </button>
                        <button
                          onClick={() => handleRemoveTrainer(trainer)}
                          className="text-sm text-red-500 px-2 py-1.5 hover:bg-red-50 rounded-lg"
                        >
                          해제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 미배정 환자 */}
            {getUnassignedPatients().length > 0 && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-orange-600">⚠️ 미배정 환자</h2>
                </div>
                <div className="divide-y">
                  {getUnassignedPatients().map((patient) => (
                    <div key={patient.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setAssignPatientId(patient.id)
                          setShowAssignModal(true)
                        }}
                        className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600"
                      >
                        배정하기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== 트레이너별 환자 배정 ===== */}
        {viewMode === 'assignments' && selectedTrainer && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">👨‍⚕️</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selectedTrainer.name}</p>
                  <p className="text-xs text-gray-500">{selectedTrainer.email}</p>
                </div>
              </div>
            </div>

            {/* 배정된 환자 */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  담당 환자 ({getAssignedPatients(selectedTrainer.id).length}명)
                </h2>
                <button
                  onClick={() => {
                    setAssignTrainerId(selectedTrainer.id)
                    setShowAssignModal(true)
                  }}
                  className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600"
                >
                  + 환자 배정
                </button>
              </div>
              <div className="divide-y">
                {getAssignedPatients(selectedTrainer.id).length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <p>배정된 환자가 없습니다</p>
                  </div>
                ) : (
                  getAssignedPatients(selectedTrainer.id).map((patient) => {
                    const assignment = assignments.find(
                      a => a.patient_id === patient.id && a.trainer_id === selectedTrainer.id
                    )
                    return (
                      <div key={patient.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{patient.name}</p>
                          <p className="text-xs text-gray-500">{patient.email}</p>
                          {assignment && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(assignment.assigned_at).toLocaleDateString('ko-KR')} 배정
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => assignment && handleUnassign(assignment.id)}
                          className="text-sm text-red-500 px-3 py-1.5 hover:bg-red-50 rounded-lg"
                        >
                          배정 해제
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* 환자 배정 모달 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">환자 배정</h3>
              <button
                onClick={() => { setShowAssignModal(false); setAssignTrainerId(''); setAssignPatientId('') }}
                className="text-gray-400 text-xl"
              >✕</button>
            </div>
            <div className="p-4 space-y-4">
              {/* 트레이너 선택 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">트레이너</label>
                <select
                  value={assignTrainerId}
                  onChange={(e) => setAssignTrainerId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">선택하세요</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>

              {/* 환자 선택 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">환자</label>
                {assignPatientId ? (
                  <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50">
                    {getPatientName(assignPatientId)}
                    <button
                      onClick={() => setAssignPatientId('')}
                      className="ml-2 text-red-500 text-xs"
                    >변경</button>
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {patients.map(p => {
                      const isAssigned = assignTrainerId && assignments.some(
                        a => a.patient_id === p.id && a.trainer_id === assignTrainerId
                      )
                      return (
                        <button
                          key={p.id}
                          onClick={() => !isAssigned && setAssignPatientId(p.id)}
                          disabled={!!isAssigned}
                          className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${
                            isAssigned
                              ? 'bg-gray-100 text-gray-400'
                              : 'hover:bg-blue-50'
                          }`}
                        >
                          {p.name}
                          {isAssigned && <span className="text-xs ml-2">(이미 배정됨)</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={handleAssign}
                disabled={!assignTrainerId || !assignPatientId || assigning}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-blue-300"
              >
                {assigning ? '배정 중...' : '배정하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
