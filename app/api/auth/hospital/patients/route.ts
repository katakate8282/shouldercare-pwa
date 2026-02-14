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

function getHospitalId(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyHospitalToken(authHeader.substring(7))
    if (payload) return payload.hospitalId
  }
  const sessionCookie = request.cookies.get('hospital_session')
  if (sessionCookie) {
    const payload = verifyHospitalToken(sessionCookie.value)
    if (payload) return payload.hospitalId
  }
  return null
}

// GET: 병원 소속 환자 목록
export async function GET(request: NextRequest) {
  try {
    const hospitalId = getHospitalId(request)
    if (!hospitalId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: patients, error } = await supabase
      .from('hospital_patients')
      .select(`
        id,
        hospital_code,
        patient_name,
        patient_phone,
        diagnosis,
        surgery_name,
        assigned_trainer_id,
        program_start_date,
        program_end_date,
        program_status,
        is_active,
        notes,
        created_at,
        user_id
      `)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Patients fetch error:', error)
      return NextResponse.json({ error: '환자 목록 조회 실패' }, { status: 500 })
    }

    // 배정된 트레이너 정보 조회
    const trainerIds = [...new Set((patients || []).filter(p => p.assigned_trainer_id).map(p => p.assigned_trainer_id))]
    let trainersMap: Record<string, { name: string; email: string }> = {}

    if (trainerIds.length > 0) {
      const { data: trainers } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', trainerIds)

      if (trainers) {
        trainersMap = Object.fromEntries(trainers.map(t => [t.id, { name: t.name, email: t.email }]))
      }
    }

    // 연결된 유저 정보 조회
    const userIds = [...new Set((patients || []).filter(p => p.user_id).map(p => p.user_id))]
    let usersMap: Record<string, { name: string; email: string }> = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)

      if (users) {
        usersMap = Object.fromEntries(users.map(u => [u.id, { name: u.name, email: u.email }]))
      }
    }

    // 프로그램 주차 계산 (program_start_date 기준)
    const enrichedPatients = (patients || []).map(p => {
      let program_week = null
      if (p.program_start_date) {
        const startDate = new Date(p.program_start_date)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        program_week = Math.min(Math.max(Math.ceil(diffDays / 7), 1), 12)
      }

      return {
        ...p,
        program_week,
        assigned_trainer: p.assigned_trainer_id ? trainersMap[p.assigned_trainer_id] || null : null,
        linked_user: p.user_id ? usersMap[p.user_id] || null : null,
      }
    })

    return NextResponse.json({ patients: enrichedPatients })
  } catch (error) {
    console.error('Patients API error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// POST: 새 환자 등록
export async function POST(request: NextRequest) {
  try {
    const hospitalId = getHospitalId(request)
    if (!hospitalId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { patient_name, patient_phone, diagnosis, surgery_name, assigned_trainer_id, notes } = body

    if (!patient_name || !patient_phone) {
      return NextResponse.json({ error: '환자 이름과 전화번호는 필수입니다.' }, { status: 400 })
    }

    // 병원 프리픽스 조회
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('prefix')
      .eq('id', hospitalId)
      .single()

    if (!hospital) {
      return NextResponse.json({ error: '병원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 병원코드 생성: PREFIX-전화번호뒤8자리
    const phoneDigits = patient_phone.replace(/[^0-9]/g, '')
    const last8 = phoneDigits.slice(-8)
    const hospitalCode = `${hospital.prefix}-${last8}`

    // 중복 확인
    const { data: existing } = await supabase
      .from('hospital_patients')
      .select('id')
      .eq('hospital_id', hospitalId)
      .eq('hospital_code', hospitalCode)
      .single()

    if (existing) {
      return NextResponse.json({ error: '이미 등록된 환자입니다.' }, { status: 409 })
    }

    const now = new Date().toISOString()

    const { data: newPatient, error } = await supabase
      .from('hospital_patients')
      .insert({
        hospital_id: hospitalId,
        hospital_code: hospitalCode,
        patient_name,
        patient_phone: phoneDigits,
        diagnosis: diagnosis || null,
        surgery_name: surgery_name || null,
        assigned_trainer_id: assigned_trainer_id || null,
        program_start_date: now,
        program_status: 'active',
        is_active: true,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Patient insert error:', error)
      return NextResponse.json({ error: '환자 등록 실패: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, patient: newPatient, hospital_code: hospitalCode })
  } catch (error) {
    console.error('Patient registration error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// PATCH: 환자 정보 수정
export async function PATCH(request: NextRequest) {
  try {
    const hospitalId = getHospitalId(request)
    if (!hospitalId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { patient_id, ...updates } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id가 필요합니다.' }, { status: 400 })
    }

    const allowedFields = ['patient_name', 'diagnosis', 'surgery_name', 'assigned_trainer_id', 'program_status', 'is_active', 'notes']
    const safeUpdates: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in updates) safeUpdates[key] = updates[key]
    }
    safeUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('hospital_patients')
      .update(safeUpdates)
      .eq('id', patient_id)
      .eq('hospital_id', hospitalId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '수정 실패: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, patient: data })
  } catch (error) {
    console.error('Patient update error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
