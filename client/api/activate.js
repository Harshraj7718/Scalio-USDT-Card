import { tiers } from './_data.js'

// Serverless functions have no shared memory between calls, so sign-ups are
// validated and acknowledged here but not stored. Connect a database
// (Vercel Postgres / KV, Supabase, ...) to keep them.
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { card: tier, email } = req.body || {}
  if (!tiers.some(t => t.id === tier) || !/^\S+@\S+\.\S+$/.test(email || '')) {
    return res.status(400).json({ error: 'Valid card and email required' })
  }
  return res.status(200).json({ ok: true, message: `You're on the list for ${tier.toUpperCase()}!` })
}
