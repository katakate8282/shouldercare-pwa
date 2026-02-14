import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import * as jose from 'jose'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const cookieStore = cookies()
  const token = cookieStore.get('sc_token')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)
    return payload as any
  } catch {
    return null
  }
}

// POST: 업로드 URL 발급 + DB 기록
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exercise_id, exercise_name, file_size, duration_seconds } = await req.json()

  // 파일 경로 생성
  const timestamp = Date.now()
  const storagePath = `user-videos/${user.userId}/${exercise_id}_${timestamp}.mp4`

  // Supabase Storage signed upload URL 발급
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('exercise-videos')
    .createSignedUploadUrl(storagePath)

  if (uploadError) {
    console.error('Upload URL error:', uploadError)
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }

  // 담당 트레이너 조회
  const { data: hp } = await supabase
    .from('hospital_patients')
    .select('assigned_trainer_id')
    .eq('user_id', user.userId)
    .eq('status', 'active')
    .single()

  // DB에 업로드 기록 생성
  const { data: record, error: dbError } = await supabase
    .from('video_uploads')
    .insert({
      user_id: user.userId,
      exercise_id,
      exercise_name,
      storage_path: storagePath,
      file_size_bytes: file_size || null,
      duration_seconds: duration_seconds || null,
      trainer_id: hp?.assigned_trainer_id || null,
      status: 'uploading',
    })
    .select()
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    return NextResponse.json({ error: 'Failed to save record' }, { status: 500 })
  }

  return NextResponse.json({
    upload_url: uploadData.signedUrl,
    upload_token: uploadData.token,
    storage_path: storagePath,
    record_id: record.id,
  })
}

// PATCH: 업로드 완료 상태 업데이트
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { record_id } = await req.json()

  const { error } = await supabase
    .from('video_uploads')
    .update({ status: 'uploaded' })
    .eq('id', record_id)
    .eq('user_id', user.userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  // 트레이너에게 푸시 알림
  const { data: upload } = await supabase
    .from('video_uploads')
    .select('trainer_id, exercise_name')
    .eq('id', record_id)
    .single()

  if (upload?.trainer_id) {
    const { data: trainer } = await supabase
      .from('users')
      .select('fcm_token, name')
      .eq('id', upload.trainer_id)
      .single()

    if (trainer?.fcm_token) {
      try {
        const { messaging } = await import('@/lib/firebase-admin')
        await messaging.send({
          token: trainer.fcm_token,
          notification: {
            title: '📹 새 운동 영상이 도착했어요!',
            body: `환자가 "${upload.exercise_name}" 운동 영상을 업로드했습니다.`,
          },
          webpush: { fcmOptions: { link: '/trainer' } },
        })
      } catch (e) {
        console.error('Push to trainer failed:', e)
      }
    }
  }

  return NextResponse.json({ success: true })
}

// GET: 트레이너가 환자 영상 목록 조회
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patient_id')
  const onlyUnviewed = searchParams.get('unviewed') === 'true'

  let query = supabase
    .from('video_uploads')
    .select('*, users!video_uploads_user_id_fkey(name)')
    .eq('status', 'uploaded')
    .order('created_at', { ascending: false })
    .limit(20)

  if (patientId) {
    query = query.eq('user_id', patientId)
  } else {
    query = query.eq('trainer_id', user.userId)
  }

  if (onlyUnviewed) {
    query = query.eq('trainer_viewed', false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }

  return NextResponse.json({ uploads: data || [] })
}
