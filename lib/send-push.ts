export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url?: string
) {
  try {
    const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32)

    let baseUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`
    }

    await fetch(`${baseUrl}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url, secret }),
    })
  } catch (err) {
    console.error('sendPushToUser error:', err)
  }
}
