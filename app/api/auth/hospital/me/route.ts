import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function verifyHospitalToken(token: string): { hospitalId: string; email: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded

    const secret = process.env.JWT_SECRET as string
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')

    if (sig !== expectedSig) return null
    if (data.exp < Date.now()) return null
    if (data.type !== 'hospital_admin') return null

    return { hospitalId: data.hospitalId, email: data.email }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization 헤더
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const payload = verifyHospitalToken(token)

      if (payload) {
        const { data: hospital, error } = await supabase
          .from('hospitals')
          .select('id, name, prefix, plan_type, contract_status, admin_email, phone, address, contract_start, contract_end')
          .eq('id', payload.hospitalId)
          .eq('contract_status', 'active')
          .single()

        if (!error && hospital) {
          return NextResponse.json({ hospital })
        }
      }
      return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 })
    }

    // 2. Fallback: 쿠키
    const sessionCookie = request.cookies.get('hospital_session')
    if (sessionCookie) {
      const payload = verifyHospitalToken(sessionCookie.value)
      if (payload) {
        const { data: hospital, error } = await supabase
          .from('hospitals')
          .select('id, name, prefix, plan_type, contract_status, admin_email, phone, address, contract_start, contract_end')
          .eq('id', payload.hospitalId)
          .eq('contract_status', 'active')
          .single()

        if (!error && hospital) {
          return NextResponse.json({ hospital })
        }
      }
    }

    return NextResponse.json({ hospital: null }, { status: 401 })
  } catch (error) {
    console.error('Hospital session error:', error)
    return NextResponse.json({ error: '세션 확인 실패' }, { status: 500 })
  }
}
