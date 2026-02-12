import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')

  if (!sessionCookie) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  try {
    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())

    if (sessionData.exp < Date.now()) {
      return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 })
    }

    const { data: user, error } = await supabase.from('users').select('*').eq('id', sessionData.userId).single()

    if (error || !user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('세션 확인 에러:', error)
    return NextResponse.json({ error: '세션 확인 실패' }, { status: 500 })
  }
}
