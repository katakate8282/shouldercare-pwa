import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET as string))
    return payload as { id: string; role?: string }
  } catch {
    return null
  }
}

// GET: 영상 목록 조회
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patient_id')

  // 트레이너/관리자는 patient_id로 조회 가능
  let targetUserId = user.id
  if (patientId && (user.role === 'trainer' || user.role === 'admin')) {
    targetUserId = patientId
  }

  const { data, error } = await supabaseAdmin
    .from('user_exercise_videos')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 각 영상에 signed URL 생성
  const videosWithUrls = await Promise.all(
    (data || []).map(async (video) => {
      const { data: urlData } = await supabaseAdmin.storage
        .from('user-exercise-videos')
        .createSignedUrl(video.storage_path, 3600) // 1시간 유효

      return {
        ...video,
        video_url: urlData?.signedUrl || null,
      }
    })
  )

  return NextResponse.json({ videos: videosWithUrls })
}

// POST: 영상 업로드
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('video') as File
    const title = (formData.get('title') as string) || '운동 영상'
    const description = (formData.get('description') as string) || ''

    if (!file) return NextResponse.json({ error: 'No video file' }, { status: 400 })

    // 파일 크기 제한 (100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    // 허용 타입
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'mp4'
    const timestamp = Date.now()
    const storagePath = `${user.id}/${timestamp}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('user-exercise-videos')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // DB 레코드 생성
    const { data: video, error: dbError } = await supabaseAdmin
      .from('user_exercise_videos')
      .insert({
        user_id: user.id,
        title,
        description,
        storage_path: storagePath,
        file_size_bytes: file.size,
        status: 'uploaded',
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, video })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH: 트레이너 피드백 작성
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role !== 'trainer' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { video_id, feedback } = await req.json()
  if (!video_id || !feedback) {
    return NextResponse.json({ error: 'Missing video_id or feedback' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_exercise_videos')
    .update({
      trainer_feedback: feedback,
      trainer_id: user.id,
      feedback_at: new Date().toISOString(),
      status: 'reviewed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', video_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE: 영상 삭제
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('id')
  if (!videoId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // 본인 영상만 삭제 가능
  const { data: video } = await supabaseAdmin
    .from('user_exercise_videos')
    .select('storage_path, user_id')
    .eq('id', videoId)
    .single()

  if (!video || video.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  }

  // Storage 삭제
  await supabaseAdmin.storage
    .from('user-exercise-videos')
    .remove([video.storage_path])

  // DB 삭제
  await supabaseAdmin
    .from('user_exercise_videos')
    .delete()
    .eq('id', videoId)

  return NextResponse.json({ success: true })
}
