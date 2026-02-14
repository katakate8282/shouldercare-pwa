import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded
    const secret = process.env.JWT_SECRET as string
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return null
    if (data.exp < Date.now()) return null
    return { userId: data.userId, email: data.email }
  } catch {
    return null
  }
}

function getUserId(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.substring(7))
    if (payload) return payload.userId
  }
  const sessionCookie = request.cookies.get('session')
  if (sessionCookie) {
    const payload = verifyToken(sessionCookie.value)
    if (payload) return payload.userId
  }
  return null
}

// POST: 기존 유저가 병원코드를 입력하여 연결
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: '병원코드를 입력해주세요.' }, { status: 400 })
    }

    // 코드 형식 검증: XXX-XXXXXXXX
    const codeRegex = /^([A-Z]{3})-(\d{8})$/
    const match = code.toUpperCase().match(codeRegex)
    if (!match) {
      return NextResponse.json({ error: '올바른 코드 형식이 아닙니다. (예: PLT-12345678)' }, { status: 400 })
    }

    const prefix = match[1]
    const phoneDigits = match[2]
    const hospitalCode = `${prefix}-${phoneDigits}`

    // hospital_patients에서 해당 코드 찾기
    const { data: hospitalPatient, error: hpError } = await supabase
      .from('hospital_patients')
      .select('id, hospital_id, program_status, user_id')
      .eq('hospital_code', hospitalCode)
      .single()

    if (hpError || !hospitalPatient) {
      return NextResponse.json({ error: '등록되지 않은 병원코드입니다. 병원에 문의해주세요.' }, { status: 404 })
    }

    if (hospitalPatient.user_id && hospitalPatient.user_id !== userId) {
      return NextResponse.json({ error: '이미 다른 계정에 연결된 코드입니다.' }, { status: 409 })
    }

    if (hospitalPatient.user_id === userId) {
      return NextResponse.json({ error: '이미 연결된 코드입니다.' }, { status: 409 })
    }

    // 병원 정보 조회
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('id, name, contract_status')
      .eq('id', hospitalPatient.hospital_id)
      .single()

    if (!hospital || hospital.contract_status !== 'active') {
      return NextResponse.json({ error: '해당 병원의 계약이 만료되었습니다.' }, { status: 400 })
    }

    // hospital_patients에 user_id 연결
    await supabase
      .from('hospital_patients')
      .update({ user_id: userId })
      .eq('id', hospitalPatient.id)

    // users 테이블 업데이트
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 84) // 12주

    await supabase
      .from('users')
      .update({
        hospital_id: hospitalPatient.hospital_id,
        hospital_code: hospitalCode,
        active_hospital_patient_id: hospitalPatient.id,
        subscription_type: 'PLATINUM_PATIENT',
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      hospital_name: hospital.name,
      hospital_code: hospitalCode,
      message: `${hospital.name}에 연결되었습니다. 12주 무료 재활 프로그램이 시작됩니다!`,
    })
  } catch (error) {
    console.error('Link hospital code error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// GET: 현재 유저의 병원 연결 상태 조회
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('hospital_id, hospital_code, active_hospital_patient_id')
      .eq('id', userId)
      .single()

    if (!user || !user.hospital_id) {
      return NextResponse.json({ linked: false })
    }

    // 병원 정보
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('id, name, prefix, plan_type')
      .eq('id', user.hospital_id)
      .single()

    // hospital_patients 정보
    let patientInfo = null
    if (user.active_hospital_patient_id) {
      const { data: hp } = await supabase
        .from('hospital_patients')
        .select('program_start_date, program_end_date, diagnosis, surgery_name, program_status, assigned_trainer_id')
        .eq('id', user.active_hospital_patient_id)
        .single()

      if (hp) {
        // 주차 계산
        let program_week = null
        if (hp.program_start_date) {
          const startDate = new Date(hp.program_start_date)
          const now = new Date()
          const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          program_week = Math.min(Math.max(Math.ceil(diffDays / 7), 1), 12)
        }

        let trainer_name = null
        if (hp.assigned_trainer_id) {
          const { data: trainer } = await supabase
            .from('users')
            .select('name')
            .eq('id', hp.assigned_trainer_id)
            .single()
          trainer_name = trainer?.name || null
        }
        patientInfo = { ...hp, program_week, trainer_name }
      }
    }

    return NextResponse.json({
      linked: true,
      hospital_code: user.hospital_code,
      hospital,
      patient: patientInfo,
    })
  } catch (error) {
    console.error('Hospital link status error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
