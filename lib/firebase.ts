import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyARVKpzhb4ohI-XkgWM5rezP2nm9Msb1sI",
  authDomain: "shouldercare-5ee5a.firebaseapp.com",
  projectId: "shouldercare-5ee5a",
  storageBucket: "shouldercare-5ee5a.firebasestorage.app",
  messagingSenderId: "1075257891917",
  appId: "1:1075257891917:web:a6cf80ba8864376c5e5004"
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

const VAPID_KEY = 'BGOVP1LflxVUmLcn8d1D6FOpDoyibycbekccojDrQg-0RwS7kZpUnImHMG7QmYSvUZ4r3saVawLv10VL3aVTI4Y'

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    if (!('Notification' in window)) return null
    if (!('serviceWorker' in navigator)) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // SW가 등록되고 활성화될 때까지 대기
    let swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')

    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    }

    // SW가 active 상태가 될 때까지 대기
    if (swRegistration.installing || swRegistration.waiting) {
      await new Promise<void>((resolve) => {
        const sw = swRegistration!.installing || swRegistration!.waiting
        if (!sw) { resolve(); return }
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve()
        })
        // 이미 activated면 바로
        if (sw.state === 'activated') resolve()
      })
    }

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    })
    return token
  } catch (error) {
    console.error('FCM token error:', error)
    return null
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === 'undefined') return

  const messaging = getMessaging(app)
  onMessage(messaging, callback)
}
