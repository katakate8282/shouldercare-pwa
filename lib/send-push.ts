export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url?: string
) {
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    await fetch(`${baseUrl}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url, secret }),
    })
  } catch (err) {
    console.error('sendPushToUser error:', err)
  }
}
