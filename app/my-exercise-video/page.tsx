'use client'

import { fetchAuthMe } from '@/lib/fetch-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import BottomNav from '@/components/BottomNav'
import { checkSubscription } from '@/lib/subscription'

interface User {
  id: string
  name: string
  role?: string
  subscription_type?: string
  subscription_expires_at?: string | null
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
  created_at: string
}

export default function MyExerciseVideoPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<ExerciseVideo[]>([])
  const [videosLoading, setVideosLoading] = useState(false)

  // 업로드 관련
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 영상 재생 모달
  const [playingVideo, setPlayingVideo] = useState<ExerciseVideo | null>(null)

  // 삭제 확인
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 100 * 1024 * 1024) {
      alert('파일 크기는 100MB 이하만 가능합니다.')
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

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadProgress('업로드 중...')

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('title', title || '운동 영상')
      if (description) formData.append('description', description)

      const res = await fetch('/api/exercise-video', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        setUploadProgress('업로드 완료!')
        setTimeout(() => {
          setShowUploadModal(false)
          resetUploadForm()
          fetchVideos()
        }, 1000)
      } else {
        setUploadProgress('')
        alert(data.error || '업로드 실패')
      }
    } catch (err) {
      setUploadProgress('')
      alert('업로드 중 오류가 발생했습니다.')
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
      }
    } catch (err) {
      alert('삭제 실패')
    }
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setTitle('')
    setDescription('')
    setUploadProgress('')
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
              <p className="text-[11px] text-gray-500">운동 영상을 올리고 트레이너 피드백을 받으세요</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* 업로드 버튼 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'video/*'
                fileInputRef.current.capture = 'environment'
                fileInputRef.current.click()
              }
            }}
            className="rounded-xl p-4 text-center text-white"
            style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
            <p className="font-bold text-sm">카메라 촬영</p>
            <p className="text-[10px] text-white/70 mt-0.5">직접 촬영하기</p>
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'video/*'
                fileInputRef.current.removeAttribute('capture')
                fileInputRef.current.click()
              }
            }}
            className="rounded-xl p-4 text-center text-white"
            style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <p className="font-bold text-sm">갤러리 선택</p>
            <p className="text-[10px] text-white/70 mt-0.5">저장된 영상 올리기</p>
          </button>
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs text-blue-800 font-medium mb-1">💡 촬영 팁</p>
          <div className="text-[11px] text-blue-600 space-y-0.5">
            <p>• 전신이 보이도록 1~2m 거리에서 촬영하세요</p>
            <p>• 밝은 곳에서 촬영하면 트레이너가 자세를 더 잘 볼 수 있어요</p>
            <p>• 1세트 전체를 촬영하는 것을 추천합니다</p>
            <p>• 최대 100MB까지 업로드 가능합니다</p>
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
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-sm text-gray-900">{video.title}</p>
                          {getStatusBadge(video.status)}
                        </div>
                        <p className="text-[11px] text-gray-400">
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

                    {video.status === 'uploaded' && (
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

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
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
                    className="w-full max-h-48 object-contain"
                    playsInline
                  />
                </div>
              )}

              {selectedFile && (
                <p className="text-xs text-gray-400">
                  {selectedFile.name} · {formatFileSize(selectedFile.size)}
                </p>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 외회전 운동 1세트"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">메모 (선택)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="트레이너에게 전달할 내용이 있으면 적어주세요"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm h-20 resize-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
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
                  disabled={uploading || !selectedFile}
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
