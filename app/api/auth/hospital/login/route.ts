import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// SHA-256 (하위호환용 — 기존 해시 비교)
function sha256Hash(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function generateHospitalToken(hospitalId: string, email: string): string {
  const payload = {
    hospitalId,
    email,
    type: 'hospital_admin',
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    iat: Date.now(),
  }
  const secret = process.env.JWT_SECRET
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data: payload, sig: signature })).toString('base64url')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    const { data: hospital, error: dbError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('admin_email', email.toLowerCase().trim())
      .eq('contract_status', 'active')
      .single()

    if (dbError || !hospital) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    if (!hospital.admin_password_hash) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // bcrypt 해시인지 SHA-256 해시인지 판별
    const storedHash = hospital.admin_password_hash
    let passwordValid = false

    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
      // bcrypt 해시
      passwordValid = await bcrypt.compare(password, storedHash)
    } else {
      // SHA-256 해시 (하위호환)
      passwordValid = storedHash === sha256Hash(password)

      // 검증 성공 시 bcrypt로 자동 마이그레이션
      if (passwordValid) {
        const bcryptHash = await bcrypt.hash(password, 10)
        await supabase
          .from('hospitals')
          .update({ admin_password_hash: bcryptHash })
          .eq('id', hospital.id)
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const token = generateHospitalToken(hospital.id, email)

    const response = NextResponse.json({
      success: true,
      token,
      hospital: {
        id: hospital.id,
        name: hospital.name,
        prefix: hospital.prefix,
        plan_type: hospital.plan_type,
        contract_status: hospital.contract_status,
        admin_email: hospital.admin_email,
        phone: hospital.phone,
        address: hospital.address,
        contract_start: hospital.contract_start,
        contract_end: hospital.contract_end,
      },
    })

    response.cookies.set('hospital_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    response.cookies.set('hospital_id', hospital.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    console.error('Hospital login error:', error)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
