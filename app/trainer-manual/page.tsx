'use client'
import { useRouter } from 'next/navigation'

export default function TrainerManualPage() {
  const router = useRouter()
  const content = `📋 어깨케어 트레이너 매뉴얼
작성일: 2026년 2월 13일

1. 트레이너의 역할

✅ 운동 자세 교정
- AI 분석 결과를 바탕으로 구체적인 자세 피드백
- 영상을 보고 잘못된 동작 교정
- 운동 효과를 높이는 팁 제공

✅ 운동 강도 조절
- 환자의 통증 수준과 진행 상황에 따라 강도 조절 제안
- 횟수, 세트, 빈도 조정

✅ 동기부여 및 격려
- 꾸준한 운동을 위한 긍정적 피드백
- 진행 상황 칭찬
- 목표 달성 축하

✅ 위험 신호 감지 및 보고
- 통증 악화, 부종, 신경 증상 등 즉시 의사 상담 권유
- 심각한 경우 제휴 병원에 즉시 보고

⚠️ 트레이너가 하지 않는 것
❌ 의학적 진단 ("오십견인 것 같아요" ❌)
❌ 치료 또는 처방 ("이 운동하면 낫습니다" ❌)
❌ 수술 권유 또는 반대 ("수술 받으세요" ❌)
❌ 약물 추천 ("진통제 드세요" ❌)

2. 채팅 응대 가이드

💬 기본 원칙
- 24시간 이내 응답 (영업일 기준)
- 존칭 사용 (반말 금지)
- 의학 용어 대신 쉬운 표현 사용
- 공감과 격려를 먼저, 교정은 부드럽게

💬 좋은 응답 예시
"오늘 운동 영상 잘 봤습니다! 전체적으로 자세가 많이 좋아지셨어요. 한 가지 팁을 드리자면, 팔을 올릴 때 어깨가 올라가지 않도록 의식해보세요."

💬 나쁜 응답 예시
"자세가 틀렸어요. 다시 하세요." (너무 직접적, 구체적 가이드 없음)

3. 영상 피드백 작성법

📝 피드백 구조
1) 칭찬 포인트 (잘한 점 먼저)
2) 개선 포인트 (1-2가지만 집중)
3) 구체적 방법 (어떻게 교정하는지)
4) 격려 마무리

📝 예시
"밴드 외회전 자세가 안정적이에요! 팔꿈치가 몸에 잘 붙어있습니다. 다만 손목이 약간 꺾이는 부분이 보이는데, 손목을 일자로 유지하면서 천천히 당겨보세요. 다음 영상도 기대하겠습니다!"

4. 금지 표현 및 주의사항

🚨 절대 금지 표현
- "~병입니다", "~증후군입니다" (진단)
- "수술이 필요합니다" (의료 판단)
- "이 운동하면 낫습니다" (치료 약속)
- "약 드세요" (약물 추천)
- "병원 안 가도 됩니다" (의료 대체)

✅ 올바른 표현
- "통증이 계속되시면 담당 의사 선생님과 상담해보시는 게 좋겠습니다"
- "운동 후 통증이 줄어드는 분들이 많습니다"
- "정확한 상태는 병원 검진을 통해 확인하시는 걸 권해드립니다"

5. 위험 신호 감지

🚨 즉시 운동 중단 + 병원 연락 권유
- 통증이 갑자기 심해진 경우 (8/10 이상)
- 팔이나 손에 저림/무감각이 있는 경우
- 어깨에서 소리가 나면서 통증이 동반되는 경우
- 부종이나 열감이 있는 경우
- 운동 후 24시간 이상 통증이 지속되는 경우

🚨 대응 절차
1) 즉시 운동 중단 안내
2) 얼음찜질 등 응급 조치 안내
3) 담당 병원 방문 권유
4) 어깨케어 관리자에게 보고

6. 환자 동기부여

🎯 동기부여 팁
- 작은 성취도 크게 칭찬하기
- 이전 영상과 비교해서 발전 포인트 알려주기
- 주간 리포트에서 긍정적 변화 강조하기
- 목표까지 남은 기간 알려주기
- 비슷한 환자들의 성공 사례 공유 (익명)

7. FAQ 템플릿

❓ "운동하면 아파요"
→ "운동 중 약간의 당김이나 뻐근함은 정상이지만, 날카로운 통증이나 찌릿한 느낌이 있다면 그 동작은 멈추시고 알려주세요."

❓ "언제쯤 나아질까요?"
→ "개인차가 있지만, 꾸준히 운동하시는 분들은 보통 4-6주 후부터 변화를 느끼시는 경우가 많습니다. 정확한 예후는 담당 의사 선생님께서 판단해주실 수 있습니다."

❓ "운동을 빼먹었어요"
→ "괜찮습니다! 쉬는 것도 회복의 일부예요. 오늘부터 다시 시작하면 됩니다. 무리하지 마시고 천천히 해보세요."`

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600"><span className="text-2xl">←</span></button>
          <h1 className="text-xl font-bold text-gray-900">트레이너 매뉴얼</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {content.split('\n').map((line, i) => {
            const l = line.trim()
            if (!l) return <div key={i} className="h-3" />
            if (l.startsWith('📋')) return <h1 key={i} className="text-xl font-bold text-gray-900 mb-2">{l}</h1>
            if (l.startsWith('작성일')) return <p key={i} className="text-xs text-gray-400 mb-4">{l}</p>
            if (/^\d+\.\s/.test(l) && l.length < 30) return <h2 key={i} className="text-lg font-bold text-blue-600 mt-6 mb-3">{l}</h2>
            if (l.startsWith('✅')) return <h3 key={i} className="text-base font-bold text-green-700 mt-4 mb-1">{l}</h3>
            if (l.startsWith('❌')) return <p key={i} className="text-sm text-red-600 pl-2 mb-1 font-medium">{l}</p>
            if (l.startsWith('⚠️') || l.startsWith('🚨') || l.startsWith('💬') || l.startsWith('📝') || l.startsWith('🎯') || l.startsWith('❓')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-5 mb-2">{l}</h3>
            if (l.startsWith('-')) return <p key={i} className="text-sm text-gray-700 pl-4 mb-1">{l}</p>
            if (l.startsWith('→')) return <p key={i} className="text-sm text-blue-700 pl-6 mb-2 italic">{l}</p>
            return <p key={i} className="text-sm text-gray-700 mb-2 leading-relaxed">{l}</p>
          })}
        </div>
      </main>
    </div>
  )
}
