import { getToken } from '@/lib/token-storage'

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
  return fetchWithAuth('/api/auth/me')
}
