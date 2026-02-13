'use client'

import { useState, useEffect } from 'react'
import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
}

export default function PainLogPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [painLevel, setPainLevel] = useState(5)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showEmergency, setShowEmergency] = useState(false)
  const [painSpike, setPainSpike] = useState<{ current: number; previous: number } | null>(null)
  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const painAreas = [
    '어깨 전체',
    '어깨 앞쪽',
    '어깨 뒤쪽',
    '어깨 옆쪽',
    '팔 위쪽',
    '목',
  ]

  const painPatterns = [
    '움직일 때',
    '가만히 있을 때',
    '밤에',
    '아침에',
    '특정 동작 시',
  ]

  const toggleArea = (area: string) => {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter((a) => a !== area))
    } else {
      setSelectedAreas([...selectedAreas, area])
    }
  }

  const togglePattern = (pattern: string) => {
    if (selectedPatterns.includes(pattern)) {
      setSelectedPatterns(selectedPatterns.filter((p) => p !== pattern))
    } else {
      setSelectedPatterns([...selectedPatterns, pattern])
    }
  }

  const handleSave = async () => {
    if (!user) {
      alert('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    setIsSaving(true)

    try {
      const { data, error } = await supabase
        .from('pain_logs')
        .insert({
          user_id: user.id,
          pain_level: painLevel,
          pain_areas: selectedAreas,
          pain_patterns: selectedPatterns,
          notes: notes || null,
          logged_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error('Supabase error:', error)
        alert('저장에 실패했습니다: ' + error.message)
        setIsSaving(false)
        return
      }

      console.log('Saved to Supabase:', data)

      const painLog = {
        userId: user.id,
        painLevel,
        painAreas: selectedAreas,
        painPatterns: selectedPatterns,
        notes,
        loggedAt: new Date().toISOString(),
      }
      const existingLogs = JSON.parse(localStorage.getItem('painLogs') || '[]')
      localStorage.setItem('painLogs', JSON.stringify([...existingLogs, painLog]))

      setIsSaving(false)
      // 통증 급증 감지
      if (painLevel >= 8) {
        // 이전 기록과 비교
        const { data: prevLogs } = await supabase.from('pain_logs').select('pain_level').eq('user_id', user.id).order('logged_at', { ascending: false }).range(1, 3)
        const prevAvg = prevLogs && prevLogs.length > 0 ? prevLogs.reduce((s: number, l: any) => s + l.pain_level, 0) / prevLogs.length : 0
        if (painLevel >= 8 || (prevAvg > 0 && painLevel - prevAvg >= 3)) {
          setPainSpike({ current: painLevel, previous: Math.round(prevAvg) })
          setShowEmergency(true)
          return
        }
      }
      alert('통증 기록이 저장되었습니다! ✅')
      router.push('/dashboard')
    } catch (error) {
      console.error('Save error:', error)
      alert('저장 중 오류가 발생했습니다.')
      setIsSaving(false)
    }
  }

  const getPainColor = (level: number) => {
    if (level <= 3) return 'text-green-600'
    if (level <= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPainText = (level: number) => {
    if (level === 0) return '통증 없음'
    if (level <= 3) return '약간 아픔'
    if (level <= 6) return '중간 정도'
    if (level <= 8) return '많이 아픔'
    return '매우 심함'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-600">
              <span className="text-2xl">←</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">통증 기록</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">현재 통증 수준</h2>

          <div className="text-center mb-6">
            <div className={`text-6xl font-bold ${getPainColor(painLevel)} mb-2`}>
              {painLevel}
            </div>
            <div className="text-lg text-gray-600">{getPainText(painLevel)}</div>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            value={painLevel}
            onChange={(e) => setPainLevel(parseInt(e.target.value))}
            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, 
                rgb(134, 239, 172) 0%, 
                rgb(253, 224, 71) 50%, 
                rgb(252, 165, 165) 100%)`
            }}
          />

          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0 (없음)</span>
            <span>5 (중간)</span>
            <span>10 (최악)</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            통증 부위 <span className="text-sm text-gray-500">(중복 선택 가능)</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {painAreas.map((area) => (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={`py-3 px-4 rounded-lg border-2 transition-all ${
                  selectedAreas.includes(area)
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            언제 아픈가요? <span className="text-sm text-gray-500">(중복 선택 가능)</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {painPatterns.map((pattern) => (
              <button
                key={pattern}
                onClick={() => togglePattern(pattern)}
                className={`py-3 px-4 rounded-lg border-2 transition-all ${
                  selectedPatterns.includes(pattern)
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {pattern}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            추가 메모 <span className="text-sm text-gray-500">(선택)</span>
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 무거운 물건을 들고 나서 더 아파졌어요..."
            className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-4 rounded-lg transition-colors"
        >
          {isSaving ? '저장 중...' : '기록 저장하기'}
        </button>
      </main>
    </div>
  )
}
