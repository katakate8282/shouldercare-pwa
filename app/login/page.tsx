'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const handleKakaoLogin = async () => {
    const result = await signIn('kakao', {
      redirect: false,
      callbackUrl: '/dashboard',
    })

    if (result?.ok) {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            어깨케어
          </h1>
          <p className="text-gray-600">
            AI 기반 어깨 재활 플랫폼
          </p>
        </div>

        <button
          onClick={handleKakaoLogin}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition"
        >
          <span className="text-2xl">💬</span>
          카카오로 시작하기
        </button>

        <p className="text-center text-sm text-gray-500">
          로그인하면 이용약관 및 개인정보처리방침에 동의하게 됩니다.
        </p>
      </div>
    </div>
  )
}
