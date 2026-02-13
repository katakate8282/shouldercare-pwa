'use client'

import { useEffect, useRef } from 'react'
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase'
import { fetchWithAuth } from '@/lib/fetch-auth'

export function usePushNotification(userId: string | null) {
  const registered = useRef(false)

  useEffect(() => {
    if (!userId || registered.current) return
    if (typeof window === 'undefined') return

    const registerFCM = async () => {
      try {
        const token = await requestNotificationPermission()
        if (token) {
          await fetchWithAuth('/api/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fcmToken: token }),
          })
          registered.current = true
          console.log('FCM token registered')
        }
      } catch (err) {
        console.error('FCM registration failed:', err)
      }
    }

    // 약간 딜레이 후 등록 (페이지 로드 완료 후)
    const timer = setTimeout(registerFCM, 2000)
    return () => clearTimeout(timer)
  }, [userId])

  // 포그라운드 메시지 처리
  useEffect(() => {
    if (!userId) return

    onForegroundMessage((payload) => {
      const title = payload.notification?.title || '어깨케어'
      const body = payload.notification?.body || '새 알림이 있습니다'

      // 브라우저 알림 표시
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
        })
      }
    })
  }, [userId])
}
