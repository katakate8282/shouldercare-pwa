'use client'

import { fetchAuthMe, fetchWithAuth } from '@/lib/fetch-auth'
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
  created_at?: string
  updated_at?: string
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

interface PainLog {
  id: string
  user_id: string
  pain_level: number
  pain_areas: string[]
  notes: string
  logged_at: string
}

interface ExerciseLog {
  id: string
  user_id: string
  exercise_id: string
  sets_completed: number
  reps_completed: number
  completed_at: string
}

interface TrainerNote {
  id: string
  patient_id: string
  trainer_id: string
  content: string
  is_public: boolean
  created_at: string
}

interface DashboardStats {
  totalPatients: number
  activePatients: number
  todayExerciseCompleted: number
  painAlerts: { patientId: string; patientName: string; painLevel: number; loggedAt: string }[]
}

interface PatientDetail {
  recentPainLogs: PainLog[]
  recentExerciseLogs: ExerciseLog[]
  prescriptions: Prescription[]
  trainerNotes: TrainerNote[]
  weekExerciseCount: number
  monthExerciseCount: number
  weekExerciseDays: number
  monthExerciseDays: number
}

interface ExerciseItem {
  id: number
  name_ko: string
  name_en: string
  category: string
  difficulty: string
  default_sets: number
  default_reps: number
  default_hold_seconds: number | null
  equipment: string | null
  target_area: string | null
  description: string | null
  video_filename: string | null
}

interface PatientVideo {
  id: string
  title: string
  description: string | null
  video_url: string | null
  status: 'uploaded' | 'reviewed' | 'archived'
  trainer_feedback: string | null
  feedback_at: string | null
  file_size_bytes: number | null
  created_at: string
}

// 한국 시간 기준 오늘 시작 (UTC)
function getKSTTodayStartUTC(): string {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const kstDateStr = kstNow.toISOString().split('T')[0]
  return new Date(kstDateStr + 'T00:00:00+09:00').toISOString()
}

// 한국 시간 기준 오늘 날짜 문자열 (YYYY-MM-DD)
function getKSTDateString(): string {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  return kstNow.toISOString().split('T')[0]
}

export default function TrainerPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [currentPrescriptions, setCurrentPrescriptions] = useState<Prescription[]>([])
  const [patientSearchQuery, setPatientSearchQuery] = useState('')
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('전체')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null)
  const [prescriptionForm, setPrescriptionForm] = useState({
    sets: 3,
    reps: 12,
    frequency_per_week: 5,
    rest_seconds: 60,
    resistance: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // DB에서 가져온 운동 라이브러리
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseItem[]>([])
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(false)

  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalPatients: 0,
    activePatients: 0,
    todayExerciseCompleted: 0,
    painAlerts: [],
  })
  const [patientSortBy, setPatientSortBy] = useState<'name' | 'recent' | 'alert'>('name')
  const [viewMode, setViewMode] = useState<'list' | 'prescribe' | 'detail'>('list')
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [patientLastActivity, setPatientLastActivity] = useState<Record<string, string>>({})
  const [patientAlertStatus, setPatientAlertStatus] = useState<Record<string, boolean>>({})

  const [newNote, setNewNote] = useState('')
  const [newNoteIsPublic, setNewNoteIsPublic] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  // 환자 영상 관련 state
  const [patientVideos, setPatientVideos] = useState<PatientVideo[]>([])
  const [patientVideosLoading, setPatientVideosLoading] = useState(false)
  const [feedbackVideoId, setFeedbackVideoId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchPatients(data.user.id)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  // 읽지 않은 전체 메시지 수
  useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null)
      setTotalUnread(count || 0)
    }
    fetchUnread()

    const channel = supabase
      .channel(`trainer-unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          setTotalUnread(prev => prev + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // DB에서 운동 라이브러리 로드
  const fetchExerciseLibrary = async () => {
    setExerciseLibraryLoading(true)
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name_ko, name_en, category, difficulty, default_sets, default_reps, default_hold_seconds, equipment, target_area, description, video_filename')
      .order('category')
      .order('name_ko')

    if (!error && data) {
      setExerciseLibrary(data)
    }
    setExerciseLibraryLoading(false)
  }

  const fetchPatients = async (trainerId?: string) => {
    let patientIds: string[] = []

    if (trainerId) {
      const { data: assignData } = await supabase
        .from('patient_assignments')
        .select('patient_id')
        .eq('trainer_id', trainerId)

      if (assignData && assignData.length > 0) {
        patientIds = assignData.map(a => a.patient_id)
      }
    }

    if (patientIds.length === 0) {
      const { count } = await supabase
        .from('patient_assignments')
        .select('*', { count: 'exact', head: true })

      if (count && count > 0) {
        setPatients([])
        fetchDashboardStats([])
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, onboarding_completed, rehab_goal, pain_level_initial, created_at, updated_at')
        .not('role', 'in', '("trainer","admin")')
        .order('name')

      if (!error && data) {
        setPatients(data)
        fetchDashboardStats(data)
      }
      return
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, onboarding_completed, rehab_goal, pain_level_initial, created_at, updated_at')
      .in('id', patientIds)
      .order('name')

    if (!error && data) {
      setPatients(data)
      fetchDashboardStats(data)
    }
  }

  const fetchDashboardStats = async (patientList: Patient[]) => {
    const kstTodayUTC = getKSTTodayStartUTC()
    const kstDateStr = getKSTDateString()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: todayLogs } = await supabase
      .from('exercise_logs')
      .select('user_id')
      .gte('completed_at', kstTodayUTC)

    const todayUniqueUsers = new Set(todayLogs?.map(l => l.user_id) || [])

    const { data: weekLogs } = await supabase
      .from('exercise_logs')
      .select('user_id, completed_at')
      .gte('completed_at', weekAgo.toISOString())

    const activeUsers = new Set(weekLogs?.map(l => l.user_id) || [])

    const lastActivityMap: Record<string, string> = {}
    weekLogs?.forEach(log => {
      if (!lastActivityMap[log.user_id] || log.completed_at > lastActivityMap[log.user_id]) {
        lastActivityMap[log.user_id] = log.completed_at
      }
    })
    setPatientLastActivity(lastActivityMap)

    const { data: painLogs } = await supabase
      .from('pain_logs')
      .select('user_id, pain_level, logged_at')
      .not('user_id', 'is', null)
      .gte('logged_at', kstTodayUTC)
      .gte('pain_level', 8)
      .order('logged_at', { ascending: false })

    const { data: dismissals } = await supabase
      .from('alert_dismissals')
      .select('patient_id, dismissed_at')
      .eq('alert_type', 'pain_spike')
      .eq('alert_date', kstDateStr)

    const dismissedMap: Record<string, string> = {}
    ;(dismissals || []).forEach(d => {
      dismissedMap[d.patient_id] = d.dismissed_at
    })

    const alertMap: Record<string, boolean> = {}
    const seenPatients = new Set<string>()
    const painAlerts = (painLogs || [])
      .filter(log => {
        if (!log.user_id) return false
        if (dismissedMap[log.user_id]) {
          if (new Date(log.logged_at) <= new Date(dismissedMap[log.user_id])) return false
        }
        if (seenPatients.has(log.user_id)) return false
        seenPatients.add(log.user_id)
        return true
      })
      .map(log => {
        const patient = patientList.find(p => p.id === log.user_id)
        if (patient) alertMap[log.user_id] = true
        return {
          patientId: log.user_id,
          patientName: patient?.name || '알 수 없음',
          painLevel: log.pain_level,
          loggedAt: log.logged_at,
        }
      })
      .filter(alert => alert.patientName !== '알 수 없음')

    setPatientAlertStatus(alertMap)

    setDashboardStats({
      totalPatients: patientList.length,
      activePatients: activeUsers.size,
      todayExerciseCompleted: todayUniqueUsers.size,
      painAlerts,
    })
  }

  const dismissAlert = async (patientId: string) => {
    if (!user) return
    const kstDateStr = getKSTDateString()

    await supabase.from('alert_dismissals').upsert({
      patient_id: patientId,
      trainer_id: user.id,
      alert_type: 'pain_spike',
      alert_date: kstDateStr,
    }, { onConflict: 'patient_id,alert_type,alert_date' })

    setPatientAlertStatus(prev => {
      const next = { ...prev }
      delete next[patientId]
      return next
    })
    setDashboardStats(prev => ({
      ...prev,
      painAlerts: prev.painAlerts.filter(a => a.patientId !== patientId),
    }))
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

  const fetchPatientDetail = async (patient: Patient) => {
    setDetailLoading(true)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const { data: painLogs } = await supabase
      .from('pain_logs')
      .select('*')
      .eq('user_id', patient.id)
      .gte('logged_at', twoWeeksAgo.toISOString())
      .order('logged_at', { ascending: true })

    const { data: exerciseLogs } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', patient.id)
      .gte('completed_at', monthAgo.toISOString())
      .order('completed_at', { ascending: false })

    const { data: prescriptions } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('status', 'active')
      .order('prescribed_at', { ascending: false })

    const { data: notes } = await supabase
      .from('trainer_notes')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const weekLogs = (exerciseLogs || []).filter(l => new Date(l.completed_at) >= weekAgo)
    const weekDays = new Set(weekLogs.map(l => new Date(l.completed_at).toDateString())).size
    const monthDays = new Set((exerciseLogs || []).map(l => new Date(l.completed_at).toDateString())).size

    setPatientDetail({
      recentPainLogs: painLogs || [],
      recentExerciseLogs: exerciseLogs || [],
      prescriptions: prescriptions || [],
      trainerNotes: notes || [],
      weekExerciseCount: weekLogs.length,
      monthExerciseCount: (exerciseLogs || []).length,
      weekExerciseDays: weekDays,
      monthExerciseDays: monthDays,
    })

    setCurrentPrescriptions(prescriptions || [])
    setDetailLoading(false)
  }

  // 환자 영상 목록 조회
  const fetchPatientVideos = async (patientId: string) => {
    setPatientVideosLoading(true)
    try {
      const res = await fetchWithAuth('/api/video-upload?patient_id=' + patientId)
      const data = await res.json()
      if (data.videos) setPatientVideos(data.videos)
    } catch (err) {
      console.error('Failed to fetch patient videos:', err)
    }
    setPatientVideosLoading(false)
  }

  // 트레이너 피드백 저장
  const handleSaveFeedback = async () => {
    if (!feedbackVideoId || !feedbackText.trim()) return
    setSavingFeedback(true)

    try {
      const res = await fetchWithAuth('/api/video-upload', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: feedbackVideoId, feedback: feedbackText.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedbackVideoId(null)
        setFeedbackText('')
        if (selectedPatient) fetchPatientVideos(selectedPatient.id)
      } else {
        alert(data.error || '피드백 저장 실패')
      }
    } catch (err) {
      alert('피드백 저장 중 오류')
    }
    setSavingFeedback(false)
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setViewMode('detail')
    fetchPatientDetail(patient)
    fetchPatientVideos(patient.id)
  }

  const handleGoToPrescribe = () => {
    setViewMode('prescribe')
    if (exerciseLibrary.length === 0) {
      fetchExerciseLibrary()
    }
  }

  const handleAddExercise = (exercise: ExerciseItem) => {
    setSelectedExercise(exercise)
    setPrescriptionForm({
      sets: exercise.default_sets || 3,
      reps: exercise.default_reps || 12,
      frequency_per_week: 5,
      rest_seconds: 60,
      resistance: '',
      notes: exercise.default_hold_seconds ? `유지 시간: ${exercise.default_hold_seconds}초` : '',
    })
    setShowAddModal(true)
  }

  const handlePrescribe = async () => {
    if (!selectedPatient || !selectedExercise || !user) return
    setSaving(true)

    const { error } = await supabase.from('prescriptions').insert({
      patient_id: selectedPatient.id,
      trainer_id: user.id,
      exercise_id: String(selectedExercise.id),
      exercise_name: selectedExercise.name_ko,
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
      await dismissAlert(selectedPatient.id)
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

  const handleSaveNote = async () => {
    if (!selectedPatient || !user || !newNote.trim()) return
    setSavingNote(true)

    const { error } = await supabase.from('trainer_notes').insert({
      patient_id: selectedPatient.id,
      trainer_id: user.id,
      content: newNote.trim(),
      is_public: newNoteIsPublic,
    })

    if (!error) {
      setNewNote('')
      setNewNoteIsPublic(false)
      fetchPatientDetail(selectedPatient)
      await dismissAlert(selectedPatient.id)
    }
    setSavingNote(false)
  }

  const categories = ['전체', ...Array.from(new Set(exerciseLibrary.map(e => e.category))).sort()]

  const filteredExercises = exerciseLibrary.filter(e => {
    const matchSearch = exerciseSearchQuery === '' ||
      e.name_ko.replace(/\s/g, '').includes(exerciseSearchQuery.replace(/\s/g, '')) ||
      e.name_en.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
    const matchCategory = categoryFilter === '전체' || e.category === categoryFilter
    return matchSearch && matchCategory
  })

  const getSortedPatients = () => {
    let filtered = patients.filter(p =>
      p.name.includes(patientSearchQuery) || p.email.includes(patientSearchQuery)
    )

    if (patientSortBy === 'recent') {
      filtered.sort((a, b) => {
        const aTime = patientLastActivity[a.id] || a.updated_at || ''
        const bTime = patientLastActivity[b.id] || b.updated_at || ''
        return bTime.localeCompare(aTime)
      })
    } else if (patientSortBy === 'alert') {
      filtered.sort((a, b) => {
        const aAlert = patientAlertStatus[a.id] ? 1 : 0
        const bAlert = patientAlertStatus[b.id] ? 1 : 0
        return bAlert - aAlert
      })
    }

    return filtered
  }

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}시간 전`
    const days = Math.floor(hours / 24)
    return `${days}일 전`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case '매우 낮음': return 'bg-green-100 text-green-700'
      case '낮음': return 'bg-blue-100 text-blue-700'
      case '중간': return 'bg-yellow-100 text-yellow-700'
      case '중상': return 'bg-orange-100 text-orange-700'
      case '높음': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  // ===== 환자 목록 (메인 대시보드) =====
  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">트레이너 대시보드</h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/messages')}
                  className="relative text-gray-600 hover:text-gray-900"
                >
                  <span className="text-2xl">💬</span>
                  {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </button>
                <button onClick={() => router.push('/dashboard')} className="text-sm text-blue-500">홈으로</button>
                <button onClick={() => router.push("/trainer-manual")} className="text-sm text-orange-500 font-medium">📋 매뉴얼</button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {/* 오늘의 현황 */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <h2 className="text-sm font-medium text-blue-100 mb-3">📊 오늘의 현황</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/20 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold">{dashboardStats.totalPatients}</p>
                <p className="text-xs text-blue-100">전체 환자</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold">{dashboardStats.activePatients}</p>
                <p className="text-xs text-blue-100">활동 중</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold">{dashboardStats.todayExerciseCompleted}</p>
                <p className="text-xs text-blue-100">오늘 운동 완료</p>
              </div>
            </div>
          </div>

          {/* 알림 */}
          {dashboardStats.painAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-2">🔔 알림 ({dashboardStats.painAlerts.length}건)</h3>
              <div className="space-y-2">
                {dashboardStats.painAlerts.map((alert, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const p = patients.find(pt => pt.id === alert.patientId)
                      if (p) handleSelectPatient(p)
                    }}
                    className="w-full text-left bg-white rounded-lg p-3 border border-red-100 hover:border-red-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-red-700">
                          ⚠️ {alert.patientName} 환자 통증 급증 ({alert.painLevel}/10)
                        </p>
                        <p className="text-xs text-red-500">{getTimeAgo(alert.loggedAt)}</p>
                      </div>
                      <span className="text-xs text-red-500">즉시 확인 →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 환자 목록 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-3">👤 환자 목록</h2>
            <input
              type="text"
              placeholder="환자 검색..."
              value={patientSearchQuery}
              onChange={(e) => setPatientSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div className="flex gap-2 mb-3">
              {[
                { key: 'name' as const, label: '이름순' },
                { key: 'recent' as const, label: '최근 활동순' },
                { key: 'alert' as const, label: '알림 있음' },
              ].map(sort => (
                <button
                  key={sort.key}
                  onClick={() => setPatientSortBy(sort.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    patientSortBy === sort.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {sort.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {getSortedPatients().map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {patientAlertStatus[patient.id] && (
                      <span className="text-red-500 text-lg">⚠️</span>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.email}</p>
                      {patientLastActivity[patient.id] && (
                        <p className="text-xs text-gray-400">
                          마지막 활동: {getTimeAgo(patientLastActivity[patient.id])}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {patient.onboarding_completed && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">온보딩 완료</span>
                    )}
                    {patient.rehab_goal && (
                      <p className="text-xs text-gray-400 mt-1">
                        {patient.rehab_goal === 'daily_life' ? '일상복귀' :
                         patient.rehab_goal === 'sports_return' ? '스포츠복귀' :
                         patient.rehab_goal === 'work_return' ? '업무복귀' :
                         patient.rehab_goal === 'specific_activity' ? '특정활동' : patient.rehab_goal}
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

  // ===== 환자 상세 화면 =====
  if (viewMode === 'detail') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedPatient(null); setViewMode('list'); setPatientVideos([]) }} className="text-gray-600">
                  <span className="text-2xl">←</span>
                </button>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{selectedPatient.name}님</h1>
                  <p className="text-xs text-gray-500">환자 상세</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/messages/${selectedPatient.id}`)}
                  className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition"
                >
                  💬 메시지
                </button>
                <button
                  onClick={handleGoToPrescribe}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                >
                  운동 제안
                </button>
              </div>
            </div>
          </div>
        </header>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500">로딩중...</div>
          </div>
        ) : patientDetail ? (
          <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
            {patientAlertStatus[selectedPatient.id] && (
              <button
                onClick={async () => {
                  await dismissAlert(selectedPatient.id)
                  setSelectedPatient(null)
                  setViewMode('list')
                }}
                className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold text-sm hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                ✅ 확인 완료 → 목록으로 돌아가기
              </button>
            )}

            {/* 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">📊 재활 현황</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">이메일</span>
                  <span className="text-gray-900">{selectedPatient.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">재활 목표</span>
                  <span className="text-gray-900">
                    {selectedPatient.rehab_goal === 'daily_life' ? '일상복귀' :
                     selectedPatient.rehab_goal === 'sports_return' ? '스포츠복귀' :
                     selectedPatient.rehab_goal === 'work_return' ? '업무복귀' :
                     selectedPatient.rehab_goal === 'specific_activity' ? '특정활동' :
                     selectedPatient.rehab_goal || '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">초기 통증</span>
                  <span className="text-gray-900">{selectedPatient.pain_level_initial ?? '-'}/10</span>
                </div>
                {selectedPatient.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">등록일</span>
                    <span className="text-gray-900">{new Date(selectedPatient.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 운동 현황 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">💪 운동 현황</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{patientDetail.weekExerciseDays}일</p>
                  <p className="text-xs text-gray-600">이번 주 운동일</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{patientDetail.weekExerciseCount}회</p>
                  <p className="text-xs text-gray-600">이번 주 운동 횟수</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{patientDetail.monthExerciseDays}일</p>
                  <p className="text-xs text-gray-600">이번 달 운동일</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{patientDetail.monthExerciseCount}회</p>
                  <p className="text-xs text-gray-600">이번 달 운동 횟수</p>
                </div>
              </div>
            </div>

            {/* 통증 추이 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">📊 통증 추이 (최근 2주)</h3>
              {patientDetail.recentPainLogs.length === 0 ? (
                <p className="text-center text-gray-400 py-4 text-sm">통증 기록이 없습니다</p>
              ) : (
                <div>
                  <div className="space-y-1.5">
                    {patientDetail.recentPainLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">
                          {new Date(log.logged_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              log.pain_level >= 8 ? 'bg-red-500' :
                              log.pain_level >= 5 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${log.pain_level * 10}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold w-8 text-right ${
                          log.pain_level >= 8 ? 'text-red-500' :
                          log.pain_level >= 5 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {log.pain_level}
                        </span>
                      </div>
                    ))}
                  </div>
                  {patientDetail.recentPainLogs.length >= 2 && (
                    <div className="mt-3 text-sm text-gray-600">
                      {(() => {
                        const first = patientDetail.recentPainLogs[0].pain_level
                        const last = patientDetail.recentPainLogs[patientDetail.recentPainLogs.length - 1].pain_level
                        const diff = last - first
                        if (diff < 0) return `📉 통증 감소 추세 (${first} → ${last})`
                        if (diff > 0) return `📈 통증 증가 추세 (${first} → ${last}) ⚠️`
                        return `➡️ 통증 유지 (${first})`
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 환자 운동 영상 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">🎥 환자 운동 영상</h3>
                <span className="text-sm text-gray-500">{patientVideos.length}개</span>
              </div>

              {patientVideosLoading ? (
                <p className="text-center text-gray-400 py-4 text-sm">불러오는 중...</p>
              ) : patientVideos.length === 0 ? (
                <p className="text-center text-gray-400 py-4 text-sm">업로드된 영상이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {patientVideos.map((video) => (
                    <div key={video.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-sm text-gray-900">{video.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              video.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {video.status === 'reviewed' ? '피드백 완료' : '검토 대기'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            {new Date(video.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {video.file_size_bytes ? ` · ${formatFileSize(video.file_size_bytes)}` : ''}
                          </p>
                          {video.description && <p className="text-xs text-gray-500 mt-1">{video.description}</p>}
                        </div>
                        {video.video_url && (
                          <button
                            onClick={() => setPlayingVideoUrl(video.video_url)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500 shrink-0 ml-2"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </button>
                        )}
                      </div>

                      {/* 기존 피드백 표시 */}
                      {video.trainer_feedback && (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 mt-2">
                          <p className="text-[11px] font-bold text-green-800 mb-0.5">내 피드백</p>
                          <p className="text-xs text-green-700">{video.trainer_feedback}</p>
                          {video.feedback_at && (
                            <p className="text-[10px] text-green-500 mt-1">{new Date(video.feedback_at).toLocaleDateString('ko-KR')}</p>
                          )}
                        </div>
                      )}

                      {/* 피드백 작성/수정 */}
                      {feedbackVideoId === video.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="자세 교정 포인트, 잘한 점, 개선할 점 등을 작성해주세요"
                            className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setFeedbackVideoId(null); setFeedbackText('') }}
                              className="flex-1 py-2 rounded-lg border text-gray-600 text-sm"
                            >
                              취소
                            </button>
                            <button
                              onClick={handleSaveFeedback}
                              disabled={savingFeedback || !feedbackText.trim()}
                              className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:bg-blue-300"
                            >
                              {savingFeedback ? '저장 중...' : '피드백 저장'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setFeedbackVideoId(video.id)
                            setFeedbackText(video.trainer_feedback || '')
                          }}
                          className="mt-2 w-full py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition"
                        >
                          {video.trainer_feedback ? '✏️ 피드백 수정' : '✍️ 피드백 작성'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 현재 운동 제안 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">📋 현재 운동 제안</h3>
                <span className="text-sm text-gray-500">{patientDetail.prescriptions.length}개</span>
              </div>
              {patientDetail.prescriptions.length === 0 ? (
                <p className="text-center text-gray-400 py-4 text-sm">등록된 운동이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {patientDetail.prescriptions.map((rx) => (
                    <div key={rx.id} className="border rounded-lg p-3">
                      <p className="font-semibold text-gray-900 text-sm">{rx.exercise_name}</p>
                      <p className="text-xs text-gray-600">{rx.sets}세트 × {rx.reps}회 · 주 {rx.frequency_per_week}회</p>
                      {rx.resistance && <p className="text-xs text-gray-400">저항: {rx.resistance}</p>}
                      {rx.notes && <p className="text-xs text-blue-500 mt-1">💬 {rx.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 트레이너 메모 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">💬 트레이너 메모</h3>

              <div className="space-y-3 mb-4">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="메모 입력..."
                  className="w-full border rounded-lg px-3 py-2 text-sm h-16 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newNoteIsPublic}
                      onChange={(e) => setNewNoteIsPublic(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      {newNoteIsPublic ? '👁 환자에게 공개' : '🔒 트레이너만 보기'}
                    </span>
                  </label>
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || !newNote.trim()}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-blue-300 transition"
                  >
                    {savingNote ? '...' : '저장'}
                  </button>
                </div>
              </div>

              {patientDetail.trainerNotes.length === 0 ? (
                <p className="text-center text-gray-400 py-4 text-sm">메모가 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {patientDetail.trainerNotes.map((note) => (
                    <div key={note.id} className={`border-l-2 pl-3 ${note.is_public ? 'border-green-400' : 'border-gray-300'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          note.is_public
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {note.is_public ? '👁 공개' : '🔒 비공개'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{note.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(note.created_at).toLocaleDateString('ko-KR')} {new Date(note.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        ) : null}

        {/* 영상 재생 모달 */}
        {playingVideoUrl && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
              <div className="flex justify-end mb-3">
                <button onClick={() => setPlayingVideoUrl(null)} className="text-white/70 text-2xl">×</button>
              </div>
              <div className="rounded-xl overflow-hidden bg-black">
                <video
                  src={playingVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== 운동 제안 화면 =====
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode('detail')} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selectedPatient.name}님</h1>
              <p className="text-xs text-gray-500">운동 제안 관리</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">📋 현재 제안 운동</h2>
            <span className="text-sm text-gray-500">{currentPrescriptions.length}개</span>
          </div>

          {currentPrescriptions.length === 0 ? (
            <p className="text-center text-gray-500 py-6">등록된 운동이 없습니다</p>
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
                      등록일: {new Date(rx.prescribed_at).toLocaleDateString('ko-KR')}
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

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">📚 운동 라이브러리 ({exerciseLibrary.length}개)</h2>

          {exerciseLibraryLoading ? (
            <p className="text-center text-gray-400 py-6">운동 목록 불러오는 중...</p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  placeholder="운동 검색 (한글/영문)..."
                  value={exerciseSearchQuery}
                  onChange={(e) => setExerciseSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-2 overflow-x-auto pb-1">
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
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredExercises.map((exercise) => {
                  const alreadyPrescribed = currentPrescriptions.some(p => p.exercise_id === String(exercise.id))

                  return (
                    <div
                      key={exercise.id}
                      className={`border rounded-lg p-3 flex flex-col justify-between ${
                        alreadyPrescribed ? 'bg-gray-50 opacity-60' : ''
                      }`}
                    >
                      <div className="mb-2">
                        <p className="font-semibold text-gray-900 text-sm">{exercise.name_ko}</p>
                        <p className="text-[11px] text-gray-500">{exercise.name_en}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyColor(exercise.difficulty)}`}>
                            {exercise.difficulty}
                          </span>
                          {exercise.equipment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {exercise.equipment}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {exercise.category} · {exercise.default_sets}세트×{exercise.default_reps}회
                          {exercise.default_hold_seconds ? ` · ${exercise.default_hold_seconds}초 유지` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddExercise(exercise)}
                        disabled={alreadyPrescribed}
                        className={`w-full py-1.5 rounded-lg text-xs font-medium transition ${
                          alreadyPrescribed
                            ? 'bg-gray-200 text-gray-400'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {alreadyPrescribed ? '제안됨' : '+ 제안'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {filteredExercises.length === 0 && (
                <p className="text-center text-gray-400 py-6 text-sm">검색 결과가 없습니다</p>
              )}
            </>
          )}
        </div>
      </main>

      {showAddModal && selectedExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">운동 세부 설정</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 text-2xl">×</button>
            </div>

            <div>
              <p className="font-semibold text-blue-600">{selectedExercise.name_ko}</p>
              <p className="text-xs text-gray-500">{selectedExercise.name_en}</p>
              {selectedExercise.description && (
                <p className="text-xs text-gray-400 mt-1">{selectedExercise.description}</p>
              )}
            </div>

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
                {saving ? '저장 중...' : '제안 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
