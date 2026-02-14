'use client'

import { fetchAuthMe, fetchWithAuth } from '@/lib/fetch-auth'
import { removeToken } from '@/lib/token-storage'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'

interface User {
  id: string
  name: string
  email: string
  subscription_type?: string
  role?: string
  hospital_code?: string
  hospital_id?: string
}

interface HospitalLink {
  linked: boolean
  hospital_code?: string
  hospital?: { id: string; name: string; prefix: string; plan_type: string }
  patient?: {
    program_week: number
    program_start_date: string
    program_end_date: string
    diagnosis: string | null
    surgery_type: string | null
    status: string
    trainer_name: string | null
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [hospitalLink, setHospitalLink] = useState<HospitalLink | null>(null)
  const [showHospitalModal, setShowHospitalModal] = useState(false)
  const [hospitalCodeInput, setHospitalCodeInput] = useState('')
  const [hospitalLinking, setHospitalLinking] = useState(false)
  const [hospitalMessage, setHospitalMessage] = useState('')

  // 프로필 수정
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // 비밀번호 변경
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMessage, setPwMessage] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // 알림 설정
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)

  useEffect(() => {
    fetchAuthMe()
      .then(res => { if (!res.ok) throw new Error(''); return res.json() })
      .then(data => {
        if (data.user) { setUser(data.user); fetchHospitalLink() }
        else router.push('/login')
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifEnabled(Notification.permission === 'granted')
    }
  }, [])

  async function fetchHospitalLink() {
    try {
      const res = await fetchWithAuth('/api/auth/link-hospital')
      if (res.ok) setHospitalLink(await res.json())
    } catch {}
  }

  async function handleLinkHospital(e: React.FormEvent) {
    e.preventDefault()
    setHospitalLinking(true); setHospitalMessage('')
    try {
      const res = await fetchWithAuth('/api/auth/link-hospital', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: hospitalCodeInput }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setHospitalMessage(`✅ ${data.message}`); setHospitalCodeInput('')
        fetchHospitalLink()
        const meRes = await fetchAuthMe()
        if (meRes.ok) { const meData = await meRes.json(); if (meData.user) setUser(meData.user) }
        setTimeout(() => { setShowHospitalModal(false); setHospitalMessage('') }, 2500)
      } else { setHospitalMessage(`❌ ${data.error}`) }
    } catch { setHospitalMessage('❌ 서버 연결 오류') }
    finally { setHospitalLinking(false) }
  }

  async function handleProfileSave() {
    if (!profileName.trim() || !user) return
    setProfileSaving(true)
    const { error } = await supabase.from('users').update({ name: profileName.trim() }).eq('id', user.id)
    if (!error) {
      setUser({ ...user, name: profileName.trim() })
      setShowProfileModal(false)
      alert('이름이 변경되었습니다.')
    } else { alert('변경 실패: ' + error.message) }
    setProfileSaving(false)
  }

  async function handlePasswordChange() {
    setPwMessage('')
    if (newPw.length < 6) { setPwMessage('❌ 새 비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setPwMessage('❌ 새 비밀번호가 일치하지 않습니다.'); return }
    setPwSaving(true)
    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPwMessage('✅ 비밀번호가 변경되었습니다.')
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
        setTimeout(() => { setShowPasswordModal(false); setPwMessage('') }, 2000)
      } else { setPwMessage(`❌ ${data.error || '변경 실패'}`) }
    } catch { setPwMessage('❌ 서버 연결 오류') }
    finally { setPwSaving(false) }
  }

  async function handleToggleNotification() {
    if (!notifEnabled) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        setNotifEnabled(true)
        alert('알림이 활성화되었습니다.')
      } else { alert('알림 권한이 거부되었습니다. 브라우저 설정에서 변경해주세요.') }
    } else {
      alert('알림을 끄려면 브라우저 설정에서 직접 변경해주세요.')
    }
  }

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await fetch('/api/auth/logout', { method: 'POST' })
      await removeToken()
      router.push('/login')
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ko-KR')
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">로딩중...</div></div>
  if (!user) return null

  const subscriptionLabel =
    user.subscription_type === 'PREMIUM' ? '프리미엄 회원' :
    user.subscription_type === 'PLATINUM_PATIENT' ? '플래티넘 환자' :
    user.subscription_type === 'TRIAL' ? '무료 체험' : '일반 회원'

  const isKakaoUser = !user.email || user.email.includes('@kakao')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600"><span className="text-2xl">←</span></button>
            <h1 className="text-xl font-bold text-gray-900">설정</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">프로필</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#E0F2FE] rounded-full flex items-center justify-center"><span className="text-3xl">👤</span></div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="text-xs text-[#0284C7] mt-1">{subscriptionLabel}</p>
            </div>
          </div>
        </div>

        {/* Hospital Link */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">🏥 병원 연결</h2>
          {hospitalLink?.linked ? (
            <div className="p-6">
              <div className="bg-blue-50 rounded-lg p-4 mb-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🏥</span>
                  <div>
                    <p className="font-bold text-gray-900">{hospitalLink.hospital?.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{hospitalLink.hospital_code}</p>
                  </div>
                </div>
                {hospitalLink.patient && (
                  <div className="mt-3 pt-3 border-t border-blue-100 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">프로그램</span><span className="font-semibold text-blue-700">{hospitalLink.patient.program_week}주차 / 12주</span></div>
                    {hospitalLink.patient.diagnosis && <div className="flex justify-between"><span className="text-gray-500">진단명</span><span>{hospitalLink.patient.diagnosis}</span></div>}
                    {hospitalLink.patient.surgery_type && <div className="flex justify-between"><span className="text-gray-500">시술</span><span>{hospitalLink.patient.surgery_type}</span></div>}
                    {hospitalLink.patient.trainer_name && <div className="flex justify-between"><span className="text-gray-500">담당 트레이너</span><span>{hospitalLink.patient.trainer_name}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">종료 예정</span><span>{formatDate(hospitalLink.patient.program_end_date)}</span></div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-3">병원에서 받은 코드를 입력하면 12주 무료 재활 프로그램에 참여할 수 있습니다.</p>
              <button onClick={() => setShowHospitalModal(true)} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2">
                <span>🏥</span> 병원코드 등록하기
              </button>
            </div>
          )}
        </div>

        {/* Account Settings */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">계정 설정</h2>
          <div className="divide-y">
            <button onClick={() => { setProfileName(user.name); setShowProfileModal(true) }} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3"><span className="text-xl">👤</span><span className="text-gray-900">프로필 수정</span></div>
              <span className="text-gray-400">→</span>
            </button>
            {isKakaoUser ? (
              <div className="w-full px-6 py-4 flex items-center justify-between opacity-50">
                <div className="flex items-center gap-3"><span className="text-xl">🔒</span><span className="text-gray-900">비밀번호 변경</span></div>
                <span className="text-xs text-gray-400">카카오 로그인</span>
              </div>
            ) : (
              <button onClick={() => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwMessage(''); setShowPasswordModal(true) }} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-3"><span className="text-xl">🔒</span><span className="text-gray-900">비밀번호 변경</span></div>
                <span className="text-gray-400">→</span>
              </button>
            )}
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">앱 설정</h2>
          <div className="divide-y">
            <button onClick={handleToggleNotification} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3"><span className="text-xl">🔔</span><span className="text-gray-900">알림 설정</span></div>
              <div className={`w-12 h-7 rounded-full relative transition ${notifEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition ${notifEnabled ? 'left-5.5 right-0.5' : 'left-0.5'}`} style={{ left: notifEnabled ? '22px' : '2px' }} />
              </div>
            </button>
            <div className="w-full px-6 py-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3"><span className="text-xl">🌙</span><span className="text-gray-900">다크 모드</span></div>
              <span className="text-xs text-gray-400">준비중</span>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">구독 관리</h2>
          <div className="divide-y">
            <button onClick={() => router.push('/subscribe')} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3"><span className="text-xl">💳</span><span className="text-gray-900">구독 플랜</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-blue-500 font-medium">{subscriptionLabel}</span><span className="text-gray-400">→</span></div>
            </button>
            <div className="w-full px-6 py-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3"><span className="text-xl">📊</span><span className="text-gray-900">결제 내역</span></div>
              <span className="text-xs text-gray-400">준비중</span>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-900 px-6 py-4 border-b">지원</h2>
          <div className="divide-y">
            <button onClick={() => alert('자주 묻는 질문\n\nQ. 운동은 하루에 몇 번 하나요?\nA. 처방받은 운동을 하루 1~2회 권장합니다.\n\nQ. 통증이 심해지면?\nA. 운동을 중단하고 담당 트레이너에게 문의하세요.\n\nQ. 구독을 해지하려면?\nA. 설정 > 구독 관리에서 해지할 수 있습니다.')} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3"><span className="text-xl">❓</span><span className="text-gray-900">도움말</span></div>
              <span className="text-gray-400">→</span>
            </button>
            <button onClick={() => window.location.href = 'mailto:support@shouldercare.kr?subject=어깨케어 문의'} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3"><span className="text-xl">📧</span><span className="text-gray-900">문의하기</span></div>
              <span className="text-gray-400">→</span>
            </button>
            <button onClick={() => router.push("/terms")} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"><div className="flex items-center gap-3"><span className="text-xl">📄</span><span className="text-gray-900">이용약관</span></div><span className="text-gray-400">→</span></button>
            </div>
            <button onClick={() => router.push("/privacy")} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"><div className="flex items-center gap-3"><span className="text-xl">🔐</span><span className="text-gray-900">개인정보처리방침</span></div><span className="text-gray-400">→</span></button>
          </div>
        </div>

        {/* Version */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center text-sm text-gray-500"><span>버전</span><span>1.0.0</span></div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-4 rounded-lg transition-colors">로그아웃</button>
      </main>

      {/* 병원코드 모달 */}
      {showHospitalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">🏥 병원코드 등록</h3>
              <button onClick={() => { setShowHospitalModal(false); setHospitalMessage('') }} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleLinkHospital}>
              <p className="text-sm text-gray-500 mb-4">병원에서 발급받은 코드를 입력해주세요.</p>
              <input type="text" placeholder="PLT-12345678" value={hospitalCodeInput}
                onChange={e => { let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length > 3 && !v.includes('-')) v = v.slice(0, 3) + '-' + v.slice(3); setHospitalCodeInput(v) }}
                required className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-center text-lg font-mono tracking-wider focus:border-blue-500 focus:outline-none" />
              {hospitalMessage && <div className={`mt-3 p-3 rounded-lg text-sm ${hospitalMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{hospitalMessage}</div>}
              <button type="submit" disabled={hospitalLinking || !hospitalCodeInput} className="w-full mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition">
                {hospitalLinking ? '연결 중...' : '코드 등록'}
              </button>
            </form>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg"><p className="text-xs text-blue-600 text-center">💡 코드를 입력하면 12주 무료 재활 프로그램이 시작됩니다.</p></div>
          </div>
        </div>
      )}

      {/* 프로필 수정 모달 */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">👤 프로필 수정</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <label className="text-sm text-gray-500 mb-1 block">이름</label>
            <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
            <button onClick={handleProfileSave} disabled={profileSaving || !profileName.trim()}
              className="w-full mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition">
              {profileSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">🔒 비밀번호 변경</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">현재 비밀번호</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">새 비밀번호 (6자 이상)</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">새 비밀번호 확인</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
            {pwMessage && <div className={`mt-3 p-3 rounded-lg text-sm ${pwMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{pwMessage}</div>}
            <button onClick={handlePasswordChange} disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="w-full mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition">
              {pwSaving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </div>
      )}

      <BottomNav role={user.role || 'patient'} />
    </div>
  )
}
