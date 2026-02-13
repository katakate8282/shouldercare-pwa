'use client'

import { useEffect, useState, useRef } from 'react'
import { saveToken, getToken } from '@/lib/token-storage'

const ERROR_MESSAGES: Record<string, string> = {
  no_code: '인증 코드를 받지 못했습니다.',
  config_error: '서버 설정 오류입니다.',
  token_exchange_failed: '카카오 인증에 실패했습니다.',
  user_info_failed: '사용자 정보를 가져올 수 없습니다.',
  database_error: '데이터베이스 오류가 발생했습니다.',
  unexpected_error: '예기치 않은 오류가 발생했습니다.',
  auth_failed: '로그인에 실패했습니다.',
}

function isKakaoInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('kakaotalk') || ua.includes('kakao')
}

function shouldSkipSplash(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (isKakaoInAppBrowser()) return true
    if (sessionStorage.getItem('sc_splash_done')) return true
  } catch {}
  return false
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [view, setView] = useState<'splash' | 'main' | 'email-login' | 'email-signup' | 'hospital-code'>(() => {
    return shouldSkipSplash() ? 'main' : 'splash'
  })
  const [splashFading, setSplashFading] = useState(false)
  const [isKakao, setIsKakao] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [hospitalCode, setHospitalCode] = useState('')

  const initDone = useRef(false)
  const splashDone = useRef(false)

  // 카카오 인앱 브라우저 감지
  useEffect(() => {
    setIsKakao(isKakaoInAppBrowser())
  }, [])

  // 인증 체크 + 콜백 처리
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    const params = new URLSearchParams(window.location.search)

    const errorCode = params.get('error')
    if (errorCode) {
      setError(ERROR_MESSAGES[errorCode] || '오류가 발생했습니다.')
      try { sessionStorage.setItem('sc_splash_done', '1') } catch {}
      setSplashFading(true)
      setTimeout(() => setView('main'), 300)
      return
    }

    const token = params.get('token')
    const redirect = params.get('redirect')
    if (token) {
      saveToken(token).then(() => {
        window.location.href = redirect || '/dashboard'
      })
      return
    }

    getToken().then((existingToken) => {
      if (existingToken) {
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${existingToken}` },
        })
          .then((res) => {
            if (res.ok) {
              window.location.href = '/dashboard'
            }
          })
          .catch(() => {})
      } else {
        // 토큰 없거나 무효 - 로그인 화면 유지
      }
    })
  }, [])

  // 스플래시 타이머
  useEffect(() => {
    if (splashDone.current) return
    splashDone.current = true
    if (view !== 'splash') return

    const timer = setTimeout(() => {
      setSplashFading(true)
      setTimeout(() => {
        try { sessionStorage.setItem('sc_splash_done', '1') } catch {}
        setView('main')
      }, 500)
    }, 2500)

    return () => clearTimeout(timer)
  }, [view])

  const handleKakaoLogin = () => {
    setIsLoading(true)
    setError(null)

    if (isKakaoInAppBrowser()) {
      // 카카오 인앱 브라우저 → 외부 브라우저(Safari/Chrome)로 강제 오픈
      const currentUrl = window.location.origin + '/api/auth/kakao'

      // Android: intent scheme
      const ua = navigator.userAgent.toLowerCase()
      if (/android/i.test(ua)) {
        window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
        return
      }

      // iOS: Safari로 강제 오픈 (카카오 인앱 브라우저 탈출)
      // 방법 1: location.href로 직접 이동 (일부 버전에서 동작)
      // 방법 2: 딥링크 불가 시 사용자에게 안내
      window.location.href = currentUrl
      
      // 1초 후에도 페이지가 남아있으면 (리다이렉트 실패) 외부 브라우저 안내
      setTimeout(() => {
        setIsLoading(false)
        setError('카카오톡 내에서 로그인이 제한될 수 있습니다. 우측 상단 메뉴(⋮)에서 "다른 브라우저로 열기"를 선택해주세요.')
      }, 2000)
      return
    }

    // 일반 브라우저: 기존 방식
    window.location.href = '/api/auth/kakao'
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '로그인에 실패했습니다.')
        setIsLoading(false)
        return
      }

      if (data.token) {
        await saveToken(data.token)
      }

      window.location.href = data.redirect || '/dashboard'
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '회원가입에 실패했습니다.')
        setIsLoading(false)
        return
      }

      if (data.token) {
        await saveToken(data.token)
      }

      window.location.href = data.redirect || '/onboarding'
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  const handleHospitalCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setError('병원 코드 기능은 준비 중입니다. 카카오 로그인 후 병원 코드를 입력해주세요.')
    setIsLoading(false)
  }

  // 카카오 인앱 브라우저에서 외부 브라우저로 유도하는 배너
  const KakaoBanner = () => {
    if (!isKakao) return null
    return (
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800 text-center">
          📱 카카오톡에서 열렸습니다.<br />
          <strong>원활한 로그인을 위해 우측 상단 메뉴(⋮)에서<br />&quot;다른 브라우저로 열기&quot;를 권장합니다.</strong>
        </p>
      </div>
    )
  }

  // ===== 스플래시 화면 =====
  if (view === 'splash') {
    return (
      <div className={`min-h-screen bg-gradient-to-br bg-[#0284C7] flex items-center justify-center p-4 transition-opacity duration-500 ${splashFading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="text-center w-full max-w-sm">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M6 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M12 18v-6"/><path d="M6 11c0 4 2.5 6 6 6s6-2 6-6"/></svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">어깨케어</h1>
          <p className="text-sky-100 text-base mb-10">AI 기반 어깨 재활 전문 플랫폼</p>

          <div className="space-y-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 015 5v3H7V7a5 5 0 015-5z"/><rect x="3" y="10" width="18" height="11" rx="2"/><line x1="9" y1="15" x2="9" y2="15.01"/><line x1="15" y1="15" x2="15" y2="15.01"/></svg>
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-sm">AI 자세분석</p>
                <p className="text-sky-200/70 text-xs">실시간 운동 피드백</p>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-sm">1:1 전문 트레이너</p>
                <p className="text-sky-200/70 text-xs">맞춤형 운동 제안</p>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-sm">재활 진행상황 추적</p>
                <p className="text-sky-200/70 text-xs">통증, ROM 등 자동 기록</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  // ===== 메인 화면 (로그인 옵션) =====
  if (view === 'main') {
    return (
      <div className="min-h-screen bg-gradient-to-br bg-[#0284C7] flex items-center justify-center p-4 animate-fadeIn">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-[#0284C7] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M6 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M12 18v-6"/><path d="M6 11c0 4 2.5 6 6 6s6-2 6-6"/></svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">어깨케어</h1>
              <p className="text-gray-600">AI 기반 어깨 재활 전문 플랫폼</p>
            </div>

            <KakaoBanner />

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleKakaoLogin}
                disabled={isLoading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 text-gray-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition"
              >
                <span className="text-2xl">💬</span>
                카카오로 계속하기
              </button>

              <button
                onClick={() => { setView('email-login'); setError(null) }}
                className="w-full bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition"
              >
                <span className="text-2xl">✉️</span>
                이메일로 계속하기
              </button>

              <button
                onClick={() => { setView('hospital-code'); setError(null) }}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition border-2 border-gray-200"
              >
                <span className="text-2xl">🏥</span>
                병원 코드로 계속하기
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
              계속 진행하시면 다음에 동의하는 것으로 간주됩니다
            </p>
            <div className="flex justify-center gap-4 mt-2">
              <a href="#" className="text-sm text-[#0284C7] hover:underline">이용약관</a>
              <a href="#" className="text-sm text-[#0284C7] hover:underline">개인정보처리방침</a>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-500 text-sm mb-2">아직 계정이 없으신가요?</p>
              <button
                onClick={() => { setView('email-signup'); setError(null) }}
                className="text-[#0284C7] font-semibold hover:underline text-base"
              >
                회원가입하기
              </button>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-out;
          }
        `}</style>
      </div>
    )
  }

  // ===== 이메일 로그인 =====
  if (view === 'email-login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <button onClick={() => { setView('main'); setError(null) }} className="text-gray-500 hover:text-gray-700 mb-4">
              ← 뒤로
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">이메일로 로그인</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button type="submit" disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl transition">
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm">계정이 없으신가요?{' '}
                <button onClick={() => { setView('email-signup'); setError(null) }} className="text-blue-600 font-semibold hover:underline">회원가입</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===== 이메일 회원가입 =====
  if (view === 'email-signup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <button onClick={() => { setView('main'); setError(null) }} className="text-gray-500 hover:text-gray-700 mb-4">
              ← 뒤로
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">회원가입</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailSignup} className="space-y-4">
              <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <input type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button type="submit" disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl transition">
                {isLoading ? '가입 중...' : '회원가입'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm">이미 계정이 있으신가요?{' '}
                <button onClick={() => { setView('email-login'); setError(null) }} className="text-blue-600 font-semibold hover:underline">로그인</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===== 병원 코드 입력 =====
  if (view === 'hospital-code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <button onClick={() => { setView('main'); setError(null) }} className="text-gray-500 hover:text-gray-700 mb-4">
              ← 뒤로
            </button>

            <div className="text-center mb-6">
              <span className="text-5xl mb-4 block">🏥</span>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">병원 코드 입력</h2>
              <p className="text-gray-500 text-sm">병원에서 받은 코드를 입력해주세요</p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleHospitalCode} className="space-y-4">
              <input type="text" placeholder="PLT-2024-XXXX" value={hospitalCode}
                onChange={(e) => setHospitalCode(e.target.value.toUpperCase())} required
                className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider" />
              <button type="submit" disabled={isLoading || !hospitalCode}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl transition">
                {isLoading ? '확인 중...' : '코드 확인'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 text-center">
                💡 병원 코드는 수술 후 담당 병원에서 발급받으실 수 있습니다.
                <br />12주 무료 재활 프로그램이 제공됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
