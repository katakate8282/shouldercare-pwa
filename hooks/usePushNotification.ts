'use client'

import { useEffect, useRef } from 'react'
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase'
import { fetchWithAuth } from '@/lib/fetch-auth'

export function usePushNotification(userId: string | null) {
  const registered = useRef(false)

  useEffect(() => {
    if (!userId || registered.current) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    const registerFCM = async () => {
      try {
        const token = await requestNotificationPermission()
        if (token) {
          const res = await fetchWithAuth('/api/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fcmToken: token }),
          })
          if (res.ok) {
            registered.current = true
            console.log('FCM token registered')
          } else {
            console.error('FCM token save failed:', res.status)
          }
        }
      } catch (err) {
        console.error('FCM registration failed:', err)
      }
    }

    // SW 등록 후 충분한 시간 뒤에 토큰 요청
    const timer = setTimeout(registerFCM, 3500)
    return () => clearTimeout(timer)
  }, [userId])

  // 포그라운드 메시지 처리
  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined') return

    onForegroundMessage((payload) => {
      const title = payload.notification?.title || '어깨케어'
      const body = payload.notification?.body || '새 알림이 있습니다'

      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
        })
      }
    })
  }, [userId])
}
