import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const BUCKET_NAME = 'user-videos'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  // Authorization 헤더 또는 session 쿠키에서 토큰 추출
  const authHeader = req.headers.get('authorization')
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    token = req.cookies.get('session')?.value || null
  }
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET as string
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded

    // 서명 검증
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return null

    // 만료 체크
    if (data.exp && data.exp * 1000 < Date.now()) return null

    return { id: data.userId, email: data.email, role: data.role || null }
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

  const videosWithUrls = await Promise.all(
    (data || []).map(async (video) => {
      const { data: urlData } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(video.storage_path, 3600)

      return {
        ...video,
        video_url: urlData?.signedUrl || null,
      }
    })
  )

  return NextResponse.json({ videos: videosWithUrls })
}

// POST: presigned URL 발급 또는 DB 레코드 생성
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'get_upload_url') {
    const ext = body.file_ext || 'mp4'
    const timestamp = Date.now()
    const storagePath = `${user.id}/${timestamp}.${ext}`

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('Presigned URL error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      upload_url: data.signedUrl,
      storage_path: storagePath,
      token: data.token,
    })
  }

  if (body.action === 'save_record') {
    const { title, description, storage_path, file_size_bytes } = body

    if (!storage_path) {
      return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 })
    }

    const { data: video, error } = await supabaseAdmin
      .from('user_exercise_videos')
      .insert({
        user_id: user.id,
        title: title || '운동 영상',
        description: description || null,
        storage_path,
        file_size_bytes: file_size_bytes || null,
        status: 'uploaded',
      })
      .select()
      .single()

    if (error) {
      console.error('DB insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, video })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
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

  const { data: video } = await supabaseAdmin
    .from('user_exercise_videos')
    .select('storage_path, user_id')
    .eq('id', videoId)
    .single()

  if (!video || video.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  }

  await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([video.storage_path])

  await supabaseAdmin
    .from('user_exercise_videos')
    .delete()
    .eq('id', videoId)

  return NextResponse.json({ success: true })
}
