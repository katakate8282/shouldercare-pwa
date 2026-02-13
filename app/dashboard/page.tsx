'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  subscription_type?: string
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
  const [trainerId, setTrainerId] = useState<string | null>(null)

  // 관리자용 state
  const [totalPatients, setTotalPatients] = useState(0)
  const [totalTrainers, setTotalTrainers] = useState(0)
  const [todayExerciseUsers, setTodayExerciseUsers] = useState(0)
  const [todayPainUsers, setTodayPainUsers] = useState(0)
  const [weekTrend, setWeekTrend] = useState<WeekTrend[]>([])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          if (data.user.role === 'admin') {
            fetchAdminStats()
          } else {
            fetchStats(data.user.id)
            fetchPrescriptions(data.user.id)
            fetchTrainerNotes(data.user.id)
            fetchTrainerAndUnread(data.user.id)
          }
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  // Realtime 구독 (환자용)
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
    // KST 오늘 시작
    const now = new Date()
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const kstToday = new Date(kstNow)
    kstToday.setHours(0, 0, 0, 0)
    const kstTodayUTC = new Date(kstToday.getTime() - 9 * 60 * 60 * 1000).toISOString()

    // 전체 환자 수
    const { count: pCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('role', 'in', '("trainer","admin")')
    setTotalPatients(pCount || 0)

    // 전체 트레이너 수
    const { count: tCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'trainer')
    setTotalTrainers(tCount || 0)

    // 오늘 운동한 유저 수
    const { data: todayExLogs } = await supabase
      .from('exercise_logs')
      .select('user_id')
      .gte('completed_at', kstTodayUTC)
    const exUsers = new Set(todayExLogs?.map(l => l.user_id) || [])
    setTodayExerciseUsers(exUsers.size)

    // 오늘 통증 기록한 유저 수
    const { data: todayPnLogs } = await supabase
      .from('pain_logs')
      .select('user_id')
      .gte('logged_at', kstTodayUTC)
    const pnUsers = new Set(todayPnLogs?.map(l => l.user_id) || [])
    setTodayPainUsers(pnUsers.size)

    // 주간 트렌드 (최근 4주)
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

      if (exerciseData) setWeekExercises(exerciseData.length)

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

  const subscriptionLabel =
    user.subscription_type === 'PREMIUM' ? '프리미엄 회원' :
    user.subscription_type === 'PLATINUM_PATIENT' ? '플래티넘 환자' :
    user.subscription_type === 'TRIAL' ? '무료 체험' : '일반 회원'

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
              <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push('/admin')}
              className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <span className="text-xl mb-1.5 block">⚙️</span>
              <p className="font-semibold text-gray-900 text-sm">관리자</p>
              <p className="text-xs text-gray-600">트레이너·환자·회원 관리</p>
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
              onClick={() => router.push('/trainer')}
              className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <span className="text-xl mb-1.5 block">👨‍⚕️</span>
              <p className="font-semibold text-gray-900 text-sm">트레이너</p>
              <p className="text-xs text-gray-600">환자 관리</p>
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

        {/* Admin Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
          <div className="max-w-7xl mx-auto px-4 flex justify-around py-3">
            <button className="flex flex-col items-center gap-1 text-blue-500">
              <span className="text-xl">🏠</span>
              <span className="text-xs font-medium">홈</span>
            </button>
            <button onClick={() => router.push('/admin')} className="flex flex-col items-center gap-1 text-gray-400">
              <span className="text-xl">⚙️</span>
              <span className="text-xs">관리</span>
            </button>
            <button onClick={() => router.push('/messages')} className="flex flex-col items-center gap-1 text-gray-400">
              <span className="text-xl">💬</span>
              <span className="text-xs">메시지</span>
            </button>
            <button onClick={() => router.push('/admin/reports')} className="flex flex-col items-center gap-1 text-gray-400">
              <span className="text-xl">📊</span>
              <span className="text-xs">리포트</span>
            </button>
            <button onClick={() => router.push('/settings')} className="flex flex-col items-center gap-1 text-gray-400">
              <span className="text-xl">⚙️</span>
              <span className="text-xs">설정</span>
            </button>
          </div>
        </nav>
      </div>
    )
  }

  // ===== 환자/트레이너 대시보드 =====
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">어깨케어</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{subscriptionLabel}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              <span className="text-2xl">👤</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3 space-y-3">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3 text-white">
          <h2 className="text-lg font-bold mb-1">{user.name}님 환영합니다! 👋</h2>
          <p className="text-xs text-blue-100">오늘도 건강한 하루 되세요</p>
          <div className="mt-1.5 inline-block bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {subscriptionLabel}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg p-2.5 shadow-sm">
            <p className="text-xs text-gray-600 mb-0.5">이번 주 운동</p>
            <p className="text-lg font-bold text-gray-900">{weekExercises}회</p>
            <p className="text-xs text-gray-500">최근 7일</p>
          </div>
          <div className="bg-white rounded-lg p-2.5 shadow-sm">
            <p className="text-xs text-gray-600 mb-0.5">오늘 통증</p>
            <p className="text-lg font-bold text-gray-900">
              {todayPain !== null ? todayPain : '-'}
            </p>
            <p className="text-xs text-gray-500">
              {todayPain !== null ? '기록됨' : '아직 기록 없음'}
            </p>
          </div>
        </div>

        {/* 내 기록 바로가기 */}
        <button
          onClick={() => router.push('/my-stats')}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-3 text-white text-left hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-semibold text-sm">내 기록 · 레벨 · 순위</p>
                <p className="text-xs text-white/70">주간 리포트와 운동 기록을 확인하세요</p>
              </div>
            </div>
            <span className="text-white/70">→</span>
          </div>
        </button>

        {/* 트레이너에게 메시지 */}
        {trainerId && (
          <button
            onClick={() => router.push(`/messages/${trainerId}`)}
            className="w-full bg-white rounded-lg shadow-sm p-3 flex items-center justify-between hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">트레이너에게 메시지</p>
                <p className="text-xs text-gray-500">궁금한 점이나 상태를 공유하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className="text-gray-400">→</span>
            </div>
          </button>
        )}

        {/* 트레이너 메모 */}
        {trainerNotes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">💬 트레이너 코멘트</h3>
            <div className="space-y-2">
              {trainerNotes.map((note) => (
                <div key={note.id} className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-gray-800">{note.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(note.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 처방된 운동 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-2.5 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">오늘의 운동</h3>
            {prescriptions.length > 0 && (
              <span className="text-xs text-blue-500">{prescriptions.length}개 처방</span>
            )}
          </div>
          <div className="p-3">
            {prescriptions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <span className="text-2xl mb-2 block">📝</span>
                <p className="text-xs">아직 처방된 운동이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {prescriptions.map((rx) => (
                  <button
                    key={rx.id}
                    onClick={() => router.push(`/exercises/${rx.exercise_id}/workout`)}
                    className="w-full text-left px-4 py-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{rx.exercise_name}</p>
                        <p className="text-xs text-gray-500">
                          {rx.sets}세트 × {rx.reps}회
                          {rx.resistance && ` · ${rx.resistance}`}
                        </p>
                        {rx.notes && (
                          <p className="text-xs text-blue-500 mt-0.5">💬 {rx.notes}</p>
                        )}
                      </div>
                      <span className="text-gray-400 text-lg">▶</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push('/exercises')}
            className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <span className="text-xl mb-1.5 block">💪</span>
            <p className="font-semibold text-gray-900 text-sm">운동 보기</p>
            <p className="text-xs text-gray-600">운동 라이브러리</p>
          </button>
          <button
            onClick={() => router.push('/pain')}
            className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <span className="text-xl mb-1.5 block">📊</span>
            <p className="font-semibold text-gray-900 text-sm">통증 기록</p>
            <p className="text-xs text-gray-600">오늘 통증 수준 입력</p>
          </button>
          {user.role === 'trainer' && (
            <button
              onClick={() => router.push('/trainer')}
              className="bg-white rounded-lg p-3 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <span className="text-xl mb-1.5 block">👨‍⚕️</span>
              <p className="font-semibold text-gray-900 text-sm">트레이너</p>
              <p className="text-xs text-gray-600">환자 관리</p>
            </button>
          )}
        </div>
      </main>

      {/* Patient Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 flex justify-around py-3">
          <button className="flex flex-col items-center gap-1 text-blue-500">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">홈</span>
          </button>
          <button onClick={() => router.push('/exercises')} className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">💪</span>
            <span className="text-xs">운동</span>
          </button>
          <button
            onClick={() => trainerId && router.push(`/messages/${trainerId}`)}
            className="flex flex-col items-center gap-1 text-gray-400 relative"
          >
            <span className="text-xl">💬</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span className="text-xs">메시지</span>
          </button>
          <button onClick={() => router.push('/progress')} className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">📈</span>
            <span className="text-xs">진행상황</span>
          </button>
          <button onClick={() => router.push('/settings')} className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">⚙️</span>
            <span className="text-xs">설정</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
