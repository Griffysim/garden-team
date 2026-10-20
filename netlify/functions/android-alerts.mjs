import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body)
})

// Small, read-only feed for the Android client. Never return photos, message
// bodies, accommodation notes, passwords, or another user's assigned tasks.
export async function handler(event) {
  if (event.httpMethod !== 'GET') return response(405, { error: 'GET required' })
  const auth = event.headers?.authorization || event.headers?.Authorization || ''
  if (!auth.startsWith('Bearer ')) return response(401, { error: 'Please sign in' })
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32 || !process.env.DATABASE_URL) {
    return response(503, { error: 'Service unavailable' })
  }
  let account
  try {
    const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || !payload.sub) return response(401, { error: 'Please sign in' })
    account = payload.sub
  } catch {
    return response(401, { error: 'Session expired. Please sign in again.' })
  }
  try {
    const sql = neon(process.env.DATABASE_URL)
    const users = await sql`SELECT id FROM users WHERE id=${account} AND active=TRUE LIMIT 1`
    if (!users.length) return response(401, { error: 'Please sign in' })
    const [messages, reads, tasks] = await Promise.all([
      sql`SELECT id,sender_id,created_at FROM messages WHERE recipient_id IS NULL OR recipient_id=${account} OR sender_id=${account} ORDER BY created_at DESC,id DESC LIMIT 500`,
      sql`SELECT message_id FROM message_reads WHERE user_id=${account} ORDER BY message_id DESC LIMIT 1000`,
      sql`SELECT id,assigned_to,status,due_date,updated_at FROM tasks WHERE assigned_to=${account} ORDER BY created_at DESC,id DESC LIMIT 500`
    ])
    return response(200, { messages, readMessageIds: reads.map(r => String(r.message_id)), tasks })
  } catch (error) {
    console.error('Android alert feed failed', error?.name || 'Error')
    return response(503, { error: 'Alert check temporarily unavailable' })
  }
}
