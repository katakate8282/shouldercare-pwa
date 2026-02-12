'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: '로그인에 실패했습니다.',
  database_error: '데이터베이스 오류가 발생했습니다.',
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [tab, setTab] = useState<'social' | 'email'>('social')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (errorCode) {
      setError(ERROR_MESSAGES[errorCode] || '오류가 발생했습니다.')
    }
  }, [searchParams])

  const handleKakaoLogin = () => {
    setIsLoading(true)
    setError(null)
    window.location.href = '/api/auth/kakao'
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login'
      const body = isSignup ? { email, password, name } : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '인증에 실패했습니다.')
        setIsLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
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

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('social')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'social'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            간편 로그인
          </button>
          <button
            onClick={() => setTab('email')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'email'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            이메일
          </button>
        </div>

        {tab === 'social' && (
          <div>
            <button
              onClick={handleKakaoLogin}
              disabled={isLoading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 text-gray-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  로그인 중...
                </>
              ) : (
                <>
                  <span className="text-2xl">💬</span>
                  카카오로 계속하기
                </>
              )}
            </button>
          </div>
        )}

        {tab === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignup && (
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl transition"
            >
              {isLoading ? '처리 중...' : isSignup ? '회원가입' : '로그인'}
            </button>
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="w-full text-sm text-gray-600 hover:text-gray-800"
            >
              {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          계속 진행하시면 다음에 동의하는 것으로 간주됩니다
        </p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="#" className="text-sm text-blue-600 hover:underline">이용약관</a>
          <a href="#" className="text-sm text-blue-600 hover:underline">개인정보처리방침</a>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-white/80 text-sm">병원 코드가 있으신가요?</p>
        <a href="#" className="text-white font-medium hover:underline">병원 코드로 시작하기</a>
      </div>
    </div>
  )
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
