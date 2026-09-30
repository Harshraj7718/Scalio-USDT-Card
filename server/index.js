import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const tiers = [
  { id: 'core', name: 'Scalio Core', balance: 1000, bonus: 10, cashback: 2, support: 'Standard',
    perks: ['Direct Trust Wallet real-time debit', 'Apple Pay & Google Pay support', 'Worldwide Visa / Mastercard acceptance', 'Biometric-protected virtual card details'] },
  { id: 'pro', name: 'Scalio Pro', balance: 5000, bonus: 15, cashback: 5, support: '24/7 Priority',
    perks: ['All Scalio Core benefits included', 'Higher daily spending and withdrawal caps', 'Zero foreign exchange (FX) transaction markup', '24/7 Priority support channel'] },
  { id: 'max', name: 'Scalio Max', balance: 10000, bonus: 20, cashback: 10, support: 'Dedicated VIP Concierge', popular: true,
    perks: ['Maximum 10% continuous purchase cashback', 'Highest instant activation reward (20% USDT)', 'VIP concierge & dedicated account manager', 'Premium physical card access upon launch'] },
]

const faqs = [
  { q: 'Do I need to preload or top up USDT before making a purchase?', a: 'No. Scalio uses direct settlement technology. Your USDT stays inside your Trust Wallet and is debited in real time only when you complete a transaction.' },
  { q: 'When do I receive the joining cashback?', a: 'The instant joining cashback (10%, 15%, or 20% depending on your chosen tier) is transferred directly into your connected Trust Wallet as USDT as soon as your card activation process is complete.' },
  { q: 'How does the purchase cashback work for everyday transactions?', a: 'Every time you make an online purchase or tap in-store using Apple Pay / Google Pay, you receive purchase cashback (2%, 5%, or 10% based on your tier) credited automatically back to your wallet.' },
  { q: 'Are there any monthly or annual renewal fees?', a: 'None. Every Scalio card tier comes with $0 joining fee and $0 annual fee for life.' },
]

app.get('/api/tiers', (_, res) => res.json(tiers))
app.get('/api/faqs', (_, res) => res.json(faqs))

const waitlist = []
app.post('/api/activate', (req, res) => {
  const { tier, email } = req.body || {}
  if (!tiers.some(t => t.id === tier) || !/^\S+@\S+\.\S+$/.test(email || ''))
    return res.status(400).json({ error: 'Valid tier and email required' })
  waitlist.push({ tier, email, at: new Date().toISOString() })
  res.json({ ok: true, message: `You're on the list for ${tier.toUpperCase()}!` })
})

const dist = path.join(__dirname, '../client/dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.use((_, res) => res.sendFile(path.join(dist, 'index.html')))
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Scalio server on http://localhost:${PORT}`))
