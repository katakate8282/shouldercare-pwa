import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    token = req.cookies.get('session')?.value || null
  }
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET as string
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return null
    if (data.exp && data.exp * 1000 < Date.now()) return null
    return { id: data.userId, email: data.email }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { confirmText } = body

    if (confirmText !== '탈퇴합니다') {
      return NextResponse.json({ error: '탈퇴 확인 문구가 일치하지 않습니다.' }, { status: 400 })
    }

    // 1. 구독 해지
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', auto_renew: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    // 2. 업로드 영상 스토리지 삭제
    const { data: videos } = await supabaseAdmin
      .from('user_exercise_videos')
      .select('storage_path')
      .eq('user_id', user.id)

    if (videos && videos.length > 0) {
      const paths = videos.map(v => v.storage_path).filter(Boolean)
      if (paths.length > 0) {
        await supabaseAdmin.storage.from('user-videos').remove(paths)
      }
    }

    // 3. 영상 레코드 삭제
    await supabaseAdmin
      .from('user_exercise_videos')
      .delete()
      .eq('user_id', user.id)

    // 4. 메시지 삭제
    await supabaseAdmin
      .from('messages')
      .delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

    // 5. 사용자 개인정보 익명화
    const anonymizedEmail = `withdrawn_${user.id.slice(0, 8)}@deleted.local`
    await supabaseAdmin
      .from('users')
      .update({
        name: '탈퇴한 회원',
        email: anonymizedEmail,
        password_hash: null,
        phone: null,
        subscription_type: null,
        subscription_expires_at: null,
        hospital_id: null,
        role: 'withdrawn',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    // 6. 세션 쿠키 삭제
    const response = NextResponse.json({ success: true, message: '회원 탈퇴가 완료되었습니다.' })
    response.cookies.set('session', '', { maxAge: 0, path: '/' })

    return response
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: '탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
