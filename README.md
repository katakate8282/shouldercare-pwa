# 🏥 ShoulderCare PWA

어깨 통증 관리 및 재활 운동을 위한 Progressive Web App

## 🌟 주요 기능

### 📊 통증 기록
- 일일 통증 수준 기록 (0-10)
- 통증 부위 선택
- 통증 패턴 추적
- Supabase 실시간 저장

### 💪 재활 운동
- 단계별 운동 프로그램
- 동영상 가이드
- 세트/반복 추적
- 운동 기록 저장

### 📈 진행상황 추적
- 7일 통증 추이 그래프
- 운동 완료 통계
- 평균 통증 수준

## 🚀 기술 스택

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL)
- **State:** Zustand
- **Deploy:** Vercel
- **PWA:** Service Worker

## 🔧 로컬 실행
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에 Supabase 키 입력

# 개발 서버 실행
npm run dev
```

## 🌐 배포된 앱

**URL:** https://shouldercare-pwa.vercel.app

## 📱 데이터베이스 구조

### pain_logs
- user_id (UUID)
- pain_level (INTEGER)
- pain_areas (TEXT[])
- pain_patterns (TEXT[])
- notes (TEXT)
- logged_at (TIMESTAMPTZ)

### exercise_logs
- user_id (UUID)
- exercise_id (TEXT)
- sets_completed (INTEGER)
- reps_completed (INTEGER)
- duration_seconds (INTEGER)
- completed_at (TIMESTAMPTZ)

### users
- id (UUID)
- name (TEXT)
- email (TEXT)

## 🔐 환경 변수
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📝 개발 로그

### 완료된 기능
- ✅ 통증 기록 시스템
- ✅ 운동 추적 시스템
- ✅ Supabase 연동
- ✅ 진행상황 그래프
- ✅ Vercel 배포

### 향후 계획
- [ ] 카카오 로그인 연동
- [ ] PWA 오프라인 기능
- [ ] 푸시 알림
- [ ] 물리치료사 추천 시스템

## 👨‍💻 개발자

Made with ❤️ for shoulder pain recovery

## 📄 라이선스

MIT License
