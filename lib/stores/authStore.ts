// lib/stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserType = 'PATIENT' | 'TRAINER' | 'HOSPITAL_ADMIN' | 'DOCTOR'
export type SubscriptionType = 'UNSUBSCRIBED' | 'TRIAL' | 'PLATINUM_PATIENT' | 'PREMIUM'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  userType: UserType
  subscriptionType: SubscriptionType
  profileImage?: string
  createdAt: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      
      login: (user) => {
        set({ user, isAuthenticated: true })
      },
      
      logout: () => {
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)

// 테스트용 임시 사용자 생성 함수
export const createTestUser = (type: 'patient' | 'trainer' = 'patient'): User => {
  if (type === 'patient') {
    return {
      id: 'da625e64-47a3-4505-8d14-d37b7cb33e12',
      name: '김철수',
      email: 'test@example.com',
      phone: '010-1234-5678',
      userType: 'PATIENT',
      subscriptionType: 'PREMIUM',
      profileImage: undefined,
      createdAt: new Date().toISOString(),
    }
  } else {
    return {
      id: 'test-trainer-001',
      name: '김재활',
      email: 'trainer@example.com',
      phone: '010-9876-5432',
      userType: 'TRAINER',
      subscriptionType: 'PREMIUM',
      profileImage: undefined,
      createdAt: new Date().toISOString(),
    }
  }
}
