import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!
const JWT_SECRET = process.env.JWT_SECRET || 'shouldercare-secret-key-2024'

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return null
    if (data.exp < Date.now()) return null
    return { userId: data.userId, email: data.email }
  } catch {
    return null
  }
}

function getAuthUser(req: NextRequest) {
  const cookie = req.cookies.get('session')
  if (cookie) {
    const verified = verifyToken(cookie.value)
    if (verified) return verified
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(authHeader.slice(7))
  }
  return null
}

// POST: 토스페이먼츠 결제 승인
export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  try {
    const { paymentKey, orderId, amount } = await req.json()

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 })
    }

    // 주문 검증: payment_history에서 orderId로 조회
    const { data: order } = await supabaseAdmin
      .from('payment_history')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.userId)
      .single()

    if (!order) {
      return NextResponse.json({ error: '주문 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (order.amount !== amount) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 400 })
    }

    if (order.status === 'PAID') {
      return NextResponse.json({ error: '이미 처리된 결제입니다' }, { status: 400 })
    }

    // 토스페이먼츠 결제 승인 요청
    const authString = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })

    const tossData = await tossRes.json()

    if (!tossRes.ok) {
      // 결제 승인 실패
      await supabaseAdmin
        .from('payment_history')
        .update({
          status: 'FAILED',
          toss_response: tossData,
        })
        .eq('id', order.id)

      return NextResponse.json(
        { error: tossData.message || '결제 승인에 실패했습니다', code: tossData.code },
        { status: 400 }
      )
    }

    // 결제 승인 성공 → DB 업데이트
    const now = new Date()
    const expiresAt = new Date(now)
    if (order.plan_type === 'YEARLY') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }

    // 1. payment_history 업데이트
    await supabaseAdmin
      .from('payment_history')
      .update({
        status: 'PAID',
        payment_key: paymentKey,
        method: tossData.method,
        paid_at: tossData.approvedAt || now.toISOString(),
        toss_response: tossData,
      })
      .eq('id', order.id)

    // 2. 기존 활성 구독 만료 처리
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'EXPIRED', updated_at: now.toISOString() })
      .eq('user_id', user.userId)
      .eq('status', 'ACTIVE')

    // 3. 새 구독 생성
    await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: user.userId,
        plan_type: order.plan_type,
        status: 'ACTIVE',
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: order.id,
      })

    // 4. users 테이블 구독 상태 업데이트
    await supabaseAdmin
      .from('users')
      .update({
        subscription_type: 'PREMIUM',
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', user.userId)

    return NextResponse.json({
      success: true,
      subscription: {
        plan_type: order.plan_type,
        expires_at: expiresAt.toISOString(),
      },
    })
  } catch (err: any) {
    console.error('Payment confirm error:', err)
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST /api/payments/confirm?action=create_order
// 결제 전 주문 생성 (금액 검증용)
export async function PUT(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  try {
    const { planType } = await req.json()

    const plans: Record<string, { amount: number; label: string }> = {
      MONTHLY: { amount: 9900, label: '프리미엄 월간' },
      YEARLY: { amount: 94800, label: '프리미엄 연간' },
    }

    const plan = plans[planType]
    if (!plan) {
      return NextResponse.json({ error: '잘못된 플랜입니다' }, { status: 400 })
    }

    const orderId = `SC_${user.userId.slice(0, 8)}_${Date.now()}`

    const { data, error } = await supabaseAdmin
      .from('payment_history')
      .insert({
        user_id: user.userId,
        order_id: orderId,
        plan_type: planType,
        amount: plan.amount,
        status: 'PENDING',
      })
      .select('id, order_id, amount')
      .single()

    if (error) {
      console.error('Create order error:', error)
      return NextResponse.json({ error: '주문 생성 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      orderId: data.order_id,
      amount: data.amount,
      orderName: `ShoulderCare ${plan.label}`,
    })
  } catch (err: any) {
    console.error('Create order error:', err)
    return NextResponse.json({ error: '주문 생성 중 오류' }, { status: 500 })
  }
}
