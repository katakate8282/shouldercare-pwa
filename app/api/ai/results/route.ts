import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/ai/results?userId=xxx → 이력 목록
// GET /api/ai/results?id=xxx → 단일 결과 상세
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    // 단일 결과 조회
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('self_test_results')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: '결과를 찾을 수 없습니다' }, { status: 404 })
      }

      return NextResponse.json({ result: data })
    }

    // 유저별 이력 목록
    if (userId) {
      const { data, error } = await supabaseAdmin
        .from('self_test_results')
        .select('id, estimated_condition, pain_intensity, see_doctor_flag, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Results fetch error:', error)
        return NextResponse.json({ error: '이력 조회 실패' }, { status: 500 })
      }

      return NextResponse.json({ results: data || [] })
    }

    return NextResponse.json({ error: 'userId 또는 id 파라미터가 필요합니다' }, { status: 400 })

  } catch (error: any) {
    console.error('Results API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
