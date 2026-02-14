import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as jose from 'jose'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const cookieStore = cookies()
  const token = cookieStore.get('sc_token')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)
    return payload as any
  } catch {
    return null
  }
}

// 주간 리포트 HTML 생성
function generateWeeklyReportHTML(report: any, user: any) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 600px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 22px; color: #667eea; margin-bottom: 4px; }
  .header p { font-size: 12px; color: #888; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: #1a1a1a; border-left: 3px solid #667eea; padding-left: 10px; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .stat-box { background: #f7f8fc; border-radius: 8px; padding: 14px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: 700; color: #667eea; }
  .stat-label { font-size: 11px; color: #888; margin-top: 4px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .row .label { color: #888; }
  .row .value { font-weight: 600; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
  .positive { color: #38a169; }
  .negative { color: #e53e3e; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>🏥 어깨케어 주간 리포트</h1>
    <p>${user.name || '환자'}님 · ${report.week_start} ~ ${report.week_end}</p>
  </div>

  <div class="section">
    <h2>💪 운동 현황</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${report.exercise_completion_rate}%</div>
        <div class="stat-label">운동 완료율</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${report.exercise_days}일</div>
        <div class="stat-label">운동한 날</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${report.total_exercises}회</div>
        <div class="stat-label">총 운동</div>
      </div>
    </div>
  </div>

  ${report.pain_average !== null ? `
  <div class="section">
    <h2>📊 통증 변화</h2>
    <div class="row"><span class="label">평균 통증</span><span class="value">${report.pain_average} / 10</span></div>
    <div class="row"><span class="label">주간 변화</span><span class="value ${report.pain_change < 0 ? 'positive' : report.pain_change > 0 ? 'negative' : ''}">${report.pain_change !== null ? (report.pain_change < 0 ? `${Math.abs(report.pain_change)}점 감소 ✅` : report.pain_change > 0 ? `${report.pain_change}점 증가 ⚠️` : '변화 없음') : '-'}</span></div>
    <div class="row"><span class="label">통증 기록 횟수</span><span class="value">${report.pain_logs_count}건</span></div>
  </div>
  ` : ''}

  <div class="section">
    <h2>📝 활동 요약</h2>
    <div class="row"><span class="label">새 운동 제안</span><span class="value">${report.prescription_count}건</span></div>
    <div class="row"><span class="label">트레이너 메시지</span><span class="value">${report.message_count}건</span></div>
  </div>

  <div class="footer">
    어깨케어 (ShoulderCare) · 생성일: ${new Date().toLocaleDateString('ko-KR')}<br>
    본 리포트는 참고용이며, 의료적 판단을 대체하지 않습니다.
  </div>
</body>
</html>`
}

// 병원 청구서 HTML 생성
function generateInvoiceHTML(invoice: any, hospital: any) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 600px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 22px; color: #667eea; }
  .header p { font-size: 12px; color: #888; margin-top: 4px; }
  .info { margin-bottom: 24px; font-size: 13px; }
  .info .row { display: flex; justify-content: space-between; padding: 6px 0; }
  .info .label { color: #888; }
  .info .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th { background: #f7f8fc; padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
  td { padding: 10px; border-bottom: 1px solid #eee; }
  td:last-child, th:last-child { text-align: right; }
  .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #667eea; color: #667eea; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>📄 월간 청구서</h1>
    <p>${invoice.billing_month} · ${hospital.name || ''}</p>
  </div>

  <div class="info">
    <div class="row"><span class="label">병원명</span><span class="value">${hospital.name || '-'}</span></div>
    <div class="row"><span class="label">사업자번호</span><span class="value">${hospital.business_number || '-'}</span></div>
    <div class="row"><span class="label">청구 월</span><span class="value">${invoice.billing_month}</span></div>
    <div class="row"><span class="label">플랜</span><span class="value">${invoice.plan_type === 'premium' ? '프리미엄' : '베이직'}</span></div>
  </div>

  <table>
    <thead>
      <tr><th>항목</th><th>금액</th></tr>
    </thead>
    <tbody>
      <tr><td>기본료 (${invoice.included_patients}명 포함)</td><td>₩${invoice.base_fee?.toLocaleString()}</td></tr>
      <tr><td>활성 환자</td><td>${invoice.active_patients}명</td></tr>
      ${invoice.extra_patients > 0 ? `<tr><td>초과 환자 (${invoice.extra_patients}명 × ₩${invoice.extra_fee_per_patient?.toLocaleString()})</td><td>₩${invoice.extra_total?.toLocaleString()}</td></tr>` : ''}
      <tr><td>소계</td><td>₩${invoice.total_amount?.toLocaleString()}</td></tr>
      <tr><td>VAT (10%)</td><td>₩${invoice.vat?.toLocaleString()}</td></tr>
      <tr class="total-row"><td>합계</td><td>₩${invoice.grand_total?.toLocaleString()}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    어깨케어 (ShoulderCare) · 발행일: ${new Date().toLocaleDateString('ko-KR')}<br>
    문의: support@shouldercare.kr
  </div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'weekly' or 'invoice'
  const id = searchParams.get('id')

  if (!type) {
    return NextResponse.json({ error: 'type parameter required' }, { status: 400 })
  }

  let html = ''

  if (type === 'weekly') {
    // 주간 리포트
    let query = supabase.from('weekly_reports').select('*')
    
    if (id) {
      query = query.eq('id', id)
    } else {
      query = query.eq('user_id', user.userId).order('week_start', { ascending: false }).limit(1)
    }

    const { data: report } = await query.single()
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const { data: userData } = await supabase.from('users').select('name').eq('id', report.user_id).single()

    html = generateWeeklyReportHTML(report, userData || { name: '환자' })
  } else if (type === 'invoice') {
    // 청구서
    if (!id) return NextResponse.json({ error: 'id required for invoice' }, { status: 400 })

    const { data: invoice } = await supabase.from('hospital_invoices').select('*').eq('id', id).single()
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const { data: hospital } = await supabase.from('hospitals').select('name, business_number').eq('id', invoice.hospital_id).single()

    html = generateInvoiceHTML(invoice, hospital || { name: '-' })
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  // HTML 응답 (브라우저에서 인쇄→PDF 가능)
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
