'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'

// MediaPipe 타입
declare global {
  interface Window {
    Pose: any
    Camera: any
    drawConnectors: any
    drawLandmarks: any
    POSE_CONNECTIONS: any
  }
}

interface RomResult {
  flexion: number | null
  abduction: number | null
  external_rotation: number | null
}

type MeasureStep = 'intro' | 'flexion' | 'abduction' | 'external_rotation' | 'done'

const STEP_INFO: Record<string, { title: string; instruction: string; emoji: string }> = {
  flexion: {
    title: '굴곡 (Flexion)',
    instruction: '아픈 쪽 팔을 앞으로 천천히 올려주세요',
    emoji: '☝️',
  },
  abduction: {
    title: '외전 (Abduction)',
    instruction: '아픈 쪽 팔을 옆으로 천천히 올려주세요',
    emoji: '🤸',
  },
  external_rotation: {
    title: '외회전 (External Rotation)',
    instruction: '팔꿈치를 90° 구부려 몸에 붙이고, 전완을 바깥으로 돌려주세요',
    emoji: '🔄',
  },
}

// ===== 애니메이션 SVG 가이드 컴포넌트 =====
function FlexionGuide({ size = 160 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      {/* 몸통 */}
      <circle cx="60" cy="25" r="10" fill="#94A3B8" /> {/* 머리 */}
      <line x1="60" y1="35" x2="60" y2="75" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" /> {/* 몸 */}
      <line x1="60" y1="75" x2="45" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" /> {/* 왼다리 */}
      <line x1="60" y1="75" x2="75" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" /> {/* 오른다리 */}
      {/* 고정 팔 (왼쪽) */}
      <line x1="60" y1="45" x2="40" y2="65" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      {/* 움직이는 팔 (오른쪽) - 아래→위 앞으로 */}
      <line x1="60" y1="45" x2="60" y2="45" stroke="#0EA5E9" strokeWidth="3.5" strokeLinecap="round">
        <animate attributeName="x2" values="80;75;60;50;45" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="y2" values="65;55;35;20;10" dur="2.5s" repeatCount="indefinite" />
      </line>
      {/* 손 끝 원 */}
      <circle cx="80" cy="65" r="3" fill="#0EA5E9">
        <animate attributeName="cx" values="80;75;60;50;45" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="cy" values="65;55;35;20;10" dur="2.5s" repeatCount="indefinite" />
      </circle>
      {/* 화살표 궤적 */}
      <path d="M 78 60 Q 65 35 48 12" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
      <polygon points="45,10 50,18 42,16" fill="#0EA5E9" opacity="0.7">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.5s" repeatCount="indefinite" />
      </polygon>
      {/* 각도 표시 */}
      <path d="M 60 55 Q 65 50 68 45" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <text x="72" y="48" fontSize="8" fill="#F59E0B" fontWeight="bold">θ</text>
    </svg>
  )
}

function AbductionGuide({ size = 160 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      {/* 몸통 (정면) */}
      <circle cx="60" cy="25" r="10" fill="#94A3B8" />
      <line x1="60" y1="35" x2="60" y2="75" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="75" x2="45" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="75" x2="75" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      {/* 고정 팔 (왼쪽) */}
      <line x1="60" y1="45" x2="40" y2="65" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      {/* 움직이는 팔 (오른쪽) - 옆으로 올리기 */}
      <line x1="60" y1="45" x2="60" y2="45" stroke="#0EA5E9" strokeWidth="3.5" strokeLinecap="round">
        <animate attributeName="x2" values="80;88;92;90;85" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="y2" values="65;50;38;25;15" dur="2.5s" repeatCount="indefinite" />
      </line>
      {/* 손 끝 원 */}
      <circle cx="80" cy="65" r="3" fill="#0EA5E9">
        <animate attributeName="cx" values="80;88;92;90;85" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="cy" values="65;50;38;25;15" dur="2.5s" repeatCount="indefinite" />
      </circle>
      {/* 화살표 궤적 */}
      <path d="M 78 62 Q 92 40 87 15" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
      <polygon points="85,12 90,20 82,18" fill="#0EA5E9" opacity="0.7">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.5s" repeatCount="indefinite" />
      </polygon>
      {/* 각도 표시 */}
      <path d="M 60 55 Q 68 50 72 44" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
      <text x="74" y="47" fontSize="8" fill="#F59E0B" fontWeight="bold">θ</text>
    </svg>
  )
}

function ExternalRotationGuide({ size = 160 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      {/* 몸통 (정면) */}
      <circle cx="60" cy="25" r="10" fill="#94A3B8" />
      <line x1="60" y1="35" x2="60" y2="75" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="75" x2="45" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="75" x2="75" y2="105" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      {/* 고정 팔 (왼쪽) */}
      <line x1="60" y1="45" x2="40" y2="65" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      {/* 상완 (몸에 붙임) */}
      <line x1="60" y1="45" x2="75" y2="55" stroke="#0EA5E9" strokeWidth="3.5" strokeLinecap="round" />
      {/* 팔꿈치 점 */}
      <circle cx="75" cy="55" r="3" fill="#F59E0B" />
      {/* 전완 (회전) - 몸 앞→바깥으로 */}
      <line x1="75" y1="55" x2="75" y2="55" stroke="#0EA5E9" strokeWidth="3.5" strokeLinecap="round">
        <animate attributeName="x2" values="60;65;75;88;100" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="y2" values="55;50;42;42;50" dur="2.5s" repeatCount="indefinite" />
      </line>
      {/* 손 끝 원 */}
      <circle cx="60" cy="55" r="3" fill="#0EA5E9">
        <animate attributeName="cx" values="60;65;75;88;100" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="cy" values="55;50;42;42;50" dur="2.5s" repeatCount="indefinite" />
      </circle>
      {/* 회전 화살표 */}
      <path d="M 62 58 Q 70 38 98 48" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
      <polygon points="98,45 100,53 94,50" fill="#0EA5E9" opacity="0.7">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.5s" repeatCount="indefinite" />
      </polygon>
      {/* 90도 표시 */}
      <rect x="72" y="52" width="6" height="6" fill="none" stroke="#F59E0B" strokeWidth="1" />
      <text x="68" y="70" fontSize="7" fill="#F59E0B" fontWeight="bold">90°</text>
      {/* 회전 방향 텍스트 */}
      <text x="80" y="32" fontSize="6" fill="#0EA5E9" fontWeight="bold">바깥으로→</text>
    </svg>
  )
}

function getGuideComponent(step: string, size?: number) {
  switch (step) {
    case 'flexion': return <FlexionGuide size={size} />
    case 'abduction': return <AbductionGuide size={size} />
    case 'external_rotation': return <ExternalRotationGuide size={size} />
    default: return null
  }
}

// 각도 계산 유틸
function calcAngle(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2)
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2)
  if (magBA === 0 || magBC === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)))
  return Math.round((Math.acos(cosAngle) * 180) / Math.PI)
}

export default function MeasurePage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [measureStep, setMeasureStep] = useState<MeasureStep>('intro')
  const [rom, setRom] = useState<RomResult>({ flexion: null, abduction: null, external_rotation: null })
  const [currentAngle, setCurrentAngle] = useState(0)
  const [maxAngle, setMaxAngle] = useState(0)
  const [holdTimer, setHoldTimer] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [poseLoaded, setPoseLoaded] = useState(false)
  const [surveyData, setSurveyData] = useState<any>(null)
  const [showGuideOverlay, setShowGuideOverlay] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  const maxAngleRef = useRef(0)
  const holdStartRef = useRef<number | null>(null)
  const capturedRef = useRef(false)
  const poseRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 설문 데이터 로드
  useEffect(() => {
    const saved = sessionStorage.getItem('selftest_survey')
    if (!saved) {
      router.push('/self-test/survey')
      return
    }
    setSurveyData(JSON.parse(saved))
  }, [router])

  // MediaPipe 스크립트 로드
  useEffect(() => {
    const loadScripts = async () => {
      const scripts = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
      ]

      for (const src of scripts) {
        if (document.querySelector(`script[src="${src}"]`)) continue
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = src
          script.crossOrigin = 'anonymous'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error(`Failed to load ${src}`))
          document.head.appendChild(script)
        })
      }

      setTimeout(() => {
        if (window.Pose) {
          setPoseLoaded(true)
        }
      }, 500)
    }

    loadScripts().catch(err => {
      console.error('MediaPipe load error:', err)
      setCameraError('MediaPipe 로드에 실패했습니다. 페이지를 새로고침해주세요.')
    })
  }, [])

  // 카메라 + Pose 시작
  const startCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !window.Pose) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraReady(true)

      const pose = new window.Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      })

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      pose.onResults((results: any) => {
        if (!canvasRef.current || !results.poseLandmarks) return

        const ctx = canvasRef.current.getContext('2d')
        if (!ctx) return

        canvasRef.current.width = videoRef.current?.videoWidth || 640
        canvasRef.current.height = videoRef.current?.videoHeight || 480

        ctx.save()
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

        if (facingMode === 'user') {
          ctx.translate(canvasRef.current.width, 0)
          ctx.scale(-1, 1)
        }
        ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.restore()

        if (window.drawConnectors && window.POSE_CONNECTIONS) {
          ctx.save()
          if (facingMode === 'user') {
            ctx.translate(canvasRef.current.width, 0)
            ctx.scale(-1, 1)
          }
          window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#0EA5E9', lineWidth: 2 })
          window.drawLandmarks(ctx, results.poseLandmarks, { color: '#0284C7', lineWidth: 1, radius: 3 })
          ctx.restore()
        }

        const lm = results.poseLandmarks
        let angle = 0

        if (measureStep === 'flexion' || measureStep === 'abduction') {
          const shoulder = lm[12]
          const elbow = lm[14]
          const hip = lm[24]
          angle = calcAngle(elbow, shoulder, hip)
        } else if (measureStep === 'external_rotation') {
          const shoulder = lm[12]
          const elbow = lm[14]
          const wrist = lm[16]
          const rawAngle = calcAngle(shoulder, elbow, wrist)
          angle = Math.max(0, Math.min(90, Math.abs(rawAngle - 90)))
        }

        if (measureStep !== 'intro' && measureStep !== 'done') {
          setCurrentAngle(angle)
          if (angle > maxAngleRef.current) {
            maxAngleRef.current = angle
            setMaxAngle(angle)
          }

          if (!capturedRef.current && angle >= maxAngleRef.current - 5 && maxAngleRef.current > 20) {
            if (!holdStartRef.current) {
              holdStartRef.current = Date.now()
            }
            const elapsed = (Date.now() - holdStartRef.current) / 1000
            setHoldTimer(Math.min(elapsed, 2))

            if (elapsed >= 2) {
              capturedRef.current = true
              const key = measureStep as keyof RomResult
              setRom(prev => ({ ...prev, [key]: maxAngleRef.current }))
            }
          } else if (angle < maxAngleRef.current - 10) {
            holdStartRef.current = null
            setHoldTimer(0)
          }
        }
      })

      poseRef.current = pose

      const sendFrame = async () => {
        if (videoRef.current && poseRef.current && videoRef.current.readyState >= 2) {
          await poseRef.current.send({ image: videoRef.current })
        }
        requestAnimationFrame(sendFrame)
      }
      sendFrame()

    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setCameraError('카메라 권한을 허용해주세요.')
      } else {
        setCameraError('카메라를 시작할 수 없습니다.')
      }
    }
  }, [measureStep])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  // 카메라 전환
  const toggleCamera = useCallback(() => {
    stopCamera()
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [stopCamera])

  // 다음 측정 단계 (가이드 먼저 보여주기)
  const nextMeasureStep = () => {
    maxAngleRef.current = 0
    holdStartRef.current = null
    capturedRef.current = false
    setCurrentAngle(0)
    setMaxAngle(0)
    setHoldTimer(0)

    if (measureStep === 'intro') {
      setMeasureStep('flexion')
      setShowGuideOverlay(true)
    } else if (measureStep === 'flexion') {
      setMeasureStep('abduction')
      setShowGuideOverlay(true)
    } else if (measureStep === 'abduction') {
      setMeasureStep('external_rotation')
      setShowGuideOverlay(true)
    } else if (measureStep === 'external_rotation') {
      stopCamera()
      setMeasureStep('done')
    }
  }

  // 카메라 시작
  useEffect(() => {
    if (measureStep !== 'intro' && measureStep !== 'done' && poseLoaded) {
      startCamera()
    }
    return () => {
      if (measureStep === 'done') stopCamera()
    }
  }, [measureStep, poseLoaded, facingMode, startCamera, stopCamera])

  const goToResult = () => {
    sessionStorage.setItem('selftest_rom', JSON.stringify(rom))
    router.push('/self-test/result')
  }

  const manualCapture = () => {
    if (maxAngleRef.current > 10) {
      capturedRef.current = true
      const key = measureStep as keyof RomResult
      setRom(prev => ({ ...prev, [key]: maxAngleRef.current }))
    }
  }

  const skipMeasurement = () => {
    stopCamera()
    sessionStorage.setItem('selftest_rom', JSON.stringify({ flexion: null, abduction: null, external_rotation: null }))
    router.push('/self-test/result')
  }

  // ===== 인트로 화면 =====
  if (measureStep === 'intro') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
            <button onClick={() => router.back()} className="mr-3 text-slate-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h1 className="text-base font-bold text-slate-900">어깨 움직임 측정</h1>
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>
              <span className="text-3xl">📸</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">카메라 ROM 측정</h2>
            <p className="text-sm text-slate-500">3가지 동작으로 어깨 가동범위를 측정합니다</p>
          </div>

          {/* 3개 동작 애니메이션 가이드 */}
          <div className="space-y-3 mb-6">
            {['flexion', 'abduction', 'external_rotation'].map((key, idx) => (
              <div key={key} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
                <div className="shrink-0">
                  {getGuideComponent(key, 80)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 mb-0.5">
                    <span className="text-sky-500 mr-1">{idx + 1}.</span>
                    {STEP_INFO[key].title}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">{STEP_INFO[key].instruction}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 rounded-xl p-3.5 mb-6">
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">💡 팁:</span> 전신이 카메라에 보이도록 1~2m 거리에서 촬영해주세요.<br/>
              다른 사람이 찍어줄 수 있다면 <span className="font-semibold">후면 카메라</span>로 전환하세요. 측정 중 우상단 📷 버튼으로 전환할 수 있어요.
            </p>
          </div>

          {!poseLoaded && (
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                AI 모델 로딩 중...
              </div>
            </div>
          )}

          <div className="mt-auto space-y-2">
            <button
              onClick={nextMeasureStep}
              disabled={!poseLoaded}
              className={`w-full py-4 rounded-xl font-bold text-base transition ${poseLoaded ? 'text-white shadow-lg hover:brightness-110' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              style={poseLoaded ? { background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' } : {}}
            >
              {poseLoaded ? '측정 시작' : 'AI 모델 로딩 중...'}
            </button>
            <button
              onClick={skipMeasurement}
              className="w-full py-3 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-100 transition"
            >
              측정 건너뛰기 (설문 결과만 분석)
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ===== 측정 완료 화면 =====
  if (measureStep === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
            <h1 className="text-base font-bold text-slate-900">측정 완료</h1>
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #22C55E, #4ADE80)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">ROM 측정 완료!</h2>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm mb-6 space-y-3">
            {[
              { key: 'flexion', label: '굴곡', normal: 180 },
              { key: 'abduction', label: '외전', normal: 180 },
              { key: 'external_rotation', label: '외회전', normal: 90 },
            ].map(({ key, label, normal }) => {
              const val = rom[key as keyof RomResult]
              const pct = val ? Math.round((val / normal) * 100) : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="font-bold" style={{ color: pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {val !== null ? `${val}°` : '미측정'}
                      <span className="text-xs text-slate-400 font-normal"> / {normal}°</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={goToResult}
            className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg hover:brightness-110 transition"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
          >
            🤖 AI 분석 시작하기
          </button>
        </main>
      </div>
    )
  }

  // ===== 카메라 측정 화면 =====
  const stepInfo = STEP_INFO[measureStep]
  const isCaptured = capturedRef.current || rom[measureStep as keyof RomResult] !== null

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* 동작 가이드 오버레이 */}
      {showGuideOverlay && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 text-center">
              <p className="text-xs font-semibold text-sky-600 mb-1">
                {measureStep === 'flexion' ? '1' : measureStep === 'abduction' ? '2' : '3'}/3
              </p>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{stepInfo.title}</h3>
              <p className="text-sm text-slate-500 mb-4">{stepInfo.instruction}</p>

              <div className="flex justify-center mb-4 bg-slate-50 rounded-xl py-4">
                {getGuideComponent(measureStep, 140)}
              </div>

              <div className="bg-amber-50 rounded-lg p-3 mb-4 text-left">
                <p className="text-xs text-amber-800">
                  {measureStep === 'flexion' && '💡 카메라를 옆에서 보이도록 서세요. 팔을 앞으로 최대한 올려주세요.'}
                  {measureStep === 'abduction' && '💡 카메라를 정면에서 보이도록 서세요. 팔을 옆으로 최대한 올려주세요.'}
                  {measureStep === 'external_rotation' && '💡 팔꿈치를 옆구리에 붙인 채 90° 구부리고, 전완만 바깥으로 돌려주세요.'}
                </p>
              </div>

              <button
                onClick={() => setShowGuideOverlay(false)}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
              >
                준비 완료, 측정 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between z-10">
        <button onClick={() => { stopCamera(); router.push('/self-test') }} className="text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{stepInfo.title}</p>
          <p className="text-white/60 text-xs">
            {measureStep === 'flexion' ? '1' : measureStep === 'abduction' ? '2' : '3'}/3
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleCamera} className="text-white/80 bg-white/20 p-1.5 rounded-lg" title="카메라 전환">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 16V7a2 2 0 00-2-2h-3l-2-2H11L9 5H6a2 2 0 00-2 2v9m16 0H4m16 0l-1.5 3H5.5L4 16"/>
              <path d="M7 13l3-3 3 3"/>
              <path d="M17 13l-3-3-3 3"/>
            </svg>
          </button>
          <button onClick={() => setShowGuideOverlay(true)} className="text-white/80 text-xs bg-white/20 px-2 py-1.5 rounded-lg">
            가이드
          </button>
        </div>
      </div>

      {/* 카메라 에러 */}
      {cameraError && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <span className="text-4xl mb-4 block">📷</span>
            <p className="text-white font-bold mb-2">{cameraError}</p>
            <button onClick={skipMeasurement} className="mt-4 px-6 py-2 bg-white/20 rounded-lg text-white text-sm">
              측정 건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* 카메라 뷰 */}
      {!cameraError && (
        <div className="flex-1 relative">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : {}} playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

          {/* 상단 안내 + 미니 가이드 */}
          <div className="absolute top-3 left-3 right-3">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
              <div className="shrink-0 bg-white/10 rounded-lg p-1">
                {getGuideComponent(measureStep, 44)}
              </div>
              <p className="text-white text-xs flex-1">{stepInfo.instruction}</p>
            </div>
          </div>

          {/* 각도 표시 */}
          <div className="absolute bottom-32 left-0 right-0 flex justify-center">
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <p className="text-5xl font-bold text-white">{currentAngle}°</p>
              <p className="text-xs text-white/60 mt-1">최대: {maxAngle}°</p>
              {holdTimer > 0 && !isCaptured && (
                <div className="mt-2 w-32 h-1.5 bg-white/20 rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${(holdTimer / 2) * 100}%` }} />
                </div>
              )}
              {isCaptured && (
                <p className="text-green-400 text-sm font-bold mt-1">✓ 측정 완료!</p>
              )}
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="absolute bottom-6 left-4 right-4 flex gap-3">
            {!isCaptured ? (
              <button
                onClick={manualCapture}
                disabled={maxAngle < 10}
                className={`flex-1 py-3.5 rounded-xl font-bold text-sm ${maxAngle >= 10 ? 'bg-white text-slate-900' : 'bg-white/30 text-white/50'}`}
              >
                지금 각도로 측정 ({maxAngle}°)
              </button>
            ) : (
              <button
                onClick={nextMeasureStep}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}
              >
                {measureStep === 'external_rotation' ? '측정 완료' : '다음 동작 →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
