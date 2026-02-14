'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import BottomNav from '@/components/BottomNav'
import { checkSubscription } from '@/lib/subscription'

interface User {
  id: string
  name: string
  role?: string
  subscription_type?: string
  subscription_expires_at?: string | null
}

interface Exercise {
  id: number
  name_ko: string
  category: string
  ai_analysis_enabled: boolean
}

interface AiAnalysis {
  id: string
  ai_feedback: string | null
  analysis_metrics: any
  comparison_data: any
  analysis_status: string
  failure_reason: string | null
  created_at: string
}

interface ExerciseVideo {
  id: string
  title: string
  description: string | null
  video_url: string | null
  status: 'uploaded' | 'reviewed' | 'archived'
  trainer_feedback: string | null
  feedback_at: string | null
  file_size_bytes: number | null
  exercise_id: number | null
  ai_analysis_id: string | null
  created_at: string
  exercises: {
    id: number
    name_ko: string
    category: string
    ai_analysis_enabled: boolean
  } | null
  ai_analysis: AiAnalysis | null
}

interface PrescribedExercise {
  exercise_id: number
  exercise_name: string
}

const CATEGORY_LABELS: Record<string, string> = {
  '견갑골_안정화': '견갑골 안정화',
  '어깨_강화': '어깨 강화',
  '회전근개_강화': '회전근개 강화',
  '흉추_가동성': '흉추 가동성',
  '관절_가동성': '관절 가동성',
  '코어_통합': '코어 통합',
  '등척성_운동': '등척성 운동',
  '기능적_운동': '기능적 운동',
  '고유수용감각': '고유수용감각',
}

export default function MyExerciseVideoPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<ExerciseVideo[]>([])
  const [videosLoading, setVideosLoading] = useState(false)

  // 운동 목록
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [prescribedExercises, setPrescribedExercises] = useState<PrescribedExercise[]>([])
  const [remainingAnalyses, setRemainingAnalyses] = useState<number>(5)

  // 오늘 업로드 카운트 (서버 기준, 삭제해도 유지)
  const [todayUploadCount, setTodayUploadCount] = useState<number>(0)

  // 업로드 관련
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [exerciseTab, setExerciseTab] = useState<'prescribed' | 'all'>('prescribed')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 영상 재생 모달
  const [playingVideo, setPlayingVideo] = useState<ExerciseVideo | null>(null)

  // 삭제 확인
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // AI 분석 결과 펼침 상태
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null)

  // AI 분석 진행 상태
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState('')

  useEffect(() => {
    fetchAuthMe()
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchVideos()
          fetchExercises()
          fetchPrescribedExercises()
          fetchRemainingAnalyses()
          fetchTodayUploadCount()
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const fetchVideos = async () => {
    setVideosLoading(true)
    try {
      const res = await fetch('/api/exercise-video', { credentials: 'include' })
      const data = await res.json()
      if (data.videos) setVideos(data.videos)
    } catch (err) {
      console.error('Failed to fetch videos:', err)
    }
    setVideosLoading(false)
  }

  const fetchExercises = async () => {
    try {
      const res = await fetch('/api/exercise-video?action=get_exercises', { credentials: 'include' })
      const data = await res.json()
      if (data.exercises) setExercises(data.exercises)
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    }
  }

  const fetchPrescribedExercises = async () => {
    try {
      const res = await fetch('/api/exercise-video?action=get_prescribed_exercises', { credentials: 'include' })
      const data = await res.json()
      if (data.prescriptions) setPrescribedExercises(data.prescriptions)
    } catch (err) {
      console.error('Failed to fetch prescribed exercises:', err)
    }
  }

  const fetchRemainingAnalyses = async () => {
    try {
      const res = await fetch('/api/exercise-video?action=get_remaining_analyses', { credentials: 'include' })
      const data = await res.json()
      if (data.remaining !== undefined) setRemainingAnalyses(data.remaining)
    } catch (err) {
      console.error('Failed to fetch remaining analyses:', err)
    }
  }

  const fetchTodayUploadCount = async () => {
    try {
      const res = await fetch('/api/exercise-video?action=get_today_upload_count', { credentials: 'include' })
      const data = await res.json()
      if (data.today_count !== undefined) setTodayUploadCount(data.today_count)
    } catch (err) {
      console.error('Failed to fetch today upload count:', err)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 30 * 1024 * 1024) {
      alert('파일 크기는 30MB 이하만 가능합니다.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (todayUploadCount >= 5) {
      alert('하루 최대 5개까지 업로드할 수 있습니다.\n내일 다시 시도해주세요.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const videoEl = document.createElement('video')
    videoEl.preload = 'metadata'
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src)
      if (videoEl.duration > 15) {
        alert('영상 길이는 최대 15초까지 가능합니다.\n짧은 영상으로 다시 촬영해주세요.')
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      if (!title) {
        const dateStr = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
        setTitle(`${dateStr} 운동 영상`)
      }
      setShowUploadModal(true)
    }
    videoEl.onerror = () => {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      if (!title) {
        const dateStr = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
        setTitle(`${dateStr} 운동 영상`)
      }
      setShowUploadModal(true)
    }
    videoEl.src = URL.createObjectURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    if (!selectedExerciseId) {
      alert('어떤 운동을 촬영했는지 선택해주세요.')
      return
    }

    setUploading(true)
    setUploadProgress('업로드 준비 중...')

    try {
      const ext = selectedFile.name.split('.').pop() || 'mp4'
      const urlRes = await fetch('/api/exercise-video', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_upload_url', file_ext: ext }),
      })

      if (!urlRes.ok) {
        const errText = await urlRes.text()
        throw new Error('URL 발급 실패: ' + errText)
      }

      const urlData = await urlRes.json()
      if (!urlData.upload_url) {
        throw new Error('업로드 URL을 받지 못했습니다')
      }

      setUploadProgress('영상 업로드 중...')
      const uploadRes = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type || 'video/mp4' },
        body: selectedFile,
      })

      if (!uploadRes.ok) {
        throw new Error('스토리지 업로드 실패: ' + uploadRes.status)
      }

      setUploadProgress('저장 중...')
      const selectedExercise = exercises.find(e => e.id === selectedExerciseId)
      const saveRes = await fetch('/api/exercise-video', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_record',
          title: selectedExercise ? selectedExercise.name_ko : (title || '운동 영상'),
          description: description || null,
          storage_path: urlData.storage_path,
          file_size_bytes: selectedFile.size,
          exercise_id: selectedExerciseId,
        }),
      })

      const saveData = await saveRes.json()

      if (saveData.success) {
        setUploadProgress('업로드 완료!')
        // 서버 카운트 갱신
        fetchTodayUploadCount()
        setTimeout(() => {
          setShowUploadModal(false)
          resetUploadForm()
          fetchVideos()
        }, 1000)
      } else {
        setUploadProgress('')
        alert(saveData.error || '저장 실패')
      }
    } catch (err) {
      setUploadProgress('')
      alert('업로드 오류: ' + (err instanceof Error ? err.message : JSON.stringify(err)))
    }
    setUploading(false)
  }

  const handleDelete = async (videoId: string) => {
    try {
      const res = await fetch(`/api/exercise-video?id=${videoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setDeletingId(null)
        fetchVideos()
        // soft delete이므로 카운트는 변하지 않음 - fetchTodayUploadCount 불필요
      }
    } catch (err) {
      alert('삭제 실패')
    }
  }

  // AI 자세 분석 실행
  const handleAiAnalysis = async (video: ExerciseVideo) => {
    if (!video.video_url || !video.exercise_id) return
    if (remainingAnalyses <= 0) {
      alert('이번 주 AI 분석 횟수를 모두 사용했어요.\n매주 월요일에 초기화됩니다.')
      return
    }

    setAnalyzingVideoId(video.id)
    setAnalysisProgress('AI 분석 준비 중...')

    try {
      // 1) MediaPipe 모듈 동적 로드
      setAnalysisProgress('자세 인식 모델 로딩 중...')
      const { runFullAnalysis } = await import('@/lib/mediapipe-analyzer')

      // 2) 전체 파이프라인 실행 (프레임 추출 → MediaPipe → 각도 계산 → API 호출)
      setAnalysisProgress('영상에서 자세를 분석하고 있어요...')
      const result = await runFullAnalysis(video.video_url, video.id, video.exercise_id)

      if (result.success) {
        setAnalysisProgress('분석 완료!')
        // 영상 목록 + 잔여 횟수 갱신
        await fetchVideos()
        await fetchRemainingAnalyses()
        // 결과 아코디언 자동 펼침
        setExpandedAnalysis(video.id)

        setTimeout(() => {
          setAnalyzingVideoId(null)
          setAnalysisProgress('')
        }, 1500)
      } else {
        throw new Error(result.error || '분석에 실패했습니다.')
      }
    } catch (err) {
      console.error('AI analysis error:', err)
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'

      if (errorMsg.includes('WEEKLY_LIMIT_EXCEEDED')) {
        alert('이번 주 AI 분석 횟수를 모두 사용했어요.\n매주 월요일에 초기화됩니다.')
      } else if (errorMsg.includes('NOT_SUPPORTED')) {
        alert('이 운동은 AI 분석을 지원하지 않습니다.')
      } else {
        alert('AI 분석 중 오류가 발생했어요.\n잠시 후 다시 시도해주세요.\n\n' + errorMsg)
      }

      setAnalyzingVideoId(null)
      setAnalysisProgress('')
    }
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setTitle('')
    setDescription('')
    setUploadProgress('')
    setSelectedExerciseId(null)
    setExerciseSearch('')
    setExerciseTab('prescribed')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">검토 대기</span>
      case 'reviewed':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">피드백 완료</span>
      case 'archived':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">보관됨</span>
      default:
        return null
    }
  }

  const getSelectedExercise = () => {
    return exercises.find(e => e.id === selectedExerciseId) || null
  }

  const getCameraDirection = (exercise: Exercise | null) => {
    if (!exercise) return null
    const frontIds = [3, 6, 10, 11, 14, 16, 17]
    const sideIds = [1, 9, 12, 13, 15, 18]
    if (frontIds.includes(exercise.id)) return '정면'
    if (sideIds.includes(exercise.id)) return '측면'
    return null
  }

  // 처방 운동 중 운동 DB에 있는 것 필터링
  const prescribedInDb = prescribedExercises
    .filter(p => exercises.some(e => e.id === p.exercise_id))
    .map(p => {
      const ex = exercises.find(e => e.id === p.exercise_id)!
      return ex
    })

  // 전체 운동 검색 필터
  const filteredExercises = exercises.filter(e => {
    if (!exerciseSearch) return true
    return e.name_ko.includes(exerciseSearch) || e.category.includes(exerciseSearch)
  })

  // 카테고리별 그룹
  const groupedExercises = filteredExercises.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push(e)
    return acc
  }, {} as Record<string, Exercise[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    )
  }

  if (!user) return null

  const subStatus = checkSubscription(user as any)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-gray-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">내 운동 촬영</h1>
              <p className="text-[11px] text-gray-500">운동 영상을 올리고 AI 분석 또는 트레이너 피드백을 받으세요</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* 업로드 제한 + AI 분석 잔여 안내 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📹</span>
              <span className="text-xs text-gray-600">오늘 업로드: <strong className="text-gray-900">{todayUploadCount}/5개</strong></span>
            </div>
            <span className="text-[10px] text-gray-400">15초 / 30MB 이하</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤖</span>
              <span className="text-xs text-gray-600">이번 주 AI 분석: <strong className="text-gray-900">{remainingAnalyses}/5회</strong> 남음</span>
            </div>
            <span className="text-[10px] text-gray-400">매주 월요일 초기화</span>
          </div>
        </div>

        {/* 업로드 버튼 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (todayUploadCount >= 5) {
                alert('하루 최대 5개까지 업로드할 수 있습니다.\n내일 다시 시도해주세요.')
                return
              }
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'video/*'
                fileInputRef.current.capture = 'environment'
                fileInputRef.current.click()
              }
            }}
            className="rounded-xl p-4 text-center text-white"
            style={{ background: todayUploadCount >= 5 ? '#9CA3AF' : 'linear-gradient(135deg, #059669, #10B981)' }}
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
            <p className="font-bold text-sm">카메라 촬영</p>
            <p className="text-[10px] text-white/70 mt-0.5">직접 촬영하기</p>
          </button>

          <button
            onClick={() => {
              if (todayUploadCount >= 5) {
                alert('하루 최대 5개까지 업로드할 수 있습니다.\n내일 다시 시도해주세요.')
                return
              }
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'video/*'
                fileInputRef.current.removeAttribute('capture')
                fileInputRef.current.click()
              }
            }}
            className="rounded-xl p-4 text-center text-white"
            style={{ background: todayUploadCount >= 5 ? '#9CA3AF' : 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <p className="font-bold text-sm">갤러리 선택</p>
            <p className="text-[10px] text-white/70 mt-0.5">저장된 영상 올리기</p>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 촬영 팁 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs text-blue-800 font-medium mb-1">💡 촬영 팁</p>
          <div className="text-[11px] text-blue-600 space-y-0.5">
            <p className="text-red-600 font-bold">⚠️ 영상 1개는 15초 미만, 30MB 미만만 업로드 가능합니다</p>
            <p>• 전신이 보이도록 1~2m 거리에서 촬영하세요</p>
            <p>• 밝은 곳에서 촬영하면 AI가 자세를 더 정확히 분석해요</p>
            <p>• 몸에 밀착된 옷 착용을 추천합니다</p>
          </div>
        </div>

        {/* 영상 목록 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">내 영상 목록</h2>
            <span className="text-xs text-gray-500">{videos.length}개</span>
          </div>

          {videosLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
          ) : videos.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <p className="text-sm text-gray-500 mb-1">아직 업로드한 영상이 없어요</p>
              <p className="text-xs text-gray-400">운동하는 모습을 촬영해서 올려보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <div key={video.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-3.5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold text-sm text-gray-900">{video.title}</p>
                          {getStatusBadge(video.status)}
                          {video.exercises?.ai_analysis_enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">AI 분석 가능</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {video.exercises ? `${CATEGORY_LABELS[video.exercises.category] || video.exercises.category} · ` : ''}
                          {new Date(video.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {video.file_size_bytes ? ` · ${formatFileSize(video.file_size_bytes)}` : ''}
                        </p>
                        {video.description && (
                          <p className="text-xs text-gray-500 mt-1">{video.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        {video.video_url && (
                          <button
                            onClick={() => setPlayingVideo(video)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingId(video.id)}
                          className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* 트레이너 피드백 */}
                    {video.trainer_feedback && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">👨‍⚕️</span>
                          <p className="text-[11px] font-bold text-emerald-800">트레이너 피드백</p>
                          {video.feedback_at && (
                            <span className="text-[10px] text-emerald-500">
                              {new Date(video.feedback_at).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-700 leading-relaxed">{video.trainer_feedback}</p>
                      </div>
                    )}

                    {/* AI 분석 결과 (아코디언) */}
                    {video.ai_analysis && video.ai_analysis.analysis_status === 'completed' && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedAnalysis(expandedAnalysis === video.id ? null : video.id)}
                          className="w-full flex items-center justify-between bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🤖</span>
                            <p className="text-[11px] font-bold text-purple-800">AI 자세 분석 결과</p>
                            <span className="text-[10px] text-purple-500">
                              {new Date(video.ai_analysis.created_at).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform ${expandedAnalysis === video.id ? 'rotate-180' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>
                        {expandedAnalysis === video.id && (
                          <div className="bg-purple-50 border border-t-0 border-purple-100 rounded-b-lg px-3 py-3">
                            <div className="text-xs text-purple-900 leading-relaxed whitespace-pre-line">
                              {video.ai_analysis.ai_feedback}
                            </div>
                            <p className="text-[10px] text-purple-400 mt-3 pt-2 border-t border-purple-200">
                              ⚕️ 이 분석은 AI 자세 추정이며, 의학적 진단이나 처방이 아닙니다. 통증이 있거나 상태가 악화되면 담당 의사와 상담하세요.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI 분석 중 로딩 UI */}
                    {analyzingVideoId === video.id && (
                      <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                            <span className="absolute inset-0 flex items-center justify-center text-sm">🤖</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-purple-800">AI가 자세를 분석하고 있어요</p>
                            <p className="text-[11px] text-purple-600 mt-0.5">{analysisProgress}</p>
                          </div>
                        </div>
                        <div className="mt-3 bg-purple-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-[10px] text-purple-400 mt-2">보통 10~20초 정도 소요됩니다</p>
                      </div>
                    )}

                    {/* AI 분석 미지원 운동 안내 */}
                    {video.exercises && !video.exercises.ai_analysis_enabled && !video.trainer_feedback && (
                      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">ℹ️</span>
                          <p className="text-[11px] font-bold text-gray-600">AI 분석 미지원</p>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          이 운동은 동작 범위가 작거나 카메라 각도 특성상 AI 자세 분석의 정확도를 보장하기 어려워 분석을 제공하지 않습니다.
                          정확한 자세 피드백이 필요하시면 프리미엄 플랜의 1:1 트레이너 피드백을 이용해주세요.
                        </p>
                      </div>
                    )}

                    {/* AI 분석 가능 + 아직 미분석 → AI 분석 버튼 */}
                    {video.exercises?.ai_analysis_enabled && !video.ai_analysis && analyzingVideoId !== video.id && (
                      <div className="mt-2 space-y-2">
                        <button
                          onClick={() => handleAiAnalysis(video)}
                          disabled={remainingAnalyses <= 0 || !video.video_url}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-xs font-bold transition disabled:opacity-50"
                          style={{ background: remainingAnalyses <= 0 ? '#9CA3AF' : 'linear-gradient(135deg, #7C3AED, #A855F7)' }}
                        >
                          <span>🤖</span>
                          {remainingAnalyses <= 0 ? 'AI 분석 횟수 소진 (월요일 초기화)' : 'AI 자세 분석하기'}
                        </button>
                        {!video.trainer_feedback && (
                          <p className="text-[11px] text-yellow-600 text-center">트레이너 피드백도 대기 중이에요</p>
                        )}
                      </div>
                    )}

                    {/* 운동 미선택 + 피드백 없음 */}
                    {!video.exercises && !video.trainer_feedback && video.status === 'uploaded' && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-yellow-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>트레이너 피드백을 기다리고 있어요</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 업로드 모달 (운동 선택 추가) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">영상 업로드</h3>
                <button
                  onClick={() => { setShowUploadModal(false); resetUploadForm() }}
                  className="text-gray-400 text-2xl"
                >×</button>
              </div>

              {/* 미리보기 */}
              {previewUrl && (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    src={previewUrl}
                    controls
                    className="w-full max-h-40 object-contain"
                    playsInline
                  />
                </div>
              )}

              {selectedFile && (
                <p className="text-xs text-gray-400">
                  {selectedFile.name} · {formatFileSize(selectedFile.size)}
                </p>
              )}

              {/* ★ 운동 선택 */}
              <div>
                <label className="text-sm font-bold text-gray-900 block mb-2">
                  어떤 운동을 촬영했나요? <span className="text-red-500">*</span>
                </label>

                {/* 탭: 처방 운동 / 전체 운동 */}
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => setExerciseTab('prescribed')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      exerciseTab === 'prescribed' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    나의 처방 운동 {prescribedInDb.length > 0 && `(${prescribedInDb.length})`}
                  </button>
                  <button
                    onClick={() => setExerciseTab('all')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      exerciseTab === 'all' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    전체 운동
                  </button>
                </div>

                {/* 전체 운동 검색 */}
                {exerciseTab === 'all' && (
                  <input
                    type="text"
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    placeholder="운동 이름으로 검색..."
                    className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                )}

                {/* 운동 목록 */}
                <div className="max-h-48 overflow-y-auto border rounded-xl">
                  {exerciseTab === 'prescribed' ? (
                    prescribedInDb.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">
                        처방된 운동이 없습니다. 전체 운동에서 선택해주세요.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {prescribedInDb.map(ex => (
                          <button
                            key={ex.id}
                            onClick={() => setSelectedExerciseId(ex.id)}
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition ${
                              selectedExerciseId === ex.id ? 'bg-sky-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div>
                              <p className={`text-sm ${selectedExerciseId === ex.id ? 'font-bold text-sky-700' : 'text-gray-900'}`}>{ex.name_ko}</p>
                              <p className="text-[10px] text-gray-400">{CATEGORY_LABELS[ex.category] || ex.category}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {ex.ai_analysis_enabled && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">AI</span>
                              )}
                              {selectedExerciseId === ex.id && (
                                <span className="text-sky-500 text-lg">✓</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="divide-y">
                      {Object.keys(groupedExercises).length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">검색 결과가 없습니다.</div>
                      ) : (
                        Object.entries(groupedExercises).map(([category, exs]) => (
                          <div key={category}>
                            <div className="px-3 py-1.5 bg-gray-50 sticky top-0">
                              <p className="text-[10px] font-bold text-gray-500">{CATEGORY_LABELS[category] || category}</p>
                            </div>
                            {exs.map(ex => (
                              <button
                                key={ex.id}
                                onClick={() => setSelectedExerciseId(ex.id)}
                                className={`w-full text-left px-3 py-2 flex items-center justify-between transition ${
                                  selectedExerciseId === ex.id ? 'bg-sky-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <p className={`text-sm ${selectedExerciseId === ex.id ? 'font-bold text-sky-700' : 'text-gray-900'}`}>{ex.name_ko}</p>
                                <div className="flex items-center gap-1.5">
                                  {ex.ai_analysis_enabled && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">AI</span>
                                  )}
                                  {selectedExerciseId === ex.id && (
                                    <span className="text-sky-500 text-lg">✓</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 선택된 운동 + 촬영 가이드 */}
                {selectedExerciseId && (() => {
                  const sel = getSelectedExercise()
                  const dir = getCameraDirection(sel)
                  return sel ? (
                    <div className="mt-2 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">✅</span>
                          <p className="text-xs font-bold text-sky-800">{sel.name_ko}</p>
                        </div>
                        {sel.ai_analysis_enabled && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">AI 분석 가능</span>
                        )}
                      </div>
                      {dir && (
                        <p className="text-[10px] text-sky-600 mt-1">
                          📷 권장 촬영 방향: <strong>{dir}</strong>에서 촬영해주세요
                        </p>
                      )}
                      {!sel.ai_analysis_enabled && (
                        <p className="text-[10px] text-gray-500 mt-1">ℹ️ 이 운동은 AI 자세 분석이 지원되지 않습니다</p>
                      )}
                    </div>
                  ) : null
                })()}
              </div>

              {/* 메모 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">메모 (선택)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="트레이너에게 전달할 내용이 있으면 적어주세요"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm h-16 resize-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {uploadProgress && (
                <div className="flex items-center gap-2 text-sm">
                  {uploading && (
                    <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className={uploading ? 'text-sky-600' : 'text-green-600 font-medium'}>{uploadProgress}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowUploadModal(false); resetUploadForm() }}
                  className="flex-1 py-3 rounded-xl border text-gray-600 font-medium text-sm"
                >
                  취소
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !selectedExerciseId}
                  className="flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition"
                  style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}
                >
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 영상 재생 모달 */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm">{playingVideo.title}</p>
              <button onClick={() => setPlayingVideo(null)} className="text-white/70 text-2xl">×</button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black">
              <video
                src={playingVideo.video_url || ''}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 text-center">
            <p className="text-lg mb-1">🗑️</p>
            <h3 className="font-bold text-gray-900 mb-2">영상을 삭제할까요?</h3>
            <p className="text-sm text-gray-500 mb-4">삭제된 영상은 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl border text-gray-600 font-medium text-sm"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role="patient" unreadCount={0} />
    </div>
  )
}
