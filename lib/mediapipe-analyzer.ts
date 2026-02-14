/**
 * MediaPipe Pose 기반 관절 추출 및 각도 계산 유틸리티
 * 클라이언트(브라우저)에서 실행
 */

// MediaPipe 랜드마크 인덱스
const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
}

interface Landmark {
  x: number
  y: number
  z: number
  visibility: number
}

interface FrameData {
  timestamp: number
  landmarks: Landmark[]
}

interface AnalysisMetrics {
  frames_analyzed: number
  avg_angles: Record<string, number>
  max_angles: Record<string, number>
  min_angles: Record<string, number>
  movement_speed: string
  compensations: string[]
  reps_detected: number
  quality_score: number
  raw_angle_series: Record<string, number[]>
}

/**
 * 두 벡터 사이의 각도 계산 (degree)
 */
function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs(radians * (180 / Math.PI))
  if (angle > 180) angle = 360 - angle
  return Math.round(angle * 10) / 10
}

/**
 * 두 점 사이 거리 (정규화된 좌표)
 */
function distance(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/**
 * 비디오 엘리먼트에서 프레임 추출
 */
export async function extractFrames(videoElement: HTMLVideoElement, numFrames: number = 5): Promise<HTMLCanvasElement[]> {
  const duration = videoElement.duration
  const frames: HTMLCanvasElement[] = []
  const interval = duration / (numFrames + 1)

  for (let i = 1; i <= numFrames; i++) {
    const time = interval * i
    await seekVideo(videoElement, time)

    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(videoElement, 0, 0)
    frames.push(canvas)
  }

  return frames
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.currentTime = time
    video.onseeked = () => resolve()
  })
}

/**
 * MediaPipe Pose 초기화 및 실행
 */
export async function analyzePose(frames: HTMLCanvasElement[]): Promise<FrameData[]> {
  // @mediapipe/tasks-vision CDN 로드
  const vision = await loadMediaPipeVision()

  const poseLandmarker = await vision.PoseLandmarker.createFromOptions(
    await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    ),
    {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numPoses: 1,
    }
  )

  const frameDataList: FrameData[] = []

  for (let i = 0; i < frames.length; i++) {
    const result = poseLandmarker.detect(frames[i])

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0].map((lm: any) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility || 0,
      }))

      frameDataList.push({
        timestamp: i,
        landmarks,
      })
    }
  }

  poseLandmarker.close()
  return frameDataList
}

/**
 * MediaPipe Vision 동적 로드
 */
async function loadMediaPipeVision(): Promise<any> {
  if ((window as any).__mediapipeVision) {
    return (window as any).__mediapipeVision
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    script.type = 'module'

    // ESM 모듈은 script 태그로 직접 로드가 어려우므로 dynamic import 사용
    import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs' as any)
      .then((module) => {
        (window as any).__mediapipeVision = module
        resolve(module)
      })
      .catch(() => {
        // fallback: 글로벌 스크립트 방식
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
        s.onload = () => {
          const v = (window as any).vision || (window as any).mediapipeVision
          if (v) {
            (window as any).__mediapipeVision = v
            resolve(v)
          } else {
            reject(new Error('MediaPipe Vision 로드 실패'))
          }
        }
        s.onerror = () => reject(new Error('MediaPipe Vision 스크립트 로드 실패'))
        document.head.appendChild(s)
      })
  })
}

/**
 * 관절 데이터에서 운동별 각도/메트릭스 계산
 */
export function calculateMetrics(frameDataList: FrameData[], exerciseId: number): AnalysisMetrics {
  const angles: Record<string, number[]> = {}
  const compensations: string[] = []

  for (const frame of frameDataList) {
    const lm = frame.landmarks
    if (!lm || lm.length < 33) continue

    // 공통: 어깨 외전 각도 (팔-어깨-엉덩이)
    const leftAbduction = calculateAngle(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW])
    const rightAbduction = calculateAngle(lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_ELBOW])

    if (!angles['left_abduction']) angles['left_abduction'] = []
    if (!angles['right_abduction']) angles['right_abduction'] = []
    angles['left_abduction'].push(leftAbduction)
    angles['right_abduction'].push(rightAbduction)

    // 어깨 굴곡 각도 (엉덩이-어깨-손목, 측면 기준)
    const leftFlexion = calculateAngle(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_WRIST])
    const rightFlexion = calculateAngle(lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_WRIST])

    if (!angles['left_flexion']) angles['left_flexion'] = []
    if (!angles['right_flexion']) angles['right_flexion'] = []
    angles['left_flexion'].push(leftFlexion)
    angles['right_flexion'].push(rightFlexion)

    // 팔꿈치 각도
    const leftElbow = calculateAngle(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST])
    const rightElbow = calculateAngle(lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_ELBOW], lm[LANDMARKS.RIGHT_WRIST])

    if (!angles['left_elbow']) angles['left_elbow'] = []
    if (!angles['right_elbow']) angles['right_elbow'] = []
    angles['left_elbow'].push(leftElbow)
    angles['right_elbow'].push(rightElbow)

    // 어깨 으쓱 감지 (어깨-귀 거리)
    const leftShoulderHeight = lm[LANDMARKS.LEFT_SHOULDER].y
    const rightShoulderHeight = lm[LANDMARKS.RIGHT_SHOULDER].y
    const noseHeight = lm[LANDMARKS.NOSE].y

    const leftShoulderToNose = leftShoulderHeight - noseHeight
    const rightShoulderToNose = rightShoulderHeight - noseHeight

    if (!angles['shoulder_to_nose_left']) angles['shoulder_to_nose_left'] = []
    if (!angles['shoulder_to_nose_right']) angles['shoulder_to_nose_right'] = []
    angles['shoulder_to_nose_left'].push(leftShoulderToNose)
    angles['shoulder_to_nose_right'].push(rightShoulderToNose)

    // 몸통 각도 (어깨-엉덩이-무릎)
    const trunkAngle = calculateAngle(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE])
    if (!angles['trunk_angle']) angles['trunk_angle'] = []
    angles['trunk_angle'].push(trunkAngle)

    // 좌우 어깨 높이 차이
    const shoulderDiff = Math.abs(leftShoulderHeight - rightShoulderHeight)
    if (!angles['shoulder_symmetry']) angles['shoulder_symmetry'] = []
    angles['shoulder_symmetry'].push(shoulderDiff)
  }

  // 보상 동작 감지
  if (angles['shoulder_to_nose_left']) {
    const avgDist = average(angles['shoulder_to_nose_left'])
    const shrugFrames = angles['shoulder_to_nose_left'].filter(d => d < avgDist * 0.7).length
    if (shrugFrames > frameDataList.length * 0.3) {
      compensations.push(`어깨 으쓱 보상 동작 감지 (${shrugFrames}/${frameDataList.length} 프레임)`)
    }
  }

  // 좌우 비대칭 감지
  if (angles['shoulder_symmetry']) {
    const avgSymm = average(angles['shoulder_symmetry'])
    if (avgSymm > 0.05) {
      compensations.push('좌우 어깨 높이 비대칭 감지')
    }
  }

  // 메트릭스 계산
  const avgAngles: Record<string, number> = {}
  const maxAngles: Record<string, number> = {}
  const minAngles: Record<string, number> = {}

  for (const [key, values] of Object.entries(angles)) {
    avgAngles[key] = Math.round(average(values) * 10) / 10
    maxAngles[key] = Math.round(Math.max(...values) * 10) / 10
    minAngles[key] = Math.round(Math.min(...values) * 10) / 10
  }

  // 동작 속도 추정 (각도 변화율)
  let speed = '적절'
  if (angles['left_abduction'] && angles['left_abduction'].length >= 3) {
    const diffs = []
    for (let i = 1; i < angles['left_abduction'].length; i++) {
      diffs.push(Math.abs(angles['left_abduction'][i] - angles['left_abduction'][i - 1]))
    }
    const avgDiff = average(diffs)
    if (avgDiff > 30) speed = '빠름'
    else if (avgDiff < 5) speed = '느림'
  }

  // 반복 횟수 추정 (각도 피크 카운트)
  let reps = 0
  const primaryAngle = angles['left_abduction'] || angles['left_flexion'] || []
  if (primaryAngle.length >= 3) {
    for (let i = 1; i < primaryAngle.length - 1; i++) {
      if (primaryAngle[i] > primaryAngle[i - 1] && primaryAngle[i] > primaryAngle[i + 1]) {
        reps++
      }
    }
  }

  // 품질 점수 (0~100)
  let qualityScore = 100
  if (compensations.length > 0) qualityScore -= compensations.length * 15
  if (speed === '빠름') qualityScore -= 10
  qualityScore = Math.max(0, Math.min(100, qualityScore))

  return {
    frames_analyzed: frameDataList.length,
    avg_angles: avgAngles,
    max_angles: maxAngles,
    min_angles: minAngles,
    movement_speed: speed,
    compensations,
    reps_detected: reps,
    quality_score: qualityScore,
    raw_angle_series: angles,
  }
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/**
 * 전체 분석 파이프라인 (클라이언트에서 호출)
 * 1. 비디오 → 프레임 추출
 * 2. MediaPipe → 관절 추출
 * 3. 각도/메트릭스 계산
 * 4. 서버 API 호출
 */
export async function runFullAnalysis(
  videoUrl: string,
  videoId: string,
  exerciseId: number,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; analysis?: any; error?: string }> {
  try {
    onProgress?.('영상을 분석 준비 중...')

    // 1. 비디오 로드
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = true

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('영상을 불러올 수 없습니다'))
      video.src = videoUrl
    })

    onProgress?.('영상에서 프레임 추출 중...')

    // 2. 프레임 추출 (5개)
    const frames = await extractFrames(video, 5)

    if (frames.length === 0) {
      return { success: false, error: '영상에서 프레임을 추출할 수 없습니다.' }
    }

    onProgress?.('AI가 관절을 분석하고 있어요...')

    // 3. MediaPipe 관절 추출
    let frameDataList: FrameData[]
    try {
      frameDataList = await analyzePose(frames)
    } catch (mpError) {
      console.error('MediaPipe error:', mpError)
      return { success: false, error: '관절을 정확히 감지하지 못했어요. 촬영 가이드를 참고해서 다시 촬영해주세요.' }
    }

    if (frameDataList.length === 0) {
      return { success: false, error: '관절을 정확히 감지하지 못했어요. 전신이 보이게 밝은 곳에서 다시 촬영해주세요.' }
    }

    // 감지 비율 체크 (33개 중 절반 미만이면 실패)
    const avgVisibility = frameDataList.reduce((sum, frame) => {
      const visCount = frame.landmarks.filter(lm => lm.visibility > 0.5).length
      return sum + visCount
    }, 0) / frameDataList.length

    if (avgVisibility < 16) {
      return { success: false, error: '일부 관절만 감지되어 정확한 분석이 어렵습니다. 전신이 보이게 다시 촬영해주세요.' }
    }

    onProgress?.('AI가 자세를 분석하고 피드백을 작성하고 있어요...')

    // 4. 메트릭스 계산
    const metrics = calculateMetrics(frameDataList, exerciseId)

    // 5. 서버 API 호출
    const res = await fetch('/api/ai-analysis', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        exercise_id: exerciseId,
        joint_data: frameDataList,
        analysis_metrics: metrics,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || '분석 서버 오류' }
    }

    onProgress?.('분석 완료!')
    return { success: true, analysis: data.analysis, ...data }

  } catch (err) {
    console.error('Full analysis error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.',
    }
  }
}
