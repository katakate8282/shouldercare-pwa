'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Hospital {
  id: string
  name: string
  prefix: string
  plan_type: string
  contract_status: string
  admin_email: string | null
  phone: string | null
  address: string | null
  contract_start: string
  contract_end: string | null
}

interface Patient {
  id: string
  hospital_code: string
  patient_name: string
  patient_phone: string
  diagnosis: string | null
  surgery_name: string | null
  assigned_trainer_id: string | null
  assigned_trainer: { name: string; email: string } | null
  linked_user: { name: string; email: string } | null
  program_start_date: string | null
  program_end_date: string | null
  program_week: number | null
  program_status: string
  is_active: boolean
  notes: string | null
  user_id: string | null
  created_at: string
}

interface Trainer {
  id: string
  name: string
  email: string
  active_patient_count: number
}

type Tab = 'patients' | 'trainers' | 'info'

const HOSPITAL_TOKEN_KEY = 'hospital_token'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(HOSPITAL_TOKEN_KEY)
}
function setStoredToken(token: string) { localStorage.setItem(HOSPITAL_TOKEN_KEY, token) }
function removeStoredToken() { localStorage.removeItem(HOSPITAL_TOKEN_KEY) }

async function hospitalFetch(url: string, options?: RequestInit) {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...options, headers })
}

// 전화번호 포맷: 01012345678 → 010-1234-5678
function formatPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

// 전화번호 입력 시 자동 하이픈
function autoFormatPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

export default function HospitalPage() {
  const router = useRouter()

  const [authenticated, setAuthenticated] = useState(false)
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [loading, setLoading] = useState(true)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [tab, setTab] = useState<Tab>('patients')

  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)

  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [trainersLoading, setTrainersLoading] = useState(false)

  const [showAddPatient, setShowAddPatient] = useState(false)
  const [patientForm, setPatientForm] = useState({
    patient_name: '',
    patient_phone: '',
    diagnosis: '',
    surgery_name: '',
    assigned_trainer_id: '',
    notes: '',
  })
  const [addingPatient, setAddingPatient] = useState(false)
  const [patientMessage, setPatientMessage] = useState('')

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  useEffect(() => { checkSession() }, [])

  async function checkSession() {
    try {
      const token = getStoredToken()
      if (!token) { setLoading(false); return }
      const res = await hospitalFetch('/api/auth/hospital/me')
      if (res.ok) {
        const data = await res.json()
        if (data.hospital) { setHospital(data.hospital); setAuthenticated(true) }
      } else { removeStoredToken() }
    } catch { removeStoredToken() }
    finally { setLoading(false) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/auth/hospital/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStoredToken(data.token)
        setHospital(data.hospital)
        setAuthenticated(true)
      } else {
        setLoginError(data.error || '로그인 실패')
      }
    } catch { setLoginError('서버 연결 오류') }
    finally { setLoginLoading(false) }
  }

  function handleLogout() {
    removeStoredToken()
    setAuthenticated(false)
    setHospital(null)
    setPatients([])
    setTrainers([])
  }

  async function fetchPatients() {
    setPatientsLoading(true)
    try {
      const res = await hospitalFetch('/api/auth/hospital/patients')
      if (res.ok) { const data = await res.json(); setPatients(data.patients || []) }
    } catch (err) { console.error('환자 조회 실패:', err) }
    finally { setPatientsLoading(false) }
  }

  async function fetchTrainers() {
    setTrainersLoading(true)
    try {
      const res = await hospitalFetch('/api/auth/hospital/trainers')
      if (res.ok) { const data = await res.json(); setTrainers(data.trainers || []) }
    } catch (err) { console.error('트레이너 조회 실패:', err) }
    finally { setTrainersLoading(false) }
  }

  useEffect(() => {
    if (authenticated) { fetchPatients(); fetchTrainers() }
  }, [authenticated])

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault()
    setAddingPatient(true)
    setPatientMessage('')
    try {
      const res = await hospitalFetch('/api/auth/hospital/patients', {
        method: 'POST',
        body: JSON.stringify(patientForm),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPatientMessage(`✅ 등록 완료! 병원코드: ${data.hospital_code}`)
        setPatientForm({ patient_name: '', patient_phone: '', diagnosis: '', surgery_name: '', assigned_trainer_id: '', notes: '' })
        fetchPatients()
        setTimeout(() => { setShowAddPatient(false); setPatientMessage('') }, 2000)
      } else {
        setPatientMessage(`❌ ${data.error}`)
      }
    } catch { setPatientMessage('❌ 서버 연결 오류') }
    finally { setAddingPatient(false) }
  }

  async function updatePatientStatus(patientId: string, program_status: string) {
    try {
      const res = await hospitalFetch('/api/auth/hospital/patients', {
        method: 'PATCH',
        body: JSON.stringify({ patient_id: patientId, program_status }),
      })
      if (res.ok) {
        fetchPatients()
        if (selectedPatient?.id === patientId) {
          setSelectedPatient(prev => prev ? { ...prev, program_status } : null)
        }
      }
    } catch (err) { console.error('상태 변경 실패:', err) }
  }

  async function assignTrainer(patientId: string, trainerId: string) {
    try {
      const res = await hospitalFetch('/api/auth/hospital/patients', {
        method: 'PATCH',
        body: JSON.stringify({ patient_id: patientId, assigned_trainer_id: trainerId || null }),
      })
      if (res.ok) { fetchPatients() }
    } catch (err) { console.error('트레이너 배정 실패:', err) }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ko-KR')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f9fa' }}>
        <p style={{ color: '#666' }}>로딩 중...</p>
      </div>
    )
  }

  // 로그인 화면
  if (!authenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>병원 관리자</h1>
            <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>어깨케어 병원 관리 시스템</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>이메일</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="hospital@example.com" required
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #ddd', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#667eea'} onBlur={e => e.target.style.borderColor = '#ddd'} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>비밀번호</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" required
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #ddd', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#667eea'} onBlur={e => e.target.style.borderColor = '#ddd'} />
            </div>
            {loginError && (
              <div style={{ background: '#fff0f0', color: '#e53e3e', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{loginError}</div>
            )}
            <button type="submit" disabled={loginLoading}
              style={{ width: '100%', padding: '14px', background: loginLoading ? '#aaa' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: loginLoading ? 'not-allowed' : 'pointer' }}>
              {loginLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 24 }}>계정은 어깨케어 관리자가 발급합니다</p>
        </div>
      </div>
    )
  }

  // 메인 대시보드
  const activePatients = patients.filter(p => p.program_status === 'active')
  const completedPatients = patients.filter(p => p.program_status === 'completed')
  const linkedPatients = patients.filter(p => p.user_id)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1px solid #e8e8e8', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🏥</span>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{hospital?.name || '병원'}</h1>
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
              {hospital?.plan_type === 'premium' ? '프리미엄' : '베이직'} · {hospital?.prefix}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666' }}>로그아웃</button>
      </div>

      {/* 요약 카드 */}
      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#667eea' }}>{activePatients.length}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>활성 환자</div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#48bb78' }}>{linkedPatients.length}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>앱 연동</div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ed8936' }}>{trainers.length}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>트레이너</div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#a0aec0' }}>{completedPatients.length}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>완료</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ padding: '0 24px', display: 'flex', gap: 4, borderBottom: '1px solid #e8e8e8', background: 'white' }}>
        {[
          { key: 'patients' as Tab, label: '👥 환자 관리' },
          { key: 'trainers' as Tab, label: '🏋️ 트레이너' },
          { key: 'info' as Tab, label: 'ℹ️ 병원 정보' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? '#667eea' : '#888', borderBottom: tab === t.key ? '2px solid #667eea' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>

        {/* 환자 관리 탭 */}
        {tab === 'patients' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>환자 목록 ({patients.length}명)</h2>
              <button onClick={() => setShowAddPatient(true)}
                style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                + 환자 등록
              </button>
            </div>

            {patientsLoading ? (
              <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>불러오는 중...</p>
            ) : patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <p>등록된 환자가 없습니다</p>
                <button onClick={() => setShowAddPatient(true)} style={{ marginTop: 12, padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>첫 환자 등록하기</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {patients.map(patient => (
                  <div key={patient.id} onClick={() => setSelectedPatient(patient)}
                    style={{ background: 'white', borderRadius: 12, padding: '16px 20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: selectedPatient?.id === patient.id ? '2px solid #667eea' : '1px solid #eee', transition: 'border-color 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{patient.patient_name}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: patient.program_status === 'active' ? '#e6fffa' : patient.program_status === 'completed' ? '#f0f0f0' : '#fff5f5',
                            color: patient.program_status === 'active' ? '#38a169' : patient.program_status === 'completed' ? '#888' : '#e53e3e',
                          }}>
                            {patient.program_status === 'active' ? '진행중' : patient.program_status === 'completed' ? '완료' : '중단'}
                          </span>
                          {patient.user_id && <span style={{ fontSize: 11, color: '#667eea' }}>📱 앱연동</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                          <span style={{ background: '#f7f7f7', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }}>{patient.hospital_code}</span>
                          <span style={{ marginLeft: 8 }}>{formatPhone(patient.patient_phone)}</span>
                          {patient.diagnosis && <span style={{ marginLeft: 8 }}>📋 {patient.diagnosis}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#888' }}>
                        {patient.program_week && <div style={{ fontWeight: 600, color: '#667eea' }}>{patient.program_week}주차</div>}
                        <div>{patient.assigned_trainer?.name || '트레이너 미배정'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 환자 상세 모달 */}
            {selectedPatient && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedPatient.patient_name}</h3>
                    <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>병원코드</span><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedPatient.hospital_code}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>전화번호</span><span>{formatPhone(selectedPatient.patient_phone)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>진단명</span><span>{selectedPatient.diagnosis || '-'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>시술/수술</span><span>{selectedPatient.surgery_name || '-'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>프로그램</span><span>{selectedPatient.program_week ? `${selectedPatient.program_week}주차 / 12주` : '-'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>시작일</span><span>{formatDate(selectedPatient.program_start_date)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>종료 예정</span><span>{formatDate(selectedPatient.program_end_date)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>앱 연동</span><span>{selectedPatient.linked_user ? `✅ ${selectedPatient.linked_user.name}` : '❌ 미연동'}</span></div>
                    {selectedPatient.notes && <div><span style={{ color: '#888' }}>메모:</span> <span>{selectedPatient.notes}</span></div>}

                    <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '8px 0' }} />

                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>담당 트레이너</label>
                      <select value={selectedPatient.assigned_trainer_id || ''}
                        onChange={e => { assignTrainer(selectedPatient.id, e.target.value); setSelectedPatient(prev => prev ? { ...prev, assigned_trainer_id: e.target.value || null } : null) }}
                        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14 }}>
                        <option value="">미배정</option>
                        {trainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.active_patient_count}명 담당)</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {selectedPatient.program_status === 'active' && (
                        <>
                          <button onClick={() => updatePatientStatus(selectedPatient.id, 'completed')} style={{ flex: 1, padding: 10, background: '#48bb78', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>프로그램 완료</button>
                          <button onClick={() => updatePatientStatus(selectedPatient.id, 'paused')} style={{ flex: 1, padding: 10, background: '#ed8936', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>일시 중단</button>
                        </>
                      )}
                      {selectedPatient.program_status === 'paused' && (
                        <button onClick={() => updatePatientStatus(selectedPatient.id, 'active')} style={{ flex: 1, padding: 10, background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>재개</button>
                      )}
                      {selectedPatient.program_status === 'completed' && (
                        <button onClick={() => updatePatientStatus(selectedPatient.id, 'active')} style={{ flex: 1, padding: 10, background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>재시작</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 환자 등록 모달 */}
            {showAddPatient && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>새 환자 등록</h3>
                    <button onClick={() => { setShowAddPatient(false); setPatientMessage('') }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
                  </div>

                  <form onSubmit={handleAddPatient}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>환자 이름 *</label>
                        <input value={patientForm.patient_name} onChange={e => setPatientForm(f => ({ ...f, patient_name: e.target.value }))} required
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>전화번호 * <span style={{ fontWeight: 400, color: '#aaa' }}>(병원코드 자동 생성)</span></label>
                        <input value={patientForm.patient_phone}
                          onChange={e => setPatientForm(f => ({ ...f, patient_phone: autoFormatPhone(e.target.value) }))}
                          required placeholder="010-1234-5678" maxLength={13}
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>진단명</label>
                        <input value={patientForm.diagnosis} onChange={e => setPatientForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="예: 회전근개 파열"
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>시술/수술명</label>
                        <input value={patientForm.surgery_name} onChange={e => setPatientForm(f => ({ ...f, surgery_name: e.target.value }))} placeholder="예: 관절경 수술"
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>담당 트레이너</label>
                        <select value={patientForm.assigned_trainer_id} onChange={e => setPatientForm(f => ({ ...f, assigned_trainer_id: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                          <option value="">미배정</option>
                          {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>메모</label>
                        <textarea value={patientForm.notes} onChange={e => setPatientForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>
                    </div>

                    {patientMessage && (
                      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: patientMessage.startsWith('✅') ? '#e6fffa' : '#fff0f0', color: patientMessage.startsWith('✅') ? '#38a169' : '#e53e3e' }}>
                        {patientMessage}
                      </div>
                    )}

                    <button type="submit" disabled={addingPatient}
                      style={{ width: '100%', marginTop: 18, padding: 14, background: addingPatient ? '#aaa' : '#667eea', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: addingPatient ? 'not-allowed' : 'pointer' }}>
                      {addingPatient ? '등록 중...' : '환자 등록'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 트레이너 탭 */}
        {tab === 'trainers' && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>소속 트레이너 ({trainers.length}명)</h2>
            {trainersLoading ? (
              <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>불러오는 중...</p>
            ) : trainers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div>
                <p>소속 트레이너가 없습니다</p>
                <p style={{ fontSize: 13, color: '#aaa' }}>어깨케어 관리자에게 트레이너 배정을 요청하세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trainers.map(trainer => (
                  <div key={trainer.id} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{trainer.name}</span>
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{trainer.email}</span>
                      </div>
                      <span style={{ background: '#edf2f7', padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#4a5568' }}>
                        담당 {trainer.active_patient_count}명
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 병원 정보 탭 */}
        {tab === 'info' && hospital && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>병원 정보</h2>
            <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>병원명</span><span style={{ fontWeight: 600 }}>{hospital.name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>프리픽스</span><span style={{ fontFamily: 'monospace' }}>{hospital.prefix}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>플랜</span><span>{hospital.plan_type === 'premium' ? '프리미엄 (₩50만/월)' : '베이직 (₩10만/월)'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>계약 상태</span><span style={{ color: hospital.contract_status === 'active' ? '#38a169' : '#e53e3e', fontWeight: 600 }}>{hospital.contract_status === 'active' ? '활성' : '해지'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>계약 시작일</span><span>{formatDate(hospital.contract_start)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>관리자 이메일</span><span>{hospital.admin_email || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>전화번호</span><span>{hospital.phone || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#888' }}>주소</span><span>{hospital.address || '-'}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
