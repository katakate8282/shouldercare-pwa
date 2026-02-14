import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifyToken(token: string) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const secret = process.env.JWT_SECRET as string
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(decoded.data)).digest('hex')
    if (decoded.sig !== expectedSig) return null
    if (decoded.data.exp < Date.now()) return null
    return decoded.data
  } catch { return null }
}

function getToken(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get('session')?.value || req.cookies.get('sc_token')?.value || null
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: '인증이 만료되었습니다.' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 })
  if (newPassword.length < 6) return NextResponse.json({ error: '새 비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })

  const { data: user } = await supabase.from('users').select('id, password_hash').eq('id', payload.userId).single()
  if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })

  const storedHash = user.password_hash
  let valid = false
  if (storedHash?.startsWith('$2a$') || storedHash?.startsWith('$2b$')) {
    valid = await bcrypt.compare(currentPassword, storedHash)
  } else if (storedHash) {
    valid = storedHash === crypto.createHash('sha256').update(currentPassword).digest('hex')
  }
  if (!valid) return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 })

  const newHash = await bcrypt.hash(newPassword, 10)
  await supabase.from('users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('id', user.id)
  return NextResponse.json({ success: true })
}
