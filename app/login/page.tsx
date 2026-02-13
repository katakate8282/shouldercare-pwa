'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  no_code: '인증 코드를 받지 못했습니다.',
  config_error: '서버 설정 오류입니다.',
  token_exchange_failed: '카카오 인증에 실패했습니다.',
  user_info_failed: '사용자 정보를 가져올 수 없습니다.',
  database_error: '데이터베이스 오류가 발생했습니다.',
  unexpected_error: '예기치 않은 오류가 발생했습니다.',
  auth_failed: '로그인에 실패했습니다.',
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [view, setView] = useState<'main' | 'email-login' | 'email-signup' | 'hospital-code'>('main')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [hospitalCode, setHospitalCode] = useState('')

  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (errorCode) {
      setError(ERROR_MESSAGES[errorCode] || '오류가 발생했습니다.')
    }

    // 콜백에서 돌아온 경우 토큰 저장
    const token = searchParams.get('token')
    const redirect = searchParams.get('redirect')
    if (token) {
      localStorage.setItem('sc_token', token)
      router.push(redirect || '/dashboard')
    }
  }, [searchParams, router])

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    const token = localStorage.getItem('sc_token')
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) router.push('/dashboard')
          else localStorage.removeItem('sc_token')
        })
        .catch(() => localStorage.removeItem('sc_token'))
    }
  }, [router])

  const handleKakaoLogin = () => {
    setIsLoading(true)
    setError(null)
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

      // localStorage에 토큰 저장
      if (data.token) {
        localStorage.setItem('sc_token', data.token)
      }

      router.push(data.redirect || '/dashboard')
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

      // localStorage에 토큰 저장
      if (data.token) {
        localStorage.setItem('sc_token', data.token)
      }

      router.push(data.redirect || '/onboarding')
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

  // ===== 메인 화면 =====
  if (view === 'main') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🏥</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">어깨케어</h1>
              <p className="text-gray-600">AI 기반 어깨 재활 전문 플랫폼</p>
            </div>

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
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition"
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
              <a href="#" className="text-sm text-blue-600 hover:underline">이용약관</a>
              <a href="#" className="text-sm text-blue-600 hover:underline">개인정보처리방침</a>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-500 text-sm mb-2">아직 계정이 없으신가요?</p>
              <button
                onClick={() => { setView('email-signup'); setError(null) }}
                className="text-blue-600 font-semibold hover:underline text-base"
              >
                회원가입하기
              </button>
            </div>
          </div>
        </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-lg">로딩중...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
