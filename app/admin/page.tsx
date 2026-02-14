'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
  subscription_type?: string
  created_at?: string
  onboarding_completed?: boolean
  rehab_goal?: string
  pain_level_initial?: number
  trainer_affiliation?: string
}

interface Assignment {
  id: string
  patient_id: string
  trainer_id: string
  assigned_at: string
}

interface ActivityItem {
  id: string
  userName: string
  userId: string
  type: 'exercise' | 'pain'
  detail: string
  time: string
  rawTime: string
}

interface AlertItem {
  userId: string
  userName: string
  email: string
  type: 'pain_spike' | 'inactive'
  detail: string
}

interface Hospital {
  id: string
  name: string
  prefix: string
  plan_type: string
  contract_status: string
  contract_start: string
  contract_end: string | null
  admin_email: string | null
  business_number: string | null
  phone: string | null
  address: string | null
  created_at: string
}

type Tab = 'overview' | 'trainers' | 'hospitals'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  // 데이터
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [trainers, setTrainers] = useState<User[]>([])
  const [patients, setPatients] = useState<User[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])

  // 모달/확장 상태
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<User | null>(null)
  const [showMemberModal, setShowMemberModal] = useState(false)

  // 트레이너 관리
  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [newTrainerEmail, setNewTrainerEmail] = useState('')
  const [addingTrainer, setAddingTrainer] = useState(false)
  const [addMessage, setAddMessage] = useState('')
  const [selectedTrainer, setSelectedTrainer] = useState<User | null>(null)

  // 환자 배정 모달
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTrainerId, setAssignTrainerId] = useState('')
  const [assignPatientId, setAssignPatientId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // 병원 관리
  const [showAddHospital, setShowAddHospital] = useState(false)
  const [hospitalForm, setHospitalForm] = useState({
    name: '', prefix: '', plan_type: 'basic', business_number: '', phone: '', address: '',
    admin_email: '', admin_password: ''
  })
  const [addingHospital, setAddingHospital] = useState(false)
  const [hospitalMessage, setHospitalMessage] = useState('')
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null)

  // 트레이너 소속 변경
  const [showAffiliationModal, setShowAffiliationModal] = useState(false)
  const [affiliationTrainer, setAffiliationTrainer] = useState<User | null>(null)
  const [affiliationValue, setAffiliationValue] = useState('')

  useEffect(() => {
    fetchAuthMe()
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
    await Promise.all([
      fetchUsers(),
      fetchAssignments(),
      fetchTodayActivities(),
      fetchAlerts(),
      fetchHospitals(),
    ])
  }

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setAllUsers(data)
      setTrainers(data.filter(u => u.role === 'trainer'))
      setPatients(data.filter(u => u.role !== 'trainer'))
    }
  }

  const fetchHospitals = async () => {
    const { data } = await supabase
      .from('hospitals')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setHospitals(data)
  }

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('patient_assignments')
      .select('*')
      .order('assigned_at', { ascending: false })
    if (data) setAssignments(data)
  }

  const fetchTodayActivities = async () => {
    const now = new Date()
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const kstToday = new Date(kstNow)
    kstToday.setHours(0, 0, 0, 0)
    const kstTodayUTC = new Date(kstToday.getTime() - 9 * 60 * 60 * 1000).toISOString()

    const { data: exLogs } = await supabase
      .from('exercise_logs')
      .select('id, user_id, exercise_name, sets_completed, reps_completed, completed_at')
      .gte('completed_at', kstTodayUTC)
      .order('completed_at', { ascending: false })

    const { data: pnLogs } = await supabase
      .from('pain_logs')
      .select('id, user_id, pain_level, logged_at')
      .gte('logged_at', kstTodayUTC)
      .order('logged_at', { ascending: false })

    const { data: users } = await supabase.from('users').select('id, name')
    const nameMap: Record<string, string> = {}
    users?.forEach(u => { nameMap[u.id] = u.name })

    const items: ActivityItem[] = []

    exLogs?.forEach(log => {
      const t = new Date(log.completed_at)
      items.push({
        id: log.id, userName: nameMap[log.user_id] || '알 수 없음', userId: log.user_id,
        type: 'exercise', detail: `${log.exercise_name} ${log.sets_completed}세트×${log.reps_completed}회`,
        time: t.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
        rawTime: log.completed_at,
      })
    })

    pnLogs?.forEach(log => {
      const t = new Date(log.logged_at)
      items.push({
        id: log.id, userName: nameMap[log.user_id] || '알 수 없음', userId: log.user_id,
        type: 'pain', detail: `통증 ${log.pain_level}/10`,
        time: t.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
        rawTime: log.logged_at,
      })
    })

    items.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime())
    setActivities(items)
  }

  const fetchAlerts = async () => {
    const now = new Date()
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const kstToday = new Date(kstNow)
    kstToday.setHours(0, 0, 0, 0)
    const kstTodayUTC = new Date(kstToday.getTime() - 9 * 60 * 60 * 1000).toISOString()

    const alertItems: AlertItem[] = []

    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, role')
      .not('role', 'in', '("trainer","admin","hospital_admin")')

    const nameMap: Record<string, { name: string; email: string }> = {}
    users?.forEach(u => { nameMap[u.id] = { name: u.name, email: u.email } })

    const { data: painLogs } = await supabase
      .from('pain_logs')
      .select('user_id, pain_level')
      .gte('logged_at', kstTodayUTC)
      .gte('pain_level', 8)

    const painUsers = new Set<string>()
    painLogs?.forEach(log => {
      if (!painUsers.has(log.user_id) && nameMap[log.user_id]) {
        painUsers.add(log.user_id)
        alertItems.push({
          userId: log.user_id, userName: nameMap[log.user_id].name, email: nameMap[log.user_id].email,
          type: 'pain_spike', detail: `통증 ${log.pain_level}/10 기록`,
        })
      }
    })

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: recentLogs } = await supabase
      .from('exercise_logs')
      .select('user_id')
      .gte('completed_at', weekAgo.toISOString())

    const activeUserIds = new Set(recentLogs?.map(l => l.user_id) || [])
    users?.forEach(u => {
      if (!activeUserIds.has(u.id)) {
        alertItems.push({ userId: u.id, userName: u.name, email: u.email, type: 'inactive', detail: '7일 이상 운동 없음' })
      }
    })

    setAlerts(alertItems)
  }

  // 회원 분류
  const getSubscriptionMembers = (type: string) => patients.filter(p => (p.subscription_type || 'FREE') === type)
  const getNewMembers = () => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    return patients.filter(p => p.created_at && new Date(p.created_at) >= weekAgo)
  }
  const getFreeMembers = () => patients.filter(p => !p.subscription_type || p.subscription_type === 'FREE')

  // 트레이너 추가
  const handleAddTrainer = async () => {
    if (!newTrainerEmail.trim() || addingTrainer) return
    setAddingTrainer(true); setAddMessage('')

    const { data: existingUser } = await supabase.from('users').select('*').eq('email', newTrainerEmail.trim()).single()
    if (!existingUser) { setAddMessage('해당 이메일로 가입된 유저가 없습니다.'); setAddingTrainer(false); return }
    if (existingUser.role === 'trainer') { setAddMessage('이미 트레이너입니다.'); setAddingTrainer(false); return }
    if (existingUser.role === 'admin') { setAddMessage('관리자는 변경할 수 없습니다.'); setAddingTrainer(false); return }

    await supabase.from('users').update({ role: 'trainer', trainer_affiliation: 'shouldercare' }).eq('id', existingUser.id)
    setAddMessage(`${existingUser.name}님이 어깨케어 소속 트레이너로 등록되었습니다.`)
    setNewTrainerEmail('')
    await fetchUsers()
    setAddingTrainer(false)
  }

  const handleRemoveTrainer = async (trainer: User) => {
    if (!confirm(`${trainer.name}님을 트레이너에서 해제하시겠습니까?`)) return
    await supabase.from('patient_assignments').delete().eq('trainer_id', trainer.id)
    await supabase.from('users').update({ role: 'patient', trainer_affiliation: null }).eq('id', trainer.id)
    setSelectedTrainer(null)
    await fetchAll()
  }

  // 환자 배정
  const handleAssign = async () => {
    if (!assignTrainerId || !assignPatientId || assigning) return
    setAssigning(true)
    const existing = assignments.find(a => a.patient_id === assignPatientId && a.trainer_id === assignTrainerId)
    if (existing) { alert('이미 배정됨'); setAssigning(false); return }
    const { error } = await supabase.from('patient_assignments').insert({ patient_id: assignPatientId, trainer_id: assignTrainerId })
    if (error) alert('배정 실패: ' + error.message)
    else { setShowAssignModal(false); setAssignTrainerId(''); setAssignPatientId(''); await fetchAssignments() }
    setAssigning(false)
  }

  const handleUnassign = async (id: string) => {
    if (!confirm('배정 해제?')) return
    await supabase.from('patient_assignments').delete().eq('id', id)
    await fetchAssignments()
  }

  // 병원 등록
  const handleAddHospital = async () => {
    if (!hospitalForm.name || !hospitalForm.prefix || !hospitalForm.admin_email || !hospitalForm.admin_password) {
      setHospitalMessage('병원명, 프리픽스, 관리자 이메일/비번은 필수입니다.')
      return
    }
    if (hospitalForm.prefix.length !== 3) {
      setHospitalMessage('프리픽스는 정확히 3자리여야 합니다.')
      return
    }

    setAddingHospital(true); setHospitalMessage('')

    // 프리픽스 중복 확인
    const { data: existing } = await supabase.from('hospitals').select('id').eq('prefix', hospitalForm.prefix.toUpperCase()).single()
    if (existing) { setHospitalMessage('이미 사용 중인 프리픽스입니다.'); setAddingHospital(false); return }

    // 병원 ID 생성
    const hospitalId = hospitalForm.prefix.toUpperCase().toLowerCase() + '_' + Date.now()

    // 비밀번호 해시 (bcrypt)
    const bcryptHash = await (await import("bcryptjs")).default.hash(hospitalForm.admin_password, 10)
    // bcrypt hash generated above

    const { error } = await supabase.from('hospitals').insert({
      id: hospitalId,
      name: hospitalForm.name,
      prefix: hospitalForm.prefix.toUpperCase(),
      plan_type: hospitalForm.plan_type,
      contract_status: 'active',
      business_number: hospitalForm.business_number || null,
      phone: hospitalForm.phone || null,
      address: hospitalForm.address || null,
      admin_email: hospitalForm.admin_email,
      admin_password_hash: bcryptHash,
    })

    if (error) {
      setHospitalMessage('등록 실패: ' + error.message)
    } else {
      setHospitalMessage(`${hospitalForm.name} 등록 완료! 관리자 이메일: ${hospitalForm.admin_email}`)
      setHospitalForm({ name: '', prefix: '', plan_type: 'basic', business_number: '', phone: '', address: '', admin_email: '', admin_password: '' })
      await fetchHospitals()
    }
    setAddingHospital(false)
  }

  // 트레이너 소속 변경
  const handleChangeAffiliation = async () => {
    if (!affiliationTrainer) return
    await supabase.from('users').update({ trainer_affiliation: affiliationValue || 'shouldercare' }).eq('id', affiliationTrainer.id)
    setShowAffiliationModal(false)
    setAffiliationTrainer(null)
    await fetchUsers()
  }

  // 병원 계약 상태 변경
  const handleContractChange = async (hospitalId: string, status: string) => {
    await supabase.from('hospitals').update({
      contract_status: status,
      ...(status === 'cancelled' ? { contract_end: new Date().toISOString() } : {})
    }).eq('id', hospitalId)
    await fetchHospitals()
    if (selectedHospital?.id === hospitalId) {
      setSelectedHospital(prev => prev ? { ...prev, contract_status: status } : null)
    }
  }

  const getAssignedCount = (trainerId: string) => assignments.filter(a => a.trainer_id === trainerId).length
  const getAssignedPatients = (trainerId: string) => {
    const ids = assignments.filter(a => a.trainer_id === trainerId).map(a => a.patient_id)
    return patients.filter(p => ids.includes(p.id))
  }
  const getUnassignedPatients = () => {
    const ids = assignments.map(a => a.patient_id)
    return patients.filter(p => !ids.includes(p.id))
  }
  const getHospitalTrainers = (hospitalId: string) => trainers.filter(t => t.trainer_affiliation === hospitalId)
  const getHospitalName = (id: string) => hospitals.find(h => h.id === id)?.name || id
  const getTrainerAffiliationLabel = (t: User) => {
    if (!t.trainer_affiliation || t.trainer_affiliation === 'shouldercare') return '어깨케어'
    return getHospitalName(t.trainer_affiliation)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  const openMemberDetail = (u: User) => { setSelectedMember(u); setShowMemberModal(true) }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">로딩중...</div></div>
  if (!user) return null

  const premiumCount = getSubscriptionMembers('PREMIUM').length
  const platinumCount = getSubscriptionMembers('PLATINUM_PATIENT').length
  const trialCount = getSubscriptionMembers('TRIAL').length
  const freeCount = getFreeMembers().length
  const newCount = getNewMembers().length

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard')} className="text-gray-600"><span className="text-2xl">←</span></button>
              <h1 className="text-xl font-bold text-gray-900">관리자</h1>
            </div>
            <button onClick={() => router.push('/admin/reports')} className="text-sm bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:bg-purple-600">📊 리포트</button>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => { setTab('overview'); setSelectedTrainer(null); setSelectedHospital(null) }} className={`flex-1 py-2 text-xs font-medium rounded-md ${tab === 'overview' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>현황·회원</button>
            <button onClick={() => { setTab('trainers'); setSelectedTrainer(null); setSelectedHospital(null) }} className={`flex-1 py-2 text-xs font-medium rounded-md ${tab === 'trainers' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>트레이너</button>
            <button onClick={() => { setTab('hospitals'); setSelectedTrainer(null); setSelectedHospital(null) }} className={`flex-1 py-2 text-xs font-medium rounded-md ${tab === 'hospitals' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>🏥 병원</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* ====== 현황·회원 탭 ====== */}
        {tab === 'overview' && !selectedTrainer && (
          <>
            {/* 구독 회원 현황 */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-3 border-b"><h2 className="font-semibold text-gray-900">💎 구독 회원 현황</h2></div>
              <div className="divide-y">
                {[
                  { label: '프리미엄', count: premiumCount, type: 'PREMIUM', color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: '플래티넘 환자', count: platinumCount, type: 'PLATINUM_PATIENT', color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: '무료 체험', count: trialCount, type: 'TRIAL', color: 'text-green-600', bg: 'bg-green-50' },
                ].map(item => (
                  <button key={item.type} onClick={() => setExpandedSection(expandedSection === item.type ? null : item.type)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${item.color}`}>{item.count}명</span>
                        <span className="text-gray-400 text-xs">{expandedSection === item.type ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {expandedSection === item.type && item.count > 0 && (
                      <div className={`mt-2 ${item.bg} rounded-lg p-2 space-y-1`}>
                        {getSubscriptionMembers(item.type).map(m => (
                          <button key={m.id} onClick={(e) => { e.stopPropagation(); openMemberDetail(m) }} className="w-full text-left px-2 py-1.5 rounded hover:bg-white/80 text-sm text-gray-800 flex items-center justify-between">
                            <span>{m.name}</span><span className="text-xs text-gray-400">{m.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 신규 / 무료 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg shadow-sm">
                <button onClick={() => setExpandedSection(expandedSection === 'new' ? null : 'new')} className="w-full text-left p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">신규 (7일)</p>
                    <span className="text-lg font-bold text-green-600">{newCount}명</span>
                  </div>
                </button>
                {expandedSection === 'new' && (
                  <div className="px-3 pb-3"><div className="bg-green-50 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                    {getNewMembers().length === 0 ? <p className="text-xs text-gray-400 text-center py-2">없음</p> :
                      getNewMembers().map(m => (
                        <button key={m.id} onClick={() => openMemberDetail(m)} className="w-full text-left px-2 py-1.5 rounded hover:bg-white/80 text-sm text-gray-800 flex items-center justify-between">
                          <span>{m.name}</span><span className="text-xs text-gray-400">{m.created_at ? formatDate(m.created_at) : ''}</span>
                        </button>
                      ))}
                  </div></div>
                )}
              </div>
              <div className="bg-white rounded-lg shadow-sm">
                <button onClick={() => setExpandedSection(expandedSection === 'free' ? null : 'free')} className="w-full text-left p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">무료 회원</p>
                    <span className="text-lg font-bold text-orange-600">{freeCount}명</span>
                  </div>
                </button>
                {expandedSection === 'free' && (
                  <div className="px-3 pb-3"><div className="bg-orange-50 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                    {getFreeMembers().length === 0 ? <p className="text-xs text-gray-400 text-center py-2">없음</p> :
                      getFreeMembers().map(m => (
                        <button key={m.id} onClick={() => openMemberDetail(m)} className="w-full text-left px-2 py-1.5 rounded hover:bg-white/80 text-sm text-gray-800 flex items-center justify-between">
                          <span>{m.name}</span><span className="text-xs text-gray-400">{m.email}</span>
                        </button>
                      ))}
                  </div></div>
                )}
              </div>
            </div>

            {/* 병원 현황 요약 */}
            {hospitals.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-3 border-b"><h2 className="font-semibold text-gray-900">🏥 계약 병원 현황</h2></div>
                <div className="divide-y">
                  {hospitals.filter(h => h.contract_status === 'active').map(h => (
                    <div key={h.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{h.name}</p>
                        <p className="text-xs text-gray-500">{h.prefix} · {h.plan_type === 'premium' ? '프리미엄' : '베이직'}</p>
                      </div>
                      <button onClick={() => { setTab('hospitals'); setSelectedHospital(h) }} className="text-xs text-blue-500 hover:text-blue-700">상세 →</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 미배정 환자 */}
            {getUnassignedPatients().length > 0 && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-3 border-b"><h2 className="font-semibold text-orange-600">⚠️ 미배정 환자 ({getUnassignedPatients().length})</h2></div>
                <div className="divide-y">
                  {getUnassignedPatients().map(p => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                      <button onClick={() => openMemberDetail(p)} className="text-left">
                        <p className="font-medium text-gray-900 text-sm hover:text-blue-600">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.email}</p>
                      </button>
                      <button onClick={() => { setAssignPatientId(p.id); setShowAssignModal(true) }} className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600">배정</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 오늘의 활동 피드 */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-3 border-b"><h2 className="font-semibold text-gray-900">📋 오늘의 활동 피드</h2></div>
              {(() => {
                const exerciseActivities = activities.filter(a => a.type === 'exercise')
                const userMap: Record<string, { userName: string; userId: string; exercises: string[]; count: number }> = {}
                exerciseActivities.forEach(act => {
                  if (!userMap[act.userId]) userMap[act.userId] = { userName: act.userName, userId: act.userId, exercises: [], count: 0 }
                  userMap[act.userId].exercises.push(act.detail); userMap[act.userId].count++
                })
                const userList = Object.values(userMap)
                if (userList.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">오늘 운동 기록이 없습니다</div>
                return (
                  <div className="divide-y">
                    {userList.map(u => (
                      <button key={u.userId} onClick={() => { const member = allUsers.find(x => x.id === u.userId); if (member) openMemberDetail(member) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3">
                        <span className="text-lg">💪</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate"><span className="font-medium text-gray-900">{u.userName}</span><span className="text-gray-500"> · {u.exercises.join(', ')}</span></p>
                        </div>
                        <span className="text-xs text-blue-500 shrink-0">{u.count}회</span>
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>
          </>
        )}

        {/* ====== 트레이너 탭 ====== */}
        {tab === 'trainers' && !selectedTrainer && (
          <>
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-3 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">트레이너 목록</h2>
                <button onClick={() => setShowAddTrainer(!showAddTrainer)} className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">+ 추가</button>
              </div>

              {showAddTrainer && (
                <div className="p-3 bg-blue-50 border-b">
                  <p className="text-xs text-gray-600 mb-2">기존 유저 이메일로 트레이너 등록 (기본: 어깨케어 소속)</p>
                  <div className="flex gap-2">
                    <input type="email" value={newTrainerEmail} onChange={(e) => setNewTrainerEmail(e.target.value)} placeholder="이메일 입력" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <button onClick={handleAddTrainer} disabled={addingTrainer} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:bg-blue-300">등록</button>
                  </div>
                  {addMessage && <p className="text-sm mt-2 text-gray-700">{addMessage}</p>}
                </div>
              )}

              <div className="divide-y">
                {trainers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">등록된 트레이너 없음</div>
                ) : trainers.map(t => (
                  <div key={t.id} className="p-3 flex items-center justify-between">
                    <button onClick={() => setSelectedTrainer(t)} className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          t.trainer_affiliation === 'shouldercare' || !t.trainer_affiliation
                            ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {getTrainerAffiliationLabel(t)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{t.email}</p>
                      <p className="text-xs text-blue-500 mt-0.5">담당 {getAssignedCount(t.id)}명</p>
                    </button>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setAffiliationTrainer(t); setAffiliationValue(t.trainer_affiliation || 'shouldercare'); setShowAffiliationModal(true) }}
                        className="text-xs bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200">소속</button>
                      <button onClick={() => router.push(`/messages/${t.id}`)} className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100">💬</button>
                      <button onClick={() => setSelectedTrainer(t)} className="text-xs bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200">배정</button>
                      <button onClick={() => handleRemoveTrainer(t)} className="text-xs text-red-500 px-2 py-1.5 hover:bg-red-50 rounded-lg">해제</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 트레이너 상세 */}
        {tab === 'trainers' && selectedTrainer && (
          <>
            <button onClick={() => setSelectedTrainer(null)} className="text-sm text-blue-500 mb-2">← 트레이너 목록</button>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-xl">👨‍⚕️</span></div>
                <div>
                  <p className="font-bold text-gray-900">{selectedTrainer.name}</p>
                  <p className="text-xs text-gray-500">{selectedTrainer.email}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    selectedTrainer.trainer_affiliation === 'shouldercare' || !selectedTrainer.trainer_affiliation
                      ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>{getTrainerAffiliationLabel(selectedTrainer)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-3 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">담당 환자 ({getAssignedPatients(selectedTrainer.id).length}명)</h2>
                <button onClick={() => { setAssignTrainerId(selectedTrainer.id); setShowAssignModal(true) }} className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">+ 환자 배정</button>
              </div>
              <div className="divide-y">
                {getAssignedPatients(selectedTrainer.id).length === 0 ? (
                  <div className="p-8 text-center text-gray-400">배정된 환자 없음</div>
                ) : getAssignedPatients(selectedTrainer.id).map(p => {
                  const assignment = assignments.find(a => a.patient_id === p.id && a.trainer_id === selectedTrainer.id)
                  return (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <button onClick={() => openMemberDetail(p)} className="text-left">
                        <p className="font-medium text-gray-900 text-sm hover:text-blue-600">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.email}</p>
                        {assignment && <p className="text-xs text-gray-400 mt-0.5">{formatDate(assignment.assigned_at)} 배정</p>}
                      </button>
                      <button onClick={() => assignment && handleUnassign(assignment.id)} className="text-sm text-red-500 px-3 py-1.5 hover:bg-red-50 rounded-lg">해제</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ====== 병원 관리 탭 ====== */}
        {tab === 'hospitals' && !selectedHospital && (
          <>
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-3 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">🏥 계약 병원 목록</h2>
                <button onClick={() => setShowAddHospital(!showAddHospital)} className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">+ 병원 등록</button>
              </div>

              {showAddHospital && (
                <div className="p-4 bg-blue-50 border-b space-y-3">
                  <p className="text-sm font-semibold text-gray-800">새 병원 등록</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={hospitalForm.name} onChange={e => setHospitalForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="병원명 *" className="border rounded-lg px-3 py-2 text-sm" />
                    <input value={hospitalForm.prefix} onChange={e => setHospitalForm(f => ({ ...f, prefix: e.target.value.toUpperCase().slice(0, 3) }))}
                      placeholder="프리픽스 3자리 *" maxLength={3} className="border rounded-lg px-3 py-2 text-sm uppercase" />
                    <input value={hospitalForm.business_number} onChange={e => setHospitalForm(f => ({ ...f, business_number: e.target.value }))}
                      placeholder="사업자등록번호" className="border rounded-lg px-3 py-2 text-sm" />
                    <select value={hospitalForm.plan_type} onChange={e => setHospitalForm(f => ({ ...f, plan_type: e.target.value }))}
                      className="border rounded-lg px-3 py-2 text-sm">
                      <option value="basic">베이직 (₩10만)</option>
                      <option value="premium">프리미엄 (₩50만)</option>
                    </select>
                    <input value={hospitalForm.phone} onChange={e => setHospitalForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="대표 전화번호" className="border rounded-lg px-3 py-2 text-sm" />
                    <input value={hospitalForm.address} onChange={e => setHospitalForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="주소" className="border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-600 mb-2">🔐 병원관리자 계정</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={hospitalForm.admin_email} onChange={e => setHospitalForm(f => ({ ...f, admin_email: e.target.value }))}
                        placeholder="관리자 이메일 *" type="email" className="border rounded-lg px-3 py-2 text-sm" />
                      <input value={hospitalForm.admin_password} onChange={e => setHospitalForm(f => ({ ...f, admin_password: e.target.value }))}
                        placeholder="관리자 비밀번호 *" type="password" className="border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddHospital} disabled={addingHospital}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600 disabled:bg-blue-300">
                      {addingHospital ? '등록 중...' : '병원 등록'}
                    </button>
                    <button onClick={() => setShowAddHospital(false)} className="px-4 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">취소</button>
                  </div>
                  {hospitalMessage && <p className="text-sm text-gray-700">{hospitalMessage}</p>}
                </div>
              )}

              <div className="divide-y">
                {hospitals.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">등록된 병원 없음</div>
                ) : hospitals.map(h => (
                  <button key={h.id} onClick={() => setSelectedHospital(h)} className="w-full text-left p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{h.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            h.contract_status === 'active' ? 'bg-green-100 text-green-700' :
                            h.contract_status === 'expired' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>{h.contract_status === 'active' ? '계약중' : h.contract_status === 'expired' ? '만료' : '해지'}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {h.prefix} · {h.plan_type === 'premium' ? '프리미엄 ₩50만' : '베이직 ₩10만'}
                          {h.admin_email && ` · ${h.admin_email}`}
                        </p>
                      </div>
                      <span className="text-gray-400 text-sm">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 병원 상세 */}
        {tab === 'hospitals' && selectedHospital && (
          <>
            <button onClick={() => setSelectedHospital(null)} className="text-sm text-blue-500 mb-2">← 병원 목록</button>

            {/* 병원 정보 카드 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-xl">🏥</span></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{selectedHospital.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      selectedHospital.contract_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{selectedHospital.contract_status === 'active' ? '계약중' : '해지'}</span>
                  </div>
                  <p className="text-xs text-gray-500">{selectedHospital.prefix} · {selectedHospital.plan_type === 'premium' ? '프리미엄' : '베이직'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                {selectedHospital.business_number && <div className="flex justify-between"><span className="text-gray-500">사업자번호</span><span>{selectedHospital.business_number}</span></div>}
                {selectedHospital.phone && <div className="flex justify-between"><span className="text-gray-500">전화번호</span><span>{selectedHospital.phone}</span></div>}
                {selectedHospital.address && <div className="flex justify-between"><span className="text-gray-500">주소</span><span>{selectedHospital.address}</span></div>}
                {selectedHospital.admin_email && <div className="flex justify-between"><span className="text-gray-500">관리자 이메일</span><span>{selectedHospital.admin_email}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">계약 시작</span><span>{formatDate(selectedHospital.contract_start)}</span></div>
              </div>
              <div className="flex gap-2 mt-3">
                {selectedHospital.contract_status === 'active' ? (
                  <button onClick={() => handleContractChange(selectedHospital.id, 'cancelled')} className="text-xs text-red-500 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">계약 해지</button>
                ) : (
                  <button onClick={() => handleContractChange(selectedHospital.id, 'active')} className="text-xs text-green-600 px-3 py-1.5 border border-green-200 rounded-lg hover:bg-green-50">계약 재활성</button>
                )}
              </div>
            </div>

            {/* 소속 트레이너 */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-3 border-b">
                <h2 className="font-semibold text-gray-900">👨‍⚕️ 소속 트레이너 ({getHospitalTrainers(selectedHospital.id).length}명)</h2>
              </div>
              <div className="divide-y">
                {getHospitalTrainers(selectedHospital.id).length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    <p>소속 트레이너가 없습니다</p>
                    <p className="text-xs mt-1">트레이너 탭에서 소속을 변경해주세요</p>
                  </div>
                ) : getHospitalTrainers(selectedHospital.id).map(t => (
                  <div key={t.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500">담당 {getAssignedCount(t.id)}명</p>
                    </div>
                    <button onClick={() => router.push(`/messages/${t.id}`)} className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg">💬</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </main>

      {/* 회원 상세 모달 */}
      {showMemberModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">회원 정보</h3>
              <button onClick={() => { setShowMemberModal(false); setSelectedMember(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-2xl">👤</span></div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedMember.name}</p>
                  <p className="text-sm text-gray-500">{selectedMember.email}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm items-center"><span className="text-gray-500">역할</span><select value={selectedMember.role || "patient"} onChange={async (e) => { const newRole = e.target.value; await supabase.from("users").update({ role: newRole }).eq("id", selectedMember.id); setSelectedMember({...selectedMember, role: newRole}); fetchAll(); }} className="text-sm font-medium border rounded px-2 py-1"><option value="patient">환자</option><option value="trainer">트레이너</option><option value="admin">관리자</option></select></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">구독</span><span className="font-medium">{
                  selectedMember.subscription_type === 'PREMIUM' ? '프리미엄' :
                  selectedMember.subscription_type === 'PLATINUM_PATIENT' ? '플래티넘' :
                  selectedMember.subscription_type === 'TRIAL' ? '무료 체험' : '무료'
                }</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">가입일</span><span className="font-medium">{selectedMember.created_at ? formatDate(selectedMember.created_at) : '-'}</span></div>
                {selectedMember.rehab_goal && <div className="flex justify-between text-sm"><span className="text-gray-500">재활 목표</span><span className="font-medium">{selectedMember.rehab_goal}</span></div>}
                {selectedMember.pain_level_initial !== undefined && selectedMember.pain_level_initial !== null && (
                  <div className="flex justify-between text-sm"><span className="text-gray-500">초기 통증</span><span className="font-medium">{selectedMember.pain_level_initial}/10</span></div>
                )}
              </div>
              {selectedMember.role !== 'trainer' && selectedMember.role !== 'admin' && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-500 mb-1">담당 트레이너</p>
                  {(() => {
                    const a = assignments.find(x => x.patient_id === selectedMember.id)
                    if (!a) return <p className="text-sm text-orange-500">미배정</p>
                    const t = trainers.find(x => x.id === a.trainer_id)
                    return <p className="text-sm font-medium">{t?.name || '알 수 없음'}</p>
                  })()}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => router.push(`/messages/${selectedMember.id}`)} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600">💬 메시지</button>
                <button onClick={() => { setShowMemberModal(false); setSelectedMember(null) }} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 환자 배정 모달 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">환자 배정</h3>
              <button onClick={() => { setShowAssignModal(false); setAssignTrainerId(''); setAssignPatientId('') }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">트레이너</label>
                <select value={assignTrainerId} onChange={(e) => setAssignTrainerId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">선택</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name} ({getTrainerAffiliationLabel(t)})</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">환자</label>
                {assignPatientId ? (
                  <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50">
                    {patients.find(p => p.id === assignPatientId)?.name || ''}
                    <button onClick={() => setAssignPatientId('')} className="ml-2 text-red-500 text-xs">변경</button>
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {patients.map(p => {
                      const isAssigned = assignTrainerId && assignments.some(a => a.patient_id === p.id && a.trainer_id === assignTrainerId)
                      return (
                        <button key={p.id} onClick={() => !isAssigned && setAssignPatientId(p.id)} disabled={!!isAssigned}
                          className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${isAssigned ? 'bg-gray-100 text-gray-400' : 'hover:bg-blue-50'}`}>
                          {p.name}{isAssigned && <span className="text-xs ml-2">(배정됨)</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <button onClick={handleAssign} disabled={!assignTrainerId || !assignPatientId || assigning}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-blue-300">
                {assigning ? '배정 중...' : '배정하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 트레이너 소속 변경 모달 */}
      {showAffiliationModal && affiliationTrainer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">트레이너 소속 변경</h3>
              <button onClick={() => { setShowAffiliationModal(false); setAffiliationTrainer(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-700">{affiliationTrainer.name}님의 소속:</p>
              <select value={affiliationValue} onChange={e => setAffiliationValue(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="shouldercare">어깨케어 (자사)</option>
                {hospitals.filter(h => h.contract_status === 'active').map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.prefix})</option>
                ))}
              </select>
              <button onClick={handleChangeAffiliation} className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600">변경</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
