'use client'

import { fetchWithAuth } from '@/lib/fetch-auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState('')
  const [planType, setPlanType] = useState('')

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !orderId || !amount) {
      setStatus('error')
      setErrorMsg('결제 정보가 올바르지 않습니다')
      return
    }

    confirmPayment(paymentKey, orderId, Number(amount))
  }, [searchParams])

  const confirmPayment = async (paymentKey: string, orderId: string, amount: number) => {
    try {
      const res = await fetchWithAuth('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      })

      const data = await res.json()

      if (data.success) {
        setStatus('success')
        setPlanType(data.subscription?.plan_type || '')
      } else {
        setStatus('error')
        setErrorMsg(data.error || '결제 승인에 실패했습니다')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg('결제 처리 중 오류가 발생했습니다')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm w-full max-w-sm p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">결제 처리 중</h2>
            <p className="text-sm text-gray-500">잠시만 기다려주세요...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 완료!</h2>
            <p className="text-sm text-gray-500 mb-6">
              프리미엄 {planType === 'YEARLY' ? '연간' : '월간'} 구독이 활성화되었습니다.
            </p>

            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left space-y-1.5">
              <p className="text-sm text-gray-700 flex items-center gap-2">✅ 트레이너 1:1 메시지</p>
              <p className="text-sm text-gray-700 flex items-center gap-2">✅ 운동 영상 업로드 + 피드백</p>
              <p className="text-sm text-gray-700 flex items-center gap-2">✅ 맞춤 운동 프로그램</p>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
            >
              대시보드로 이동
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 실패</h2>
            <p className="text-sm text-red-500 mb-6">{errorMsg}</p>

            <div className="space-y-2">
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
          </>
        )}
      </div>
    </div>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SuccessContent />
    </Suspense>
  )
}
