-- users 테이블에 auth_id 컬럼 추가 (Supabase Auth 연동용)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Supabase Authentication 설정에서 "Confirm email" 비활성화 필요
-- (Supabase 대시보드 → Authentication → Providers → Email → Confirm email 끄기)
