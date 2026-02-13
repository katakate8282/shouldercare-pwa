import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: '어깨케어 - AI 기반 어깨 재활',
  description: '어깨 수술 후 재활 및 질환 관리를 위한 PWA',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  registrations.forEach(function(registration) {
                    registration.unregister();
                  });
                });
                caches.keys().then(function(cacheNames) {
                  cacheNames.forEach(function(cacheName) {
                    caches.delete(cacheName);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
