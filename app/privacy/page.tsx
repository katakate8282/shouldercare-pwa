'use client'
import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
  const router = useRouter()
  const content = `🔒 개인정보처리방침

1. 개인정보의 수집 항목 및 수집 방법
회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다:
- 필수 수집 항목: 카카오 계정 정보(이메일, 프로필 이름), 서비스 이용 기록
- 선택 수집 항목: 전화번호, 어깨 통증 정보, 운동 기록, 재활 진행 상황
- 자동 수집 항목: 접속 IP, 브라우저 종류, 접속 일시, 서비스 이용 기록

2. 개인정보의 수집 및 이용 목적
- 회원 가입 및 본인 인증
- 맞춤형 재활 운동 프로그램 제공
- 트레이너 매칭 및 운동 피드백 제공
- 제휴 병원과의 재활 정보 공유 (환자 동의 시)
- 서비스 개선 및 통계 분석
- 고객 문의 응대

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다.
- 단, 관계 법령에 따라 보존할 의무가 있는 경우 해당 기간 동안 보관합니다:
  · 계약 또는 청약 철회 기록: 5년
  · 대금 결제 및 재화 공급 기록: 5년
  · 소비자 불만 또는 분쟁 처리 기록: 3년
  · 접속 기록: 3개월

4. 개인정보의 제3자 제공
회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
단, 다음의 경우에는 예외로 합니다:
- 이용자가 사전에 동의한 경우 (제휴 병원과의 재활 정보 공유)
- 법령의 규정에 의한 경우
- 수사 목적으로 법령에 정해진 절차에 따른 요청이 있는 경우

5. 개인정보의 처리 위탁
회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다:
- Supabase (데이터 저장 및 관리)
- Vercel (서비스 호스팅)
- Firebase (푸시 알림 발송)
- 카카오 (로그인 인증)

6. 이용자의 권리
이용자는 언제든지 다음의 권리를 행사할 수 있습니다:
- 개인정보 열람 요구
- 개인정보 정정 및 삭제 요구
- 개인정보 처리 정지 요구
- 회원 탈퇴 요구

7. 개인정보의 안전성 확보 조치
회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
- 비밀번호 암호화 (bcrypt)
- SSL/TLS 암호화 통신
- 개인정보 접근 권한 관리
- 정기적인 보안 점검

8. 개인정보 보호책임자
- 성명: [개인정보 보호책임자명]
- 연락처: support@shouldercare.kr

9. 개인정보처리방침의 변경
본 개인정보처리방침은 법령 및 회사 정책 변경에 따라 개정될 수 있으며, 변경 시 앱 내 공지사항을 통해 7일 전에 공지합니다.

시행일: 2026년 2월 13일`

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600"><span className="text-2xl">←</span></button>
          <h1 className="text-xl font-bold text-gray-900">개인정보처리방침</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {content.split('\n').map((line, i) => {
            const l = line.trim()
            if (!l) return <div key={i} className="h-3" />
            if (l.startsWith('🔒')) return <h2 key={i} className="text-lg font-bold text-blue-600 mb-3">{l}</h2>
            if (/^\d+\./.test(l) && l.length < 40) return <h3 key={i} className="text-base font-bold text-gray-900 mt-5 mb-2">{l}</h3>
            if (l.startsWith('-') || l.startsWith('·')) return <p key={i} className="text-sm text-gray-700 pl-4 mb-1">{l}</p>
            if (l.startsWith('시행일')) return <p key={i} className="text-xs text-gray-400 mt-6">{l}</p>
            return <p key={i} className="text-sm text-gray-700 mb-2 leading-relaxed">{l}</p>
          })}
        </div>
      </main>
    </div>
  )
}
