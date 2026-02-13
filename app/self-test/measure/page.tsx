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
    instruction: '카메라 앞에 서서 아픈 쪽 팔을 앞으로 천천히 올려주세요',
    emoji: '☝️',
  },
  abduction: {
    title: '외전 (Abduction)',
    instruction: '카메라 앞에 서서 아픈 쪽 팔을 옆으로 천천히 올려주세요',
    emoji: '🤸',
  },
  external_rotation: {
    title: '외회전 (External Rotation)',
    instruction: '팔꿈치를 90° 구부린 채 몸에 붙이고, 전완을 바깥으로 회전해주세요',
    emoji: '🔄',
  },
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

      // Pose 초기화
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
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
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

        // 미러링
        ctx.translate(canvasRef.current.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.restore()

        // 스켈레톤 그리기
        if (window.drawConnectors && window.POSE_CONNECTIONS) {
          ctx.save()
          ctx.translate(canvasRef.current.width, 0)
          ctx.scale(-1, 1)
          window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#0EA5E9', lineWidth: 2 })
          window.drawLandmarks(ctx, results.poseLandmarks, { color: '#0284C7', lineWidth: 1, radius: 3 })
          ctx.restore()
        }

        // 각도 계산
        const lm = results.poseLandmarks
        let angle = 0

        if (measureStep === 'flexion' || measureStep === 'abduction') {
          // 어깨(11/12) - 팔꿈치(13/14) vs 어깨-힙(23/24)
          const shoulder = lm[12] // 오른쪽 (카메라 미러 기준)
          const elbow = lm[14]
          const hip = lm[24]
          angle = calcAngle(elbow, shoulder, hip)
        } else if (measureStep === 'external_rotation') {
          // 외회전: 어깨-팔꿈치-손목 각도에서 외회전 추정
          const shoulder = lm[12]
          const elbow = lm[14]
          const wrist = lm[16]
          const rawAngle = calcAngle(shoulder, elbow, wrist)
          // 외회전은 팔꿈치 90도 기준 전완 회전이므로 보정
          angle = Math.max(0, Math.min(90, Math.abs(rawAngle - 90)))
        }

        if (measureStep !== 'intro' && measureStep !== 'done') {
          setCurrentAngle(angle)
          if (angle > maxAngleRef.current) {
            maxAngleRef.current = angle
            setMaxAngle(angle)
          }

          // 최대 각도 근처 2초 유지 시 캡처
          if (!capturedRef.current && angle >= maxAngleRef.current - 5 && maxAngleRef.current > 20) {
            if (!holdStartRef.current) {
              holdStartRef.current = Date.now()
            }
            const elapsed = (Date.now() - holdStartRef.current) / 1000
            setHoldTimer(Math.min(elapsed, 2))

            if (elapsed >= 2) {
              capturedRef.current = true
              // 측정 완료
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

      // 프레임 전송
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

  // 카메라 정리
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  // 다음 측정 단계
  const nextMeasureStep = () => {
    maxAngleRef.current = 0
    holdStartRef.current = null
    capturedRef.current = false
    setCurrentAngle(0)
    setMaxAngle(0)
    setHoldTimer(0)

    if (measureStep === 'intro') {
      setMeasureStep('flexion')
    } else if (measureStep === 'flexion') {
      setMeasureStep('abduction')
    } else if (measureStep === 'abduction') {
      setMeasureStep('external_rotation')
    } else if (measureStep === 'external_rotation') {
      stopCamera()
      setMeasureStep('done')
    }
  }

  // 카메라 시작 (측정 시작 시)
  useEffect(() => {
    if (measureStep !== 'intro' && measureStep !== 'done' && poseLoaded) {
      startCamera()
    }
    return () => {
      if (measureStep === 'done') stopCamera()
    }
  }, [measureStep, poseLoaded, startCamera, stopCamera])

  // 측정 완료 → 결과 페이지로
  const goToResult = () => {
    sessionStorage.setItem('selftest_rom', JSON.stringify(rom))
    router.push('/self-test/result')
  }

  // 수동 캡처 (2초 유지 못할 경우 대비)
  const manualCapture = () => {
    if (maxAngleRef.current > 10) {
      capturedRef.current = true
      const key = measureStep as keyof RomResult
      setRom(prev => ({ ...prev, [key]: maxAngleRef.current }))
    }
  }

  // 건너뛰기 (카메라 안될 때)
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
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>
              <span className="text-4xl">📸</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">카메라 ROM 측정</h2>
            <p className="text-sm text-slate-500">3가지 동작으로 어깨 가동범위를 측정합니다</p>
          </div>

          <div className="space-y-3 mb-8">
            {['flexion', 'abduction', 'external_rotation'].map((key, idx) => (
              <div key={key} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: '#FEF3C7' }}>
                  {STEP_INFO[key].emoji}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{idx + 1}. {STEP_INFO[key].title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{STEP_INFO[key].instruction}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 rounded-xl p-3.5 mb-6">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">💡 팁:</span> 전신이 카메라에 보이도록 1~2m 거리에서 촬영해주세요. 밝은 곳에서 측정하면 더 정확합니다.
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
        <button onClick={skipMeasurement} className="text-white/60 text-xs">건너뛰기</button>
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
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

          {/* 안내 오버레이 */}
          <div className="absolute top-4 left-4 right-4">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white text-sm text-center">{stepInfo.instruction}</p>
            </div>
          </div>

          {/* 각도 표시 */}
          <div className="absolute bottom-32 left-0 right-0 flex justify-center">
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <p className="text-5xl font-bold text-white">{currentAngle}°</p>
              <p className="text-xs text-white/60 mt-1">최대: {maxAngle}°</p>
              {/* 홀드 프로그레스 */}
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
