'use client'

import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const handleKakaoLogin = () => {
    window.location.href = '/api/auth/kakao'
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

        <button
          onClick={handleKakaoLogin}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition"
        >
          <span className="text-2xl">💬</span>
          카카오로 계속하기
        </button>

        <button className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-4 rounded-xl flex items-center justify-center gap-3 transition">
          <span className="text-2xl">✏️</span>
          테스트 계정으로 로그인
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          계속 진행하시면 다음에 동의하는 것으로 간주됩니다
        </p>
        
        <div className="flex justify-center gap-4 mt-2">
          <a href="#" className="text-sm text-blue-600 hover:underline">이용약관</a>
          <a href="#" className="text-sm text-blue-600 hover:underline">개인정보처리방침</a>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">병원 코드가 있으신가요?</p>
          <button className="mt-2 text-blue-600 font-medium hover:underline">
            병원 코드로 시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
