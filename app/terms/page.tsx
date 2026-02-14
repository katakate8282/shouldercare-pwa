'use client'
import { useRouter } from 'next/navigation'

export default function TermsPage() {
  const router = useRouter()
  const content = `📜 이용약관

제1조 (목적)
본 약관은 [법인명] (이하 "회사")이 제공하는 어깨케어(ShoulderCare) 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 어깨 재활 운동 가이드, AI 모션 트래킹, 트레이너 피드백, 운동 기록 관리 등의 디지털 헬스케어 서비스를 의미합니다.
2. "이용자"란 본 약관에 동의하고 서비스를 이용하는 모든 회원 및 비회원을 의미합니다.
3. "회원"이란 회사에 개인정보를 제공하고 회원 등록을 한 자로서, 서비스를 계속적으로 이용할 수 있는 자를 의미합니다.
4. "콘텐츠"란 서비스 내에서 제공되는 운동 영상, 재활 프로그램, 운동 설명, 교육 자료 등 일체의 정보와 자료를 의미합니다.
5. "트레이너"란 회사와 계약을 체결하고 회원에게 운동 자세 피드백 및 동기부여를 제공하는 스포츠재활 전문가를 의미합니다.
6. "제휴 병원"이란 회사와 서비스 제공 계약을 체결한 의료기관을 의미합니다.

제3조 (약관의 명시 및 변경)
1. 회사는 본 약관의 내용을 이용자가 쉽게 확인할 수 있도록 서비스 초기 화면 및 설정 메뉴에 게시합니다.
2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경된 약관은 시행일로부터 7일 전에 공지합니다.
3. 이용자가 변경된 약관에 동의하지 않을 경우, 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.

제4조 (서비스의 성격 및 범위)
1. 서비스는 의료행위가 아닙니다. 본 서비스는 재활 운동 가이드를 제공하는 보조 도구로, 의사의 진료·진단·처방·치료를 대체할 수 없습니다.
2. 서비스에서 제공하는 운동 프로토콜은 정형외과 전문의, 물리치료사, 스포츠재활 전문가의 감수를 받았으나, 개별 이용자의 의학적 상태를 진단하거나 치료 계획을 수립하지 않습니다.
3. 이용자는 서비스 이용 전 반드시 담당 의사와 상담하고, 운동 프로그램이 본인의 건강 상태에 적합한지 확인해야 합니다.

제5조 (회원가입)
1. 이용자는 회사가 정한 가입 양식에 따라 회원 정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.
2. 회원가입은 카카오 로그인을 통해 이루어지며, 카카오 계정 정보가 회원 식별에 사용됩니다.

제6조 (회원 등급 및 서비스 이용)
- UNSUBSCRIBED (무료 회원): 프로그램 열람만 가능
- TRIAL (무료체험 회원): 가입 후 7일간 전체 기능 이용 가능
- PLATINUM_PATIENT (병원 환자 회원): 제휴 병원 코드로 활성화, 12주간 전체 기능 무료 이용
- PREMIUM (프리미엄 회원): 월 9,900원, 전체 기능 이용 가능

제7조 (유료 서비스 이용 및 결제)
1. 유료 서비스의 이용 요금 및 결제 방식은 해당 서비스에 별도로 명시합니다.
2. 결제는 신용카드, 체크카드 등 회사가 정한 결제 수단을 통해 이루어집니다.

제8조 (청약 철회 및 환불)
1. 이용자는 유료 서비스 결제일로부터 7일 이내에 청약 철회를 요청할 수 있습니다.
2. 단, 이미 서비스를 사용한 경우에는 환불 금액에서 이용일수에 해당하는 금액을 차감합니다.

제9조 (회사의 의무)
1. 회사는 관련 법령과 본 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며, 계속적이고 안정적인 서비스 제공에 노력합니다.
2. 회사는 이용자의 개인정보 보호를 위해 개인정보처리방침을 수립하고 이를 준수합니다.

제10조 (이용자의 의무)
이용자는 서비스 이용 시 다음 행위를 하여서는 안 됩니다:
- 타인의 정보를 부정 사용하는 행위
- 회사가 제공하는 서비스를 이용하여 영리 목적의 활동을 하는 행위
- 서비스의 안정적 운영을 방해하는 행위

제11조 (면책사항)
1. 서비스는 의료 서비스가 아니며, 서비스 이용으로 인한 건강 상의 문제에 대해 회사는 책임을 지지 않습니다.
2. 이용자는 운동 시작 전 반드시 담당 의사의 승인을 받아야 합니다.

제12조 (분쟁 해결)
본 약관에서 정하지 아니한 사항과 약관의 해석에 관하여는 관계 법령에 따릅니다.

작성일: 2026년 2월 13일`

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600"><span className="text-2xl">←</span></button>
          <h1 className="text-xl font-bold text-gray-900">이용약관</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {content.split('\n').map((line, i) => {
            const l = line.trim()
            if (!l) return <div key={i} className="h-3" />
            if (l.startsWith('📜')) return <h2 key={i} className="text-lg font-bold text-blue-600 mb-3">{l}</h2>
            if (l.startsWith('제') && l.includes('조')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-5 mb-2">{l}</h3>
            if (l.startsWith('-')) return <p key={i} className="text-sm text-gray-700 pl-4 mb-1">{l}</p>
            if (l.startsWith('작성일')) return <p key={i} className="text-xs text-gray-400 mt-6">{l}</p>
            return <p key={i} className="text-sm text-gray-700 mb-2 leading-relaxed">{l}</p>
          })}
        </div>
      </main>
    </div>
  )
}
