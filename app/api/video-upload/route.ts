import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// auth/me와 동일한 토큰 검증
function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded

    const secret = process.env.JWT_SECRET as string
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')

    if (sig !== expectedSig) return null
    if (data.exp < Date.now()) return null

    return { userId: data.userId, email: data.email }
  } catch {
    return null
  }
}

// auth/me와 동일한 인증 흐름
async function getUser(req: NextRequest) {
  // 1. Authorization 헤더
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const payload = verifyToken(token)
    if (payload) return payload
  }

  // 2. session 쿠키
  const sessionCookie = req.cookies.get('session')?.value
  if (sessionCookie) {
    const payload = verifyToken(sessionCookie)
    if (payload) return payload
  }

  return null
}

// POST: 업로드 URL 발급 + DB 기록
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { action } = body

    // action: 'get_upload_url' → presigned URL 발급
    if (action === 'get_upload_url') {
      const { file_name, content_type } = body
      const ext = file_name?.split('.').pop() || 'mp4'
      const timestamp = Date.now()
      const storagePath = `${user.userId}/${timestamp}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-videos')
        .createSignedUploadUrl(storagePath)

      if (uploadError) {
        console.error('Upload URL error:', uploadError)
        return NextResponse.json({ error: 'Failed to create upload URL: ' + uploadError.message }, { status: 500 })
      }

      return NextResponse.json({
        upload_url: uploadData.signedUrl,
        upload_token: uploadData.token,
        storage_path: storagePath,
      })
    }

    // action: 'save_record' → DB 레코드 저장 (업로드 완료 후)
    if (action === 'save_record') {
      const { title, description, storage_path, file_size_bytes, exercise_id, exercise_name } = body

      if (!storage_path) {
        return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 })
      }

      // 담당 트레이너 조회
      const { data: hp } = await supabase
        .from('hospital_patients')
        .select('assigned_trainer_id')
        .eq('user_id', user.userId)
        .eq('status', 'active')
        .single()

      // patient_assignments에서도 조회 (fallback)
      let trainerId = hp?.assigned_trainer_id || null
      if (!trainerId) {
        const { data: pa } = await supabase
          .from('patient_assignments')
          .select('trainer_id')
          .eq('patient_id', user.userId)
          .limit(1)
          .single()
        trainerId = pa?.trainer_id || null
      }

      const { data: record, error: dbError } = await supabase
        .from('video_uploads')
        .insert({
          user_id: user.userId,
          exercise_id: exercise_id || null,
          exercise_name: exercise_name || title || '운동 영상',
          storage_path,
          file_size_bytes: file_size_bytes || null,
          trainer_id: trainerId,
          status: 'uploaded',
          title: title || '운동 영상',
          description: description || null,
        })
        .select()
        .single()

      if (dbError) {
        console.error('DB insert error:', dbError)
        return NextResponse.json({ error: 'Failed to save record: ' + dbError.message }, { status: 500 })
      }

      // 트레이너에게 푸시 알림
      if (trainerId) {
        try {
          const { data: trainer } = await supabase
            .from('users')
            .select('fcm_token')
            .eq('id', trainerId)
            .single()

          if (trainer?.fcm_token) {
            const { messaging } = await import('@/lib/firebase-admin')
            await messaging.send({
              token: trainer.fcm_token,
              notification: {
                title: '📹 새 운동 영상이 도착했어요!',
                body: `환자가 "${title || '운동'}" 영상을 업로드했습니다.`,
              },
              webpush: { fcmOptions: { link: '/trainer' } },
            })
          }
        } catch (e) {
          console.error('Push to trainer failed:', e)
        }
      }

      return NextResponse.json({ success: true, record })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('video-upload POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// PATCH: 트레이너 피드백 작성
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { record_id, feedback } = await req.json()

    if (!record_id || !feedback) {
      return NextResponse.json({ error: 'Missing record_id or feedback' }, { status: 400 })
    }

    const { error } = await supabase
      .from('video_uploads')
      .update({
        trainer_feedback: feedback,
        trainer_viewed: true,
        feedback_at: new Date().toISOString(),
        status: 'reviewed',
      })
      .eq('id', record_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: 영상 목록 조회
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patient_id')

  try {
    let query = supabase
      .from('video_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (patientId) {
      // 트레이너가 특정 환자 영상 조회
      query = query.eq('user_id', patientId)
    } else {
      // 본인 영상 조회
      query = query.eq('user_id', user.userId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch: ' + error.message }, { status: 500 })
    }

    // 각 영상에 signed URL 생성
    const videosWithUrls = await Promise.all(
      (data || []).map(async (video) => {
        if (!video.storage_path) return { ...video, video_url: null }

        const { data: urlData } = await supabase.storage
          .from('user-videos')
          .createSignedUrl(video.storage_path, 3600)

        return {
          ...video,
          video_url: urlData?.signedUrl || null,
        }
      })
    )

    return NextResponse.json({ videos: videosWithUrls })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: 영상 삭제
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('id')
  if (!recordId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const { data: video } = await supabase
      .from('video_uploads')
      .select('storage_path, user_id')
      .eq('id', recordId)
      .single()

    if (!video || video.user_id !== user.userId) {
      return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
    }

    // Storage 삭제
    if (video.storage_path) {
      await supabase.storage
        .from('user-videos')
        .remove([video.storage_path])
    }

    // DB 삭제
    await supabase
      .from('video_uploads')
      .delete()
      .eq('id', recordId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
