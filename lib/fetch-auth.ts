import { getToken, removeToken } from '@/lib/token-storage'

export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const token = await getToken()
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...options, headers })
}

export async function fetchAuthMe(): Promise<Response> {
  const res = await fetchWithAuth('/api/auth/me')

  // 인증 실패 시 무효 토큰 자동 삭제 (루프 방지)
  if (!res.ok) {
    await removeToken()
  }

  return res
}
