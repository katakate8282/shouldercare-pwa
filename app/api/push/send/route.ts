import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'

// Firebase Admin 초기화 (중복 방지)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { token, title, body, data } = await req.json()

    if (!token || !title) {
      return NextResponse.json({ error: 'token and title required' }, { status: 400 })
    }

    const message = {
      token,
      notification: {
        title,
        body: body || '',
      },
      data: data || {},
      webpush: {
        fcmOptions: {
          link: data?.url || '/dashboard',
        },
      },
    }

    const response = await admin.messaging().send(message)

    return NextResponse.json({ success: true, messageId: response })
  } catch (error: any) {
    console.error('Push send error:', error)

    // 토큰이 만료되었거나 유효하지 않은 경우
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      return NextResponse.json({ error: 'invalid_token' }, { status: 410 })
    }

    return NextResponse.json({ error: 'Failed to send push' }, { status: 500 })
  }
}
