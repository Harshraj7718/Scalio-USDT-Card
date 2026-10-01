import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Card from './components/Card'
import Badge from './components/Badge'
import ScalioCardSpecimen from '@/components/ui/scalio-card-specimen'
// three.js is most of the bundle, so the background loads as its own chunk after first paint
const Covelight = lazy(() => import('@/components/ui/covelight'))

gsap.registerPlugin(ScrollTrigger, useGSAP)

const navLinks = [['Features', '#features'], ['Card Tiers', '#tiers'], ['Instant Bonus', '#how'], ['Security', '#security'], ['FAQs', '#faq']]

const compare = [
  ['Fund Custody', 'Preload into centralized bank/app balance', '100% Self-Custody in Trust Wallet'],
  ['Top-Up Process', 'Manual conversion and preloading required', 'Zero Top-Ups (Real-time USDT debit)'],
  ['Joining Cashback', 'None / Delayed in lockup tokens', 'Instant USDT deposited on activation'],
  ['Everyday Spend Cashback', '0.5% – 2% in volatile utility tokens', 'Up to 10% USDT on all online/offline spends'],
  ['Card Fees', 'Monthly maintenance & annual renewal fees', '$0 Joining Fee / $0 Annual Fee (Lifetime Free)'],
]

const steps = [
  ['01', 'Connect Your Trust Wallet', 'Link your self-custody Trust Wallet securely using WalletConnect or the Scalio web/mobile app interface.'],
  ['02', 'Select Tier & Activate Card', 'Choose your tier ($1k, $5k, or $10k). Activate for $0 and receive your instant joining cashback (10%, 15%, or 20%) deposited directly into your Trust Wallet as USDT.'],
  ['03', 'Tap, Spend & Earn', 'Add your digital card to Apple Pay or Google Pay. Spend online or tap at any POS — USDT is debited in real time and you earn up to 10% cashback on every transaction.'],
]

const security = [
  ['No Counterparty Risk', 'Scalio does not store your funds or hold custodial pools. Your USDT stays in your Trust Wallet until the exact millisecond a merchant charges your card.'],
  ['Instant In-App Freeze', 'Lock or unlock your card instantly with a single tap inside the mobile interface.'],
  ['Biometric & 3D Secure', 'Reveal card details, CVV, or confirm online checkouts using Face ID, Touch ID, or PIN authentication.'],
]

// same finishes as the three 3D cards in the hero: Core silver, Pro black, Max Scalio blue
const tierLook = { core: 'steel', pro: 'black', max: 'orange' }

const stats = [['120', '+', 'Countries reached'], ['2.6', 'K+', 'Active cardholders'], ['10', '%', 'Max cashback'], ['0', '$', 'Fees, forever']]

function Magnetic({ children, className = '', href = '#', onClick }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
    const move = e => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - r.left - r.width / 2) * 0.3)
      yTo((e.clientY - r.top - r.height / 2) * 0.3)
    }
    const leave = () => { xTo(0); yTo(0) }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave) }
  }, [])
  return <a ref={ref} href={href} onClick={onClick} className={`btn ${className}`}><span>{children}</span></a>
}

function TiltCard({ children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.4 })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.4 })
    const move = e => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
      ry((px - 0.5) * 12); rx(-(py - 0.5) * 12)
      el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`)
    }
    const leave = () => { rx(0); ry(0) }
    el.addEventListener('mousemove', move); el.addEventListener('mouseleave', leave)
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave) }
  }, [])
  return <div ref={ref} className={`tilt ${className}`}>{children}</div>
}

function splitWords(text) {
  return text.split(' ').map((w, i) => <span className="w" key={i}><span className="wi">{w}&nbsp;</span></span>)
}

export default function App() {
  const root = useRef(null)
  const [tiers, setTiers] = useState([])
  const [faqs, setFaqs] = useState([])
  const [open, setOpen] = useState(0)
  const [modal, setModal] = useState(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [bgReady, setBgReady] = useState(false)

  // start the WebGL background once the page itself has painted and the browser is idle
  useEffect(() => {
    const go = () => setBgReady(true)
    const idle = window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 700)
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : clearTimeout(idle))
  }, [])

  useEffect(() => {
    fetch('/api/tiers').then(r => r.json()).then(setTiers).catch(() => {})
    fetch('/api/faqs').then(r => r.json()).then(setFaqs).catch(() => {})
  }, [])

  const activate = async e => {
    e.preventDefault()
    try {
      const r = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: modal, email }) })
      const d = await r.json()
      setMsg(d.message || d.error)
      if (d.ok) setEmail('')
    } catch { setMsg('Server unreachable - is the Node server running?') }
  }

  useGSAP(() => {
    gsap.from('.nav', { y: -60, opacity: 0, duration: 1, ease: 'power4.out' })

    gsap.utils.toArray('[data-speed]').forEach(el => {
      gsap.to(el, {
        yPercent: parseFloat(el.dataset.speed) * 100, ease: 'none',
        scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
      })
    })

    gsap.utils.toArray('.reveal-words').forEach(el => {
      gsap.from(el.querySelectorAll('.wi'), {
        yPercent: 110, stagger: 0.06, duration: 1, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      })
    })
    gsap.utils.toArray('.fade-up').forEach(el => {
      gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } })
    })
    ;['.stat-grid', '.compare', '.steps', '.sec-list'].forEach(sel => {
      const c = document.querySelector(sel)
      if (!c) return
      gsap.from(c.children, { y: 70, opacity: 0, stagger: 0.15, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: c, start: 'top 85%' } })
    })

    gsap.utils.toArray('.count').forEach(el => {
      const o = { v: 0 }, end = parseFloat(el.dataset.end), dec = el.dataset.end.includes('.') ? 1 : 0
      gsap.to(o, { v: end, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 92%' }, onUpdate: () => { el.textContent = o.v.toFixed(dec) } })
    })

    gsap.to('.badge-ring', { rotate: 360, duration: 14, ease: 'none', repeat: -1 })

    // logo reveal: wipe in left to right while pulling focus, then a light sweep
    const reveal = gsap.timeline({
      paused: true, defaults: { ease: 'power4.out' },
      scrollTrigger: { trigger: '.mega-wrap', start: 'top 85%', toggleActions: 'play none none reset' },
    })
    reveal
      .fromTo('.mega-logo', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.6, ease: 'power3.inOut' })
      .fromTo('.mega', { scale: 0.86, filter: 'blur(26px)', opacity: 0, transformOrigin: '30% 50%' }, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 1.8, clearProps: 'filter' }, 0)
      .fromTo('.mega-shine', { backgroundPosition: '160% 0' }, { backgroundPosition: '-60% 0', duration: 1.6, ease: 'power2.inOut' }, 1.1)
    // gentle float once revealed
    gsap.to('.mega-logo', { y: -8, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })

    gsap.from('.steps-line i', { scaleY: 0, transformOrigin: 'top', ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 70%', scrub: true } })

    ScrollTrigger.create({ start: 80, onToggle: s => document.querySelector('.nav').classList.toggle('scrolled', s.isActive) })
  }, { scope: root })

  // tier cards / FAQs arrive from the API and change page height
  useEffect(() => {
    if (!tiers.length) return
    const ctx = gsap.context(() => {
      gsap.from('.tier-grid > *', { y: 70, opacity: 0, stagger: 0.15, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.tier-grid', start: 'top 85%' } })
    }, root)
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [tiers])
  useEffect(() => { ScrollTrigger.refresh() }, [faqs, open])

  return (
    <div ref={root} className="app">

      <header className="nav">
        <a className="logo" href="#top" aria-label="Scalio USDT Card"><img className="logo-img" src="/scalio-logo.webp" alt="Scalio USDT Card" /></a>
        <nav>{navLinks.map(([l, h]) => <a key={l} href={h}>{l}</a>)}</nav>
        <Magnetic className="sm" href="#tiers">Connect Wallet →</Magnetic>
      </header>

      <div id="top">
        {/* hero background: pinned behind the card section, scrolls away with it */}
        <div className="hero-bg" aria-hidden>
          {bgReady && (
            <Suspense fallback={null}>
              <Covelight
                trails={{ count: 90 }}
                stage={{ wallHeight: 900 }}
                glow={{ intensity: 0.75, exposure: 0.9, focusBlur: 0 }}
                pixelRatio={1.5}
                fps={30}
                pauseOnScroll
              />
            </Suspense>
          )}
        </div>
        <ScalioCardSpecimen
          ink="transparent"
          tiers={tiers.length === 3 ? tiers : undefined}
        />
      </div>

      <section className="sec" id="features">
        <div className="sec-head">
          <h2 className="reveal-words">{splitWords('Global Footprint. Real-Time Spending.')}</h2>
          <p className="fade-up">Global POS tap &amp; pay — fully compatible with Apple Pay and Google Pay worldwide. Your USDT stays under your private keys until the millisecond you pay.</p>
        </div>
        <div className="stat-grid">
          {stats.map(([n, s, l], i) => (
            <TiltCard key={l} className={`glass stat ${i === 0 ? 'hl' : ''}`}>
              <b>{s === '$' && '$'}<span className="count" data-end={n}>0</span>{s !== '$' && s}</b><small>{l}</small>
            </TiltCard>
          ))}
        </div>
      </section>

      <section className="sec light" id="compare">
        <div className="sec-head">
          <h2 className="reveal-words">{splitWords('Why Scalio is Built Differently')}</h2>
          <p className="fade-up">Experience true non-custodial crypto payments without traditional debit card friction.</p>
        </div>
        <div className="compare">
          <div className="row head"><span /><span>Traditional Prepaid Crypto Cards</span><span className="win">Scalio USDT Card</span></div>
          {compare.map(([k, a, b]) => (
            <div className="row glass" key={k}><strong>{k}</strong><span className="dim">{a}</span><span className="win">{b}</span></div>
          ))}
        </div>
      </section>


      <section className="sec" id="tiers">
        <div className="sec-head">
          <h2 className="reveal-words">{splitWords('Choose Your Tier. Unlock Maximum Rewards.')}</h2>
          <p className="fade-up">Select the tier that aligns with your Trust Wallet balance. All tiers include $0 joining fee and lifetime $0 annual fee.</p>
        </div>
        <div className="tier-grid">
          {tiers.map(t => (
            <TiltCard key={t.id} className={`glass tier ${t.popular ? 'popular' : ''}`}>
              {t.popular && <em className="pop">Most Popular</em>}
              <div className="tier-card">
                <Card variant={tierLook[t.id] || 'steel'} name={t.name.toUpperCase()} />
              </div>
              <h3>{t.name}</h3>
              <p className="bal">Target balance <b>${t.balance.toLocaleString()} USDT</b></p>
              <div className="big-nums">
                <div><b>{t.bonus}%</b><small>Instant joining cashback</small></div>
                <div><b>{t.cashback}%</b><small>Everyday cashback</small></div>
              </div>
              <ul>{t.perks.map(p => <li key={p}>{p}</li>)}</ul>
              <p className="fees">$0 joining · $0 annual · {t.support}</p>
              <Magnetic className="full" href="#tiers" onClick={e => { e.preventDefault(); setMsg(''); setModal(t.id) }}>Activate {t.name.split(' ')[1]} Tier</Magnetic>
            </TiltCard>
          ))}
          {!tiers.length && <p className="dim">Start the Node server to load tiers (npm run dev in /server).</p>}
        </div>
      </section>

      <section className="sec light" id="how">
        <div className="sec-head"><h2 className="reveal-words">{splitWords('How It Works')}</h2></div>
        <div className="steps">
          <div className="steps-line"><i /></div>
          {steps.map(([n, t, d]) => (
            <TiltCard key={n} className="glass step"><span className="num">{n}</span><h3>{t}</h3><p>{d}</p></TiltCard>
          ))}
        </div>
      </section>

      <section className="sec" id="security">
        <div className="sec-head"><h2 className="reveal-words">{splitWords('Your Keys. Your Crypto. Total Peace of Mind.')}</h2></div>
        <div className="sec-split">
          <div className="sec-list">
            {security.map(([t, d]) => <TiltCard key={t} className="glass sec-item"><h3>{t}</h3><p>{d}</p></TiltCard>)}
          </div>
          <div className="rings" data-speed="-0.06">
            <div className="ring r1" /><div className="ring r2" />
            <Card variant="steel" name="FROZEN" className="c-r1" />
            <Card variant="orange" name="ACTIVE" className="c-r2" />
          </div>
        </div>
      </section>

      <section className="sec narrow light" id="faq">
        <div className="sec-head"><h2 className="reveal-words">{splitWords('Frequently Asked Questions')}</h2></div>
        <div className="faq">
          {faqs.map((f, i) => (
            <div key={i} className={`glass faq-item ${open === i ? 'open' : ''}`} onClick={() => setOpen(open === i ? -1 : i)}>
              <div className="q"><span>{f.q}</span><i>{open === i ? '−' : '+'}</i></div>
              <div className="a"><p>{f.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta sec">
        <Badge className="cta-badge" />
        <h2 className="reveal-words">{splitWords('Activate Your Card. Claim Your Instant Bonus.')}</h2>
        <Magnetic href="#tiers">Activate Card &amp; Claim Bonus</Magnetic>
      </section>

      <div className="mega-wrap">
        <div className="mega-logo">
          <img className="mega" src="/scalio-logo.webp" alt="Scalio USDT Card" />
          <span className="mega-shine" aria-hidden />
        </div>
      </div>

      <footer>
        <div>
          <a className="logo" href="#top" aria-label="Scalio USDT Card"><img className="logo-img" src="/scalio-logo.webp" alt="Scalio USDT Card" /></a>
          <p className="dim">Scalio — True Self-Custody Real-Time Spending.</p>
          <p className="dim small">Supported Networks: TRON (TRC-20) | Ethereum (ERC-20) | BNB Chain (BEP-20)</p>
        </div>
        <div className="links">
          <a href="#features">Features</a><a href="#tiers">Card Tiers</a><a href="#security">Security</a>
          <a href="#top">Terms of Service</a><a href="#top">Privacy Policy</a>
        </div>
        <p className="copy">© 2026 Scalio. All rights reserved.</p>
      </footer>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <form className="glass modal" onClick={e => e.stopPropagation()} onSubmit={activate}>
            <h3>Activate {modal.toUpperCase()} tier</h3>
            <p className="dim">Enter your email to join the activation list.</p>
            <input type="email" required placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn full"><span>Submit</span></button>
            {msg && <p className="msg">{msg}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
