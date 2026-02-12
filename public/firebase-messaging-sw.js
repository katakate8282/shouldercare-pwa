/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyARVKpzhb4ohI-XkgWM5rezP2nm9Msb1sI",
  authDomain: "shouldercare-5ee5a.firebaseapp.com",
  projectId: "shouldercare-5ee5a",
  storageBucket: "shouldercare-5ee5a.firebasestorage.app",
  messagingSenderId: "1075257891917",
  appId: "1:1075257891917:web:a6cf80ba8864376c5e5004"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '어깨케어'
  const options = {
    body: payload.notification?.body || '새 메시지가 도착했습니다',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: payload.data,
  }

  self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
