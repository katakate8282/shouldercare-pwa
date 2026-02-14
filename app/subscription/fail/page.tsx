'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function FailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const errorCode = searchParams.get('code') || ''
  const errorMsg = searchParams.get('message') || '결제가 취소되었거나 실패했습니다'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">😔</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">결제가 완료되지 않았습니다</h2>
        <p className="text-sm text-gray-500 mb-1">{decodeURIComponent(errorMsg)}</p>
        {errorCode && <p className="text-xs text-gray-400 mb-6">오류 코드: {errorCode}</p>}

        <div className="space-y-2 mt-6">
          <button
            onClick={() => router.push('/subscription')}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            다시 시도
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3.5 rounded-xl border text-gray-600 font-medium text-sm"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">로딩중...</div></div>}>
      <FailContent />
    </Suspense>
  )
}
