'use client'

import { fetchAuthMe, fetchWithAuth } from '@/lib/fetch-auth'
import { removeToken } from '@/lib/token-storage'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { checkSubscription, getSubscriptionLabel } from '@/lib/subscription'
import { usePushNotification } from '@/hooks/usePushNotification'

interface User {
  id: string
  name: string
  email: string
  subscription_type?: string
  subscription_expires_at?: string | null
  hospital_id?: string
  hospital_code?: string
  role?: string
}

interface Prescription {
  id: string
  exercise_id: string
  exercise_name: string
  sets: number
  reps: number
  frequency_per_week: number
  resistance: string
  notes: string
}

interface TrainerNote {
  id: string
  content: string
  is_public: boolean
  created_at: string
}

interface WeekTrend {
  label: string
  exercises: number
  painLogs: number
}

interface TrainerPatient {
  id: string
  name: string
  email: string
  hospital_code?: string
  diagnosis?: string
  treatment?: string
  rehab_goal?: string
  created_at?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 환자용 state
  const [todayPain, setTodayPain] = useState<number | null>(null)
  const [weekExercises, setWeekExercises] = useState(0)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [trainerNotes, setTrainerNotes] = useState<TrainerNote[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // 면책 조항 동의 상태
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  // FCM 푸시 알림 등록
  usePushNotification(user?.id ?? null)

  // 면책 조항 동의 상태
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [weekPrescribedCount, setWeekPrescribedCount] = useState(0)
  const [achievementRate, setAchievementRate] = useState(0)
  const [painChange, setPainChange] = useState<{ first: number; latest: number } | null>(null)

  // 순위 state
  const [myRank, setMyRank] = useState(0)
  const [totalRankers, setTotalRankers] = useState(0)

  // 관리자용 state
  const [totalPatients, setTotalPatients] = useState(0)
  const [totalTrainers, setTotalTrainers] = useState(0)
  const [todayExerciseUsers, setTodayExerciseUsers] = useState(0)
  const [todayPainUsers, setTodayPainUsers] = useState(0)
  const [weekTrend, setWeekTrend] = useState<WeekTrend[]>([])

  // 트레이너용 state
  const [trainerPatients, setTrainerPatients] = useState<TrainerPatient[]>([])
  const [trainerPatientActivities, setTrainerPatientActivities] = useState<{ userId: string; type: string; detail: string }[]>([])
  const [trainerWeekActivity, setTrainerWeekActivity] = useState({ prescriptions: 0, messages: 0, notes: 0 })
  const [trainerSelectedPatient, setTrainerSelectedPatient] = useState<TrainerPatient | null>(null)

  // 병원 연결 데이터
  const [hospitalInfo, setHospitalInfo] = useState<{ hospital_name: string; program_week: number | null; diagnosis: string | null; trainer_name: string | null } | null>(null)
  const [showProgramComplete, setShowProgramComplete] = useState(false)

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          if (data.user.role === 'admin') {
            fetchAdminStats()
          } else if (data.user.role === 'trainer') {
            fetchTrainerDashboard(data.user.id)
          } else {
            fetchStats(data.user.id)
            fetchPrescriptions(data.user.id)
            fetchTrainerNotes(data.user.id)
            fetchTrainerAndUnread(data.user.id)
            fetchRanking(data.user.id)
            // 병원 연결 정보 조회
            fetchWithAuth("/api/auth/link-hospital").then(r => r.json()).then(d => {
              if (d.linked && d.hospital) setHospitalInfo({ hospital_name: d.hospital.name, program_week: d.patient?.program_week || null, diagnosis: d.patient?.diagnosis || null, trainer_name: d.patient?.trainer_name || null })
            }).catch(() => {})          }
            // 12주 프로그램 종료 감지
            const sub = checkSubscription(data.user)
            if (sub.isExpired && sub.type === "PLATINUM_PATIENT") {
              const dismissed = localStorage.getItem("sc_program_complete_dismissed")
              if (!dismissed) setShowProgramComplete(true)
            }        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  // 면책 조항 팝업 (첫 실행 시)
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'trainer') {
      const agreed = localStorage.getItem('sc_disclaimer_agreed')
      if (!agreed) {
        setShowDisclaimer(true)
      }
    }
  }, [user])

  const handleDisclaimerAgree = () => {
    localStorage.setItem('sc_disclaimer_agreed', 'true')
    setShowDisclaimer(false)
  }

  // Realtime 구독 (환자/트레이너)
  useEffect(() => {
    if (!user || user.role === 'admin') return

    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // ===== 관리자용 데이터 =====
  const fetchAdminStats = async () => {
    const now = new Date()
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const kstToday = new Date(kstNow)
    kstToday.setHours(0, 0, 0, 0)
    const kstTodayUTC = new Date(kstToday.getTime() - 9 * 60 * 60 * 1000).toISOString()

    const { count: pCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('role', 'in', '("trainer","admin")')
    setTotalPatients(pCount || 0)

    const { count: tCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'trainer')
    setTotalTrainers(tCount || 0)

    const { data: todayExLogs } = await supabase
      .from('exercise_logs')
      .select('user_id')
      .gte('completed_at', kstTodayUTC)
    const exUsers = new Set(todayExLogs?.map(l => l.user_id) || [])
    setTodayExerciseUsers(exUsers.size)

    const { data: todayPnLogs } = await supabase
      .from('pain_logs')
      .select('user_id')
      .gte('logged_at', kstTodayUTC)
    const pnUsers = new Set(todayPnLogs?.map(l => l.user_id) || [])
    setTodayPainUsers(pnUsers.size)

    await fetchWeekTrend()
  }

  const fetchWeekTrend = async () => {
    const trends: WeekTrend[] = []

    for (let i = 3; i >= 0; i--) {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() - (i * 7))
      endDate.setHours(23, 59, 59, 999)

      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)

      const label = `${startDate.getMonth() + 1}/${startDate.getDate()}`

      const { data: exLogs } = await supabase
        .from('exercise_logs')
        .select('id')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())

      const { data: pnLogs } = await supabase
        .from('pain_logs')
        .select('id')
        .gte('logged_at', startDate.toISOString())
        .lte('logged_at', endDate.toISOString())

      trends.push({
        label,
        exercises: exLogs?.length || 0,
        painLogs: pnLogs?.length || 0,
      })
    }

    setWeekTrend(trends)
  }

  // ===== 트레이너용 데이터 =====
  const fetchTrainerDashboard = async (trainerId: string) => {
    const now = new Date()
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const kstToday = new Date(kstNow)
    kstToday.setHours(0, 0, 0, 0)
    const kstTodayUTC = new Date(kstToday.getTime() - 9 * 60 * 60 * 1000).toISOString()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: assignData } = await supabase
      .from('patient_assignments')
      .select('patient_id')
      .eq('trainer_id', trainerId)

    const patientIds = assignData?.map(a => a.patient_id) || []

    if (patientIds.length > 0) {
      const { data: pData } = await supabase
        .from('users')
        .select('id, name, email, hospital_code, diagnosis, treatment, rehab_goal, created_at')
        .in('id', patientIds)
        .order('name')
      setTrainerPatients(pData || [])

      const { data: exLogs } = await supabase
        .from('exercise_logs')
        .select('user_id, exercise_name, sets_completed, reps_completed')
        .in('user_id', patientIds)
        .gte('completed_at', kstTodayUTC)

      const { data: pnLogs } = await supabase
        .from('pain_logs')
        .select('user_id, pain_level')
        .in('user_id', patientIds)
        .gte('logged_at', kstTodayUTC)

      const acts: { userId: string; type: string; detail: string }[] = []
      exLogs?.forEach(l => acts.push({ userId: l.user_id, type: 'exercise', detail: `${l.exercise_name} ${l.sets_completed}세트×${l.reps_completed}회` }))
      pnLogs?.forEach(l => acts.push({ userId: l.user_id, type: 'pain', detail: `통증 ${l.pain_level}/10` }))
      setTrainerPatientActivities(acts)
    }

    const { count: rxCount } = await supabase
      .from('prescriptions')
      .select('*', { count: 'exact', head: true })
      .eq('trainer_id', trainerId)
      .gte('prescribed_at', weekAgo.toISOString())

    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', trainerId)
      .gte('created_at', weekAgo.toISOString())

    const { count: noteCount } = await supabase
      .from('trainer_notes')
      .select('*', { count: 'exact', head: true })
      .eq('trainer_id', trainerId)
      .gte('created_at', weekAgo.toISOString())

    setTrainerWeekActivity({
      prescriptions: rxCount || 0,
      messages: msgCount || 0,
      notes: noteCount || 0,
    })

    const { count: unread } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', trainerId)
      .is('read_at', null)
    setUnreadCount(unread || 0)
  }

  // ===== 환자용 데이터 =====
  const fetchStats = async (userId: string) => {
    try {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { data: exerciseData } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('completed_at', weekAgo.toISOString())

      const weekCount = exerciseData?.length || 0
      setWeekExercises(weekCount)

      const { data: rxData } = await supabase
        .from('prescriptions')
        .select('frequency_per_week')
        .eq('patient_id', userId)
        .eq('status', 'active')

      if (rxData && rxData.length > 0) {
        const totalTarget = rxData.reduce((sum, p) => sum + (p.frequency_per_week || 0), 0)
        setWeekPrescribedCount(totalTarget)
        setAchievementRate(totalTarget > 0 ? Math.min(Math.round((weekCount / totalTarget) * 100), 100) : 0)
      }

      const { data: painLogs } = await supabase
        .from('pain_logs')
        .select('pain_level, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: true })

      if (painLogs && painLogs.length >= 2) {
        setPainChange({
          first: painLogs[0].pain_level,
          latest: painLogs[painLogs.length - 1].pain_level,
        })
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: painData } = await supabase
        .from('pain_logs')
        .select('pain_level')
        .eq('user_id', userId)
        .gte('logged_at', today.toISOString())
        .order('logged_at', { ascending: false })
        .limit(1)

      if (painData && painData.length > 0) setTodayPain(painData[0].pain_level)
    } catch (error) {
      console.error('Stats fetch error:', error)
    }
  }

  const fetchPrescriptions = async (userId: string) => {
    const { data } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', userId)
      .eq('status', 'active')
      .order('prescribed_at', { ascending: true })
    if (data) setPrescriptions(data)
  }

  const fetchTrainerNotes = async (userId: string) => {
    const { data } = await supabase
      .from('trainer_notes')
      .select('id, content, is_public, created_at')
      .eq('patient_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setTrainerNotes(data)
  }

  const fetchRanking = async (userId: string) => {
    try {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { data: patients } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'patient')

      if (!patients) return

      const { data: allLogs } = await supabase
        .from('exercise_logs')
        .select('user_id')
        .gte('completed_at', weekAgo.toISOString())

      const { data: allPrescriptions } = await supabase
        .from('prescriptions')
        .select('patient_id, frequency_per_week')
        .eq('status', 'active')

      const rankList = patients.map((p: { id: string; name: string }) => {
        const exercises = (allLogs || []).filter((l: { user_id: string }) => l.user_id === p.id).length
        const pres = (allPrescriptions || []).filter((rx: { patient_id: string }) => rx.patient_id === p.id)
        const target = pres.reduce((sum: number, rx: { frequency_per_week: number }) => sum + (rx.frequency_per_week || 0), 0)
        const rate = target > 0 ? Math.min(Math.round((exercises / target) * 100), 100) : (exercises > 0 ? 100 : 0)
        return { userId: p.id, weekExercises: exercises, achievementRate: rate }
      })

      rankList.sort((a: { achievementRate: number; weekExercises: number }, b: { achievementRate: number; weekExercises: number }) => {
        if (b.achievementRate !== a.achievementRate) return b.achievementRate - a.achievementRate
        return b.weekExercises - a.weekExercises
      })

      setTotalRankers(rankList.length)
      const myIdx = rankList.findIndex((r: { userId: string }) => r.userId === userId)
      setMyRank(myIdx + 1)
    } catch (error) {
      console.error('Ranking fetch error:', error)
    }
  }
  const fetchTrainerAndUnread = async (userId: string) => {
    try {
      let tId: string | null = null

      const { data: rxData } = await supabase
        .from('prescriptions')
        .select('trainer_id')
        .eq('patient_id', userId)
        .limit(1)

      if (rxData && rxData.length > 0) {
        tId = rxData[0].trainer_id
      }

      if (!tId) {
        const { data: msgData } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('receiver_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (msgData && msgData.length > 0) {
          const { data: senderData } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', msgData[0].sender_id)
            .eq('role', 'trainer')
            .single()
          if (senderData) tId = senderData.id
        }
      }

      if (!tId) {
        const { data: trainerData } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'trainer')
          .limit(1)
        if (trainerData && trainerData.length > 0) tId = trainerData[0].id
      }

      if (tId) {
        setTrainerId(tId)
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', tId)
          .eq('receiver_id', userId)
          .is('read_at', null)
        setUnreadCount(count || 0)
      }
    } catch (error) {
      console.error('Trainer/unread fetch error:', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await removeToken()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  const subStatus = checkSubscription(user as any)
  const subscriptionLabel = getSubscriptionLabel(subStatus)

  // ===== 관리자 대시보드 =====
  if (user.role === 'admin') {
    const maxTrend = Math.max(...weekTrend.map(w => Math.max(w.exercises, w.painLogs)), 1)

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">어깨케어 관리자</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/messages')} className="relative text-gray-600">
                <span className="text-2xl">💬</span>
              </button>
              <button onClick={() => router.push('/settings')} className="text-gray-600 hover:text-gray-900">
                <span className="text-2xl">👤</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          {/* 전체 현황 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <p className="text-2xl font-bold text-blue-600">{totalPatients}</p>
              <p className="text-xs text-gray-500">전체 환자</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <p className="text-2xl font-bold text-green-600">{totalTrainers}</p>
              <p className="text-xs text-gray-500">트레이너</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <p className="text-2xl font-bold text-purple-600">{todayExerciseUsers}</p>
              <p className="text-xs text-gray-500">오늘 운동 완료</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <p className="text-2xl font-bold text-orange-600">{todayPainUsers}</p>
              <p className="text-xs text-gray-500">오늘 통증 기록</p>
            </div>
          </div>

          {/* 주간 트렌드 그래프 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-3">📈 주간 트렌드 (최근 4주)</h2>
            <div className="space-y-3">
              {weekTrend.map((week, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{week.label}~</span>
                    <span>운동 {week.exercises}건 · 통증 {week.painLogs}건</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-blue-500"
                          style={{ width: `${Math.round((week.exercises / maxTrend) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-orange-400"
                          style={{ width: `${Math.round((week.painLogs / maxTrend) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 text-xs text-gray-400 mt-1">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-full inline-block" /> 운동</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded-full inline-block" /> 통증 기록</span>
              </div>
            </div>
          </div>

          {/* 관리 메뉴 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => router.push('/admin')}
              className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <span className="text-xl mb-1.5 block">⚙️</span>
              <p className="font-semibold text-gray-900 text-sm">관리자</p>
              <p className="text-xs text-gray-600">회원·트레이너 관리</p>
            </button>
            <button
              onClick={() => router.push('/admin/reports')}
              className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <span className="text-xl mb-1.5 block">📊</span>
              <p className="font-semibold text-gray-900 text-sm">통계 리포트</p>
              <p className="text-xs text-gray-600">성과 분석·PDF</p>
            </button>
            <button
              onClick={() => router.push('/messages')}
              className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <span className="text-xl mb-1.5 block">💬</span>
              <p className="font-semibold text-gray-900 text-sm">메시지</p>
              <p className="text-xs text-gray-600">대화 목록</p>
            </button>
          </div>
        </main>

        <BottomNav role="admin" unreadCount={unreadCount} />
      </div>
    )
  }

  // ===== 트레이너 대시보드 =====
  if (user.role === 'trainer') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">어깨케어 트레이너</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/messages')} className="relative text-gray-600">
                <span className="text-2xl">💬</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => router.push('/settings')} className="text-gray-600 hover:text-gray-900">
                <span className="text-2xl">👤</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          {/* 상단 메뉴 */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => router.push('/trainer')} className="bg-blue-500 text-white rounded-lg p-3 text-center hover:bg-blue-600 transition">
              <span className="text-xl block mb-1">👨‍⚕️</span>
              <p className="font-semibold text-sm">환자 관리</p>
            </button>
            <button onClick={() => router.push('/exercises')} className="bg-green-500 text-white rounded-lg p-3 text-center hover:bg-green-600 transition">
              <span className="text-xl block mb-1">💪</span>
              <p className="font-semibold text-sm">운동 보기</p>
            </button>
            <button onClick={() => {
              const findAdmin = async () => {
                const { data } = await supabase.from('users').select('id').eq('role', 'admin').limit(1)
                if (data && data[0]) router.push(`/messages/${data[0].id}`)
                else router.push('/messages')
              }
              findAdmin()
            }} className="bg-purple-500 text-white rounded-lg p-3 text-center hover:bg-purple-600 transition">
              <span className="text-xl block mb-1">💬</span>
              <p className="font-semibold text-sm">관리자 메시지</p>
            </button>
          </div>

          {/* 이번 주 트레이너 활동 */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-4 text-white">
            <p className="text-xs opacity-80">이번 주 내 활동</p>
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="text-2xl font-bold">{trainerWeekActivity.prescriptions}건</p>
                <p className="text-xs opacity-70">운동 제안</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{trainerWeekActivity.messages}건</p>
                <p className="text-xs opacity-70">메시지</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{trainerWeekActivity.notes}건</p>
                <p className="text-xs opacity-70">메모</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{trainerPatients.length}명</p>
                <p className="text-xs opacity-70">담당 환자</p>
              </div>
            </div>
          </div>

          {/* 담당 환자 목록 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-3 border-b">
              <h2 className="font-semibold text-gray-900">🏥 담당 환자</h2>
            </div>
            {trainerPatients.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">배정된 환자가 없습니다</div>
            ) : (
              <div className="divide-y">
                {trainerPatients.map(p => (
                  <button key={p.id} onClick={() => router.push(`/trainer?patient=${p.id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                        {p.hospital_code && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{p.hospital_code}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {[p.diagnosis, p.treatment].filter(Boolean).join(' · ') || p.email}
                      </p>
                    </div>
                    <span className="text-gray-400 text-sm">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 담당 환자 오늘 활동 피드 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-3 border-b">
              <h2 className="font-semibold text-gray-900">📋 오늘의 환자 활동</h2>
            </div>
            {(() => {
              const patientIds = trainerPatients.map(p => p.id)
              const userExMap: Record<string, { exercises: string[]; count: number }> = {}
              const userPainMap: Record<string, number> = {}

              trainerPatientActivities.forEach(act => {
                if (!patientIds.includes(act.userId)) return
                if (act.type === 'exercise') {
                  if (!userExMap[act.userId]) userExMap[act.userId] = { exercises: [], count: 0 }
                  userExMap[act.userId].exercises.push(act.detail)
                  userExMap[act.userId].count++
                } else if (act.type === 'pain') {
                  const match = act.detail.match(/통증\s*(\d+)/)
                  if (match) userPainMap[act.userId] = parseInt(match[1])
                }
              })

              const activePatientIds = new Set([...Object.keys(userExMap), ...Object.keys(userPainMap)])
              if (activePatientIds.size === 0) {
                return <div className="p-8 text-center text-gray-400 text-sm">오늘 환자 활동이 없습니다</div>
              }

              return (
                <div className="divide-y">
                  {trainerPatients.map(p => {
                    const ex = userExMap[p.id]
                    const pain = userPainMap[p.id]
                    if (!ex && pain === undefined) return null
                    return (
                      <button key={p.id} onClick={() => setTrainerSelectedPatient(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3">
                        <span className="text-lg">{ex ? '💪' : '😣'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            <span className="font-medium text-gray-900">{p.name}</span>
                            <span className="text-gray-500">
                              {ex ? ` · ${ex.exercises.join(', ')}` : ''}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ex && <span className="text-xs text-blue-500">{ex.count}회</span>}
                          {pain !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${pain >= 8 ? 'bg-red-100 text-red-700' : pain >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              통증 {pain}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </main>

        {/* 트레이너 회원 상세 모달 */}
        {trainerSelectedPatient && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-gray-900">회원 정보</h3>
                <button onClick={() => setTrainerSelectedPatient(null)} className="text-gray-400 text-xl">✕</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-2xl">👤</span></div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{trainerSelectedPatient.name}</p>
                    <p className="text-sm text-gray-500">{trainerSelectedPatient.email}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {trainerSelectedPatient.hospital_code && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">병원 코드</span>
                      <span className="font-medium">{trainerSelectedPatient.hospital_code}</span>
                    </div>
                  )}
                  {trainerSelectedPatient.diagnosis && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">진단명</span>
                      <span className="font-medium">{trainerSelectedPatient.diagnosis}</span>
                    </div>
                  )}
                  {trainerSelectedPatient.treatment && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">시술명</span>
                      <span className="font-medium">{trainerSelectedPatient.treatment}</span>
                    </div>
                  )}
                  {trainerSelectedPatient.rehab_goal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">재활 목표</span>
                      <span className="font-medium">{trainerSelectedPatient.rehab_goal}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">가입일</span>
                    <span className="font-medium">{trainerSelectedPatient.created_at ? new Date(trainerSelectedPatient.created_at).toLocaleDateString('ko-KR') : '-'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { router.push(`/messages/${trainerSelectedPatient.id}`); setTrainerSelectedPatient(null) }} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600">💬 메시지</button>
                  <button onClick={() => setTrainerSelectedPatient(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">닫기</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <BottomNav role="trainer" unreadCount={unreadCount} />
      </div>
    )
  }

  // ===== 환자 대시보드 =====
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 12주 프로그램 종료 팝업 */}
      {showProgramComplete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">12주 재활 프로그램 완료!</h3>
              <p className="text-sm text-gray-500 mb-4">축하합니다! 병원 재활 프로그램을 모두 마쳤어요.</p>
              <div className="bg-blue-50 rounded-xl p-4 mb-4 text-left">
                <p className="text-sm font-bold text-blue-900 mb-2">📊 프로그램 요약</p>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>✅ 12주 프로그램 완료</p>
                  <p>🏋️ 이번 주 운동 {weekExercises}회 수행</p>
                  {painChange && painChange.latest < painChange.first && (
                    <p>📉 통증 {painChange.first} → {painChange.latest} 감소</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">지속적인 관리로 더 나은 결과를 만들어보세요!</p>
              <div className="space-y-2">
                <button
                  onClick={() => { setShowProgramComplete(false); router.push("/subscribe") }}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: "linear-gradient(135deg, #0369A1, #0EA5E9)" }}
                >
                  개인 구독으로 계속하기 (₩9,900/월)
                </button>
                <button
                  onClick={() => { setShowProgramComplete(false); localStorage.setItem("sc_program_complete_dismissed", "true") }}
                  className="w-full py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-50"
                >
                  무료로 계속 이용하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 면책 조항 팝업 */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-4">
                <span className="text-4xl">⚕️</span>
                <h2 className="text-xl font-bold text-gray-900 mt-2">중요 고지</h2>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-2">
                <p className="font-semibold text-blue-800">어깨케어는 의료행위가 아닙니다.</p>
                <p>본 서비스는 재활 운동 가이드를 제공하는 보조 도구로, 의사의 진료·진단·처방을 대체할 수 없습니다.</p>
                <p>운동 시작 전 반드시 담당 의사와 상담하시기 바랍니다.</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-2">
                <p className="font-semibold text-yellow-800">⚠️ 운동 시 주의사항</p>
                <p>운동 중 통증이 심해지거나 불편함을 느끼면 즉시 중단하고 담당 의사와 상담하시기 바랍니다.</p>
                <p>본 프로그램을 따라 운동하는 중 발생한 부상, 합병증, 건강 악화에 대해 어깨케어는 책임을 지지 않습니다.</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700 space-y-2">
                <p className="font-semibold text-gray-800">👨‍⚕️ 전문가 감수</p>
                <p>본 프로그램의 운동 프로토콜은 정형외과 전문의와 물리치료사, 스포츠재활 전문 트레이너의 감수를 받았습니다.</p>
                <p className="text-xs text-gray-500">감수 범위: 운동 동작의 안전성, 단계별 프로그램 구성, 운동 강도 및 빈도</p>
              </div>
              <button
                onClick={handleDisclaimerAgree}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-xl transition"
              >
                확인했으며 동의합니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프리미엄 구독 유도 팝업 */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">프리미엄 기능입니다</h3>
              <p className="text-sm text-gray-500 mb-1">트레이너 1:1 메시지와 맞춤 운동 제안을</p>
              <p className="text-sm text-gray-500 mb-6">이용하려면 프리미엄 구독이 필요해요.</p>
              <div className="space-y-2">
                <button
                  onClick={() => { setShowPremiumModal(false); router.push('/subscribe') }}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
                >
                  구독 알아보기
                </button>
                <button
                  onClick={() => setShowPremiumModal(false)}
                  className="w-full py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-50"
                >
                  다음에 할게요
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header (Aqua Blue Gradient) ── */}
      <header style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 50%, #38BDF8 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">어깨케어</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/90">{user.name}님</span>
            <button
              onClick={() => router.push('/settings')}
              className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3.5 py-3 space-y-3">
        {/* 병원 소속 배지 */}
        {hospitalInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏥</span>
              <div>
                <p className="text-sm font-bold text-blue-900">{hospitalInfo.hospital_name}</p>
                <p className="text-xs text-blue-600">
                  {hospitalInfo.program_week ? `${hospitalInfo.program_week}주차 / 12주` : "재활 프로그램"}
                  {hospitalInfo.diagnosis ? ` · ${hospitalInfo.diagnosis}` : ""}
                </p>
              </div>
            </div>
            {hospitalInfo.trainer_name && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">담당: {hospitalInfo.trainer_name}</span>
            )}
          </div>
        )}

        {/* ── 1) 최상단: 순위 + 통계 + 주간리포트 ── */}
        <div className="rounded-2xl overflow-hidden">
          {/* 순위 히어로 */}
          <div className="p-4 pb-3 text-white" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0284C7 40%, #38BDF8 100%)' }}>
            {/* 순위 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">{myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏅'}</span>
                <div>
                  <p className="text-lg font-extrabold">
                    이번 주 {myRank > 0 ? <span style={{ color: '#FDE68A' }}>{myRank}위</span> : <span className="text-white/70">—</span>}
                  </p>
                  <p className="text-[10px] opacity-70">{totalRankers > 0 ? `전체 ${totalRankers}명 중` : '순위 집계중'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>{weekExercises}<span className="text-xs font-medium opacity-80">회</span></p>
                <p className="text-[9px] opacity-70">이번 주 운동</p>
              </div>
            </div>

            {/* 통계 3열 */}
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              <div className="bg-white/[0.12] backdrop-blur-sm rounded-lg py-2 text-center">
                <p className="text-xl font-extrabold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>{weekExercises}<span className="text-[10px] font-medium opacity-80">회</span></p>
                <p className="text-[9px] opacity-70">운동 횟수</p>
              </div>
              <div className="bg-white/[0.12] backdrop-blur-sm rounded-lg py-2 text-center">
                <p className="text-xl font-extrabold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
                  {weekPrescribedCount > 0 ? `${achievementRate}` : '-'}<span className="text-[10px] font-medium opacity-80">{weekPrescribedCount > 0 ? '%' : ''}</span>
                </p>
                <p className="text-[9px] opacity-70">목표 달성률</p>
              </div>
              <div className="bg-white/[0.12] backdrop-blur-sm rounded-lg py-2 text-center">
                <p className="text-xl font-extrabold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
                  {painChange
                    ? (painChange.latest < painChange.first
                        ? `↓${painChange.first - painChange.latest}`
                        : painChange.latest > painChange.first
                          ? `↑${painChange.latest - painChange.first}`
                          : '→0')
                    : '-'}
                </p>
                <p className="text-[9px] opacity-70">통증 변화</p>
              </div>
            </div>

            {/* 프로그레스 바 */}
            {weekPrescribedCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${Math.min(achievementRate, 100)}%` }} />
                </div>
                <span className="text-[9px] opacity-70 whitespace-nowrap">{weekExercises}/{weekPrescribedCount}회</span>
              </div>
            )}
          </div>

          {/* 주간 리포트 + 상세보기 버튼 */}
          <div className="flex">
            <button
              onClick={() => router.push('/weekly-report')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white hover:brightness-110 transition"
              style={{ background: '#0369A1' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span className="text-xs font-bold">주간 리포트</span>
            </button>
            <div className="w-px bg-white/20" />
            <button
              onClick={() => router.push('/my-stats')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-white hover:brightness-110 transition"
              style={{ background: '#0369A1' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span className="text-xs font-bold">기록 · 순위 상세</span>
            </button>
          </div>
        </div>

        {/* ── 2) AI 자가테스트 / AI 분석결과 (2열) ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push('/self-test')}
            className="rounded-xl p-3.5 text-left relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
          >
            <div className="absolute top-0 right-0 w-14 h-14 rounded-full bg-white/10 -mr-4 -mt-4" />
            <div className="relative">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                <span className="text-xl">🤖</span>
              </div>
              <p className="text-white font-bold text-[13px]">AI 자가테스트</p>
              <p className="text-white/60 text-[10px] mt-0.5">통증 + ROM 측정</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/self-test/history')}
            className="rounded-xl p-3.5 text-left relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            <div className="absolute top-0 right-0 w-14 h-14 rounded-full bg-white/10 -mr-4 -mt-4" />
            <div className="relative">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                <span className="text-xl">📊</span>
              </div>
              <p className="text-white font-bold text-[13px]">AI 분석결과</p>
              <p className="text-white/60 text-[10px] mt-0.5">진단 추정 · 추천 운동</p>
            </div>
          </button>
        </div>

        {/* ── 3) 통증 기록 / 내 운동 촬영 (2열) ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push('/pain')}
            className="bg-white rounded-xl p-3.5 text-left shadow-sm hover:shadow-md transition flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">통증 기록</p>
              <p className="text-[10px] text-slate-400">{todayPain !== null ? `오늘 ${todayPain}/10` : '오늘 기록하기'}</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/my-exercise-video')}
            className="bg-white rounded-xl p-3.5 text-left shadow-sm hover:shadow-md transition flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">내 운동 촬영</p>
              <p className="text-[10px] text-slate-400">영상으로 피드백 받기</p>
            </div>
          </button>
        </div>

        {/* ── 4) 오늘의 운동 ── */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">오늘의 운동</p>
            {prescriptions.length > 0 && (
              <span className="text-[11px] font-semibold" style={{ color: '#0284C7' }}>{prescriptions.length}개</span>
            )}
          </div>
          <div className="p-2.5">
            {prescriptions.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <p className="text-xs">아직 등록된 운동이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {prescriptions.map((rx) => (
                  <button
                    key={rx.id}
                    onClick={() => router.push(`/exercises/${rx.exercise_id}/workout`)}
                    className="w-full text-left rounded-xl p-2.5 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E0F2FE' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M2 12h2M20 12h2M4 8v8M20 8v8M7 5v14M17 5v14"/></svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-[13px]">{rx.exercise_name}</p>
                        <p className="text-[11px] text-slate-400">
                          {rx.sets}세트 × {rx.reps}회
                          {rx.resistance && ` · ${rx.resistance}`}
                          {rx.notes && (
                            <span style={{ color: '#0EA5E9' }}> · {rx.notes}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 트레이너 코멘트 ── */}
        {trainerNotes.length > 0 && subStatus.isPremium && (
          <div>
            <p className="text-sm font-bold text-slate-800 mb-1.5">트레이너 코멘트</p>
            <div className="space-y-1.5">
              {trainerNotes.map((note) => (
                <div key={note.id} className="bg-white rounded-xl p-3 shadow-sm" style={{ borderLeft: '3px solid #0EA5E9' }}>
                  <p className="text-xs text-slate-700 leading-relaxed">{note.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {new Date(note.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 메시지 (프리미엄) ── */}
        <button
          onClick={() => {
            if (!subStatus.isPremium) { setShowPremiumModal(true); return }
            trainerId ? router.push(`/messages/${trainerId}`) : router.push('/messages')
          }}
          className="w-full bg-white rounded-xl p-3.5 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: !subStatus.isPremium ? '#F1F5F9' : '#E0F2FE' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={!subStatus.isPremium ? '#94A3B8' : '#0284C7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <div className="flex-1">
            <p className={`text-[13px] font-bold ${!subStatus.isPremium ? 'text-slate-400' : 'text-slate-800'}`}>
              트레이너 메시지
              {!subStatus.isPremium && <span className="ml-1 text-[10px]">🔒</span>}
            </p>
            <p className="text-[10px] text-slate-400">
              {!subStatus.isPremium ? '프리미엄 전용' : unreadCount > 0 ? `읽지 않은 메시지 ${unreadCount}건` : '1:1 상담'}
            </p>
          </div>
          {subStatus.isPremium && unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </main>

      <BottomNav role="patient" unreadCount={unreadCount} trainerId={trainerId} isPremium={subStatus.isPremium} />
    </div>
  )
}
