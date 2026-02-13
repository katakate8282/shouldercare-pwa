'use client'

import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    window.location.href = '/login'
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl">
          <span className="text-5xl">🏥</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">어깨케어</h1>
        <p className="text-blue-100 text-base">AI 기반 어깨 재활 전문 플랫폼</p>
      </div>
    </div>
  )
}
