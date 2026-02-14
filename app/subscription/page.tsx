'use client'

import { fetchAuthMe, fetchWithAuth } from '@/lib/fetch-auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { checkSubscription, getSubscriptionLabel } from '@/lib/subscription'
import BottomNav from '@/components/BottomNav'

interface User {
  id: string
  name: string
  email: string
  role?: string
  subscription_type?: string
  subscription_expires_at?: string | null
}

const PLANS = {
  MONTHLY: {
    id: 'MONTHLY',
    name: '월간 구독',
    price: 9900,
    priceLabel: '9,900',
    period: '월',
    description: '매월 자동 결제',
    badge: null,
  },
  YEARLY: {
    id: 'YEARLY',
    name: '연간 구독',
    price: 94800,
    priceLabel: '94,800',
    period: '년',
    description: '월 7,900원 (20% 할인)',
    badge: '20% 할인',
    monthlyEquivalent: '7,900',
  },
}

function SubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'YEARLY'>('YEARLY')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  // 토스페이먼츠 SDK 로드
  useEffect(() => {
    if (document.getElementById('toss-payments-sdk')) return
    const script = document.createElement('script')
    script.id = 'toss-payments-sdk'
    script.src = 'https://js.tosspayments.com/v1/payment'
    script.async = true
    document.head.appendChild(script)
  }, [])

  const handlePayment = async () => {
    if (!user || processing) return
    setProcessing(true)

    try {
      // 1. 주문 생성
      const orderRes = await fetchWithAuth('/api/payments/confirm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: selectedPlan }),
      })

      const orderData = await orderRes.json()

      if (!orderData.success) {
        alert(orderData.error || '주문 생성 실패')
        setProcessing(false)
        return
      }

      // 2. 토스페이먼츠 결제 위젯 호출
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
      if (!clientKey) {
        alert('결제 설정 오류')
        setProcessing(false)
        return
      }

      const tossPayments = (window as any).TossPayments(clientKey)

      await tossPayments.requestPayment('카드', {
        amount: orderData.amount,
        orderId: orderData.orderId,
        orderName: orderData.orderName,
        customerName: user.name,
        customerEmail: user.email,
        successUrl: `${window.location.origin}/subscription/success`,
        failUrl: `${window.location.origin}/subscription/fail`,
      })
    } catch (err: any) {
      if (err.code === 'USER_CANCEL') {
        // 사용자 취소 - 아무것도 안 함
      } else {
        console.error('Payment error:', err)
        alert('결제 중 오류가 발생했습니다')
      }
    }
    setProcessing(false)
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

  // 이미 프리미엄 구독 중
  if (subStatus.isPremium) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-gray-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">구독 관리</h1>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-sky-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👑</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">프리미엄 구독 중</h2>
            <p className="text-sm text-gray-500 mb-4">{getSubscriptionLabel(subStatus)}</p>

            {subStatus.expiresAt && (
              <div className="bg-blue-50 rounded-xl p-4 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">구독 유형</span>
                  <span className="font-medium text-gray-900">{subStatus.type === 'PREMIUM' ? '프리미엄' : subStatus.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">만료일</span>
                  <span className="font-medium text-gray-900">{subStatus.expiresAt.toLocaleDateString('ko-KR')}</span>
                </div>
                {subStatus.daysLeft !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">남은 일수</span>
                    <span className="font-medium text-blue-600">{subStatus.daysLeft}일</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-2">
              <div className="text-left text-sm text-gray-700 space-y-1.5">
                <p className="flex items-center gap-2">✅ 트레이너 1:1 메시지</p>
                <p className="flex items-center gap-2">✅ 운동 영상 업로드 + 피드백</p>
                <p className="flex items-center gap-2">✅ 맞춤 운동 프로그램</p>
                <p className="flex items-center gap-2">✅ AI 자가테스트</p>
                <p className="flex items-center gap-2">✅ 주간 리포트</p>
              </div>
            </div>
          </div>
        </main>

        <BottomNav role="patient" unreadCount={0} />
      </div>
    )
  }

  // 무료 사용자 → 구독 선택 화면
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">프리미엄 구독</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* 혜택 소개 */}
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-sky-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">✨</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">더 나은 재활을 위해</h2>
          <p className="text-sm text-gray-500">전문 트레이너와 함께하는 맞춤형 케어</p>
        </div>

        {/* 무료 vs 프리미엄 비교 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-3 text-center text-xs font-medium border-b">
            <div className="py-3 text-gray-500">기능</div>
            <div className="py-3 text-gray-500 bg-gray-50">무료</div>
            <div className="py-3 text-white bg-gradient-to-r from-blue-500 to-sky-400">프리미엄</div>
          </div>
          {[
            { name: 'AI 자가테스트', free: true, premium: true },
            { name: '기본 운동', free: true, premium: true },
            { name: '주간 리포트', free: true, premium: true },
            { name: '1:1 메시지', free: false, premium: true },
            { name: '영상 피드백', free: false, premium: true },
            { name: '맞춤 프로그램', free: false, premium: true },
          ].map((feature, idx) => (
            <div key={idx} className="grid grid-cols-3 text-center text-sm border-b last:border-0">
              <div className="py-3 text-gray-700 text-left pl-4">{feature.name}</div>
              <div className="py-3 bg-gray-50">{feature.free ? '✅' : '—'}</div>
              <div className="py-3">{feature.premium ? '✅' : '—'}</div>
            </div>
          ))}
        </div>

        {/* 플랜 선택 */}
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900">구독 플랜 선택</h3>

          {/* 연간 */}
          <button
            onClick={() => setSelectedPlan('YEARLY')}
            className={`w-full text-left rounded-2xl p-4 border-2 transition relative overflow-hidden ${
              selectedPlan === 'YEARLY'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            {PLANS.YEARLY.badge && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl">
                {PLANS.YEARLY.badge}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === 'YEARLY' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {selectedPlan === 'YEARLY' && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900">₩{PLANS.YEARLY.priceLabel}</span>
                  <span className="text-sm text-gray-500">/ {PLANS.YEARLY.period}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{PLANS.YEARLY.description}</p>
                <p className="text-xs text-blue-600 font-medium mt-0.5">
                  월 ₩{PLANS.YEARLY.monthlyEquivalent}으로 이용
                </p>
              </div>
            </div>
          </button>

          {/* 월간 */}
          <button
            onClick={() => setSelectedPlan('MONTHLY')}
            className={`w-full text-left rounded-2xl p-4 border-2 transition ${
              selectedPlan === 'MONTHLY'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === 'MONTHLY' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {selectedPlan === 'MONTHLY' && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900">₩{PLANS.MONTHLY.priceLabel}</span>
                  <span className="text-sm text-gray-500">/ {PLANS.MONTHLY.period}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{PLANS.MONTHLY.description}</p>
              </div>
            </div>
          </button>
        </div>

        {/* 결제 버튼 */}
        <button
          onClick={handlePayment}
          disabled={processing}
          className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-50 transition"
          style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              처리 중...
            </span>
          ) : (
            `₩${PLANS[selectedPlan].priceLabel} 결제하기`
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          결제 후 즉시 프리미엄 기능이 활성화됩니다.<br />
          구독은 만료일까지 유효하며, 언제든 해지할 수 있습니다.
        </p>
      </main>

      <BottomNav role="patient" unreadCount={0} />
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">로딩중...</div></div>}>
      <SubscriptionContent />
    </Suspense>
  )
}
