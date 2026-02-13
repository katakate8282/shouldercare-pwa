'use client'

import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

export default function SubscribePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">프리미엄 구독</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* 무료 vs 프리미엄 비교 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 text-center" style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}>
            <h2 className="text-xl font-bold text-white mb-1">프리미엄 플랜</h2>
            <p className="text-sm text-white/80">전문 트레이너와 함께하는 맞춤 재활</p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">✅ 무료 (기본)</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 54개 운동 영상 무제한 시청</li>
                <li>• AI 맞춤 운동 추천</li>
                <li>• 통증 기록 및 진행 추적</li>
                <li>• 주간 운동 리포트</li>
              </ul>
            </div>

            <hr />

            <div>
              <h3 className="text-sm font-bold mb-2" style={{ color: '#0284C7' }}>⭐ 프리미엄</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 무료 기능 전체 포함</li>
                <li className="font-medium text-gray-900">• 🏥 전문 트레이너 1:1 맞춤 운동 제안</li>
                <li className="font-medium text-gray-900">• 💬 트레이너와 실시간 메시지</li>
                <li className="font-medium text-gray-900">• 📋 트레이너 코멘트 및 피드백</li>
                <li className="font-medium text-gray-900">• 📊 상세 진행 리포트</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 가격 안내 (준비 중) */}
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
          <p className="text-4xl mb-2">🚀</p>
          <h3 className="text-lg font-bold text-gray-900 mb-2">곧 오픈 예정입니다</h3>
          <p className="text-sm text-gray-500 mb-4">프리미엄 구독 서비스를 준비하고 있습니다.</p>
          <p className="text-sm text-gray-500">병원 코드가 있으시면 무료로 12주간<br />프리미엄 서비스를 이용하실 수 있습니다.</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            병원 코드로 시작하기
          </button>
        </div>
      </main>

      <BottomNav role="patient" />
    </div>
  )
}
