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
    const secret = process.env.TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'shouldercare-secret'
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

// GET: 병원 소속 트레이너 목록
export async function GET(request: NextRequest) {
  try {
    const hospitalId = getHospitalId(request)
    if (!hospitalId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // trainer_affiliation이 이 병원 ID인 트레이너 조회
    const { data: trainers, error } = await supabase
      .from('users')
      .select('id, name, email, created_at, trainer_affiliation')
      .eq('role', 'trainer')
      .eq('trainer_affiliation', hospitalId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Trainers fetch error:', error)
      return NextResponse.json({ error: '트레이너 목록 조회 실패' }, { status: 500 })
    }

    // 각 트레이너의 담당 환자 수 조회
    const trainerIds = (trainers || []).map(t => t.id)
    let patientCounts: Record<string, number> = {}

    if (trainerIds.length > 0) {
      const { data: assignments } = await supabase
        .from('hospital_patients')
        .select('assigned_trainer_id')
        .eq('hospital_id', hospitalId)
        .eq('status', 'active')
        .in('assigned_trainer_id', trainerIds)

      if (assignments) {
        for (const a of assignments) {
          if (a.assigned_trainer_id) {
            patientCounts[a.assigned_trainer_id] = (patientCounts[a.assigned_trainer_id] || 0) + 1
          }
        }
      }
    }

    const enrichedTrainers = (trainers || []).map(t => ({
      ...t,
      active_patient_count: patientCounts[t.id] || 0,
    }))

    return NextResponse.json({ trainers: enrichedTrainers })
  } catch (error) {
    console.error('Trainers API error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
