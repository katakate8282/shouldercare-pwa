import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: '코드를 입력해주세요.' }, { status: 400 })
    }

    // 코드 형식 검증: XXX-XXXXXXXX (앞 3자리-뒤 8자리)
    const codeRegex = /^([A-Z]{3})-(\d{8})$/
    const match = code.match(codeRegex)

    if (!match) {
      return NextResponse.json({ error: '올바른 코드 형식이 아닙니다. (예: PLT-67967963)' }, { status: 400 })
    }

    const hospitalId = match[1] // PLT
    const phoneDigits = match[2] // 67967963

    // 병원 존재 여부 확인
    const { data: hospital, error } = await supabase
      .from('hospitals')
      .select('id, name')
      .eq('id', hospitalId)
      .single()

    if (error || !hospital) {
      return NextResponse.json({ error: '등록되지 않은 병원 코드입니다.' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      phoneDigits,
    })
  } catch (error) {
    console.error('Hospital code verify error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
