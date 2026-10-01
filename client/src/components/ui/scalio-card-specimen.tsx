"use client"

import * as React from "react"

/**
 * Scalio Card Specimen — a scroll-scrubbed product specimen built around one
 * object: a stack of three Scalio cards (Core, Pro, Max), modelled
 * procedurally and lit in raw WebGL. Adapted from the Lycoris type specimen;
 * the spider lily is replaced by the cards, the type frames by Scalio copy.
 *
 * Scroll is the timeline. Six frames — cover, card, tiers, zero fees, tap &
 * pay, activate — and between each one the camera orbits, the stack fans,
 * flies and turns, and the copy morphs from one layout into the next. The
 * cover word's first and last letters slide out to flank the fanned cards;
 * everything else rises, blurs and clips in on its own stagger.
 *
 * One file. React is the only import. The display face is loaded at runtime
 * with an injected <link>, never a CSS import.
 */

export type SpecimenLink = { label: string; href?: string }
export type SpecimenTier = {
  id: string
  name: string
  balance: number
  bonus: number
  cashback: number
  support: string
}
export type SpecimenStep = { n: string; title: string; text: string }

export type ScalioCardSpecimenProps = {
  /** Brand. The cover word, card faces, every caption. */
  name?: string
  product?: string
  year?: string
  /** The one line of facts at the foot of the cover. Keep it short. */
  highlight?: string
  /** Exactly three tiers; they are the three cards, back to front. */
  tiers?: SpecimenTier[]
  /** Tap & pay frame, one entry per line. `small` lines ride beside the big ones. */
  tagline?: { text: string; small?: boolean }[]
  /** Finale line. Middle dots are drawn in the accent. */
  networks?: string
  networkDetail?: string
  steps?: SpecimenStep[]
  /** The word the circle is drawn over in the last frame. */
  cta?: SpecimenLink
  /** Bottom bar in the last frame. */
  links?: [SpecimenLink, SpecimenLink]
  fontFamily?: string
  /** Logo printed on the back of the cards. Must be same-origin or CORS-enabled. */
  logoSrc?: string
  /** Stylesheet for the display face. `null` loads nothing. */
  fontHref?: string | null
  ink?: string
  /** The type colour. */
  bone?: string
  /** The Max card, the glow, every filled element. */
  accent?: string
  /** Accent for small text on the dark ground, where `accent` would be too dark to read. */
  accentText?: string
  /** Height of the sticky stage. Must be a definite length. */
  height?: string
  /** Stage-heights of scroll per frame. */
  sceneScroll?: number
  /** Slow idle turn, pointer tilt and card sway. Reduced motion stops them. */
  alive?: boolean
  className?: string
}

// #region card geometry
type V3 = [number, number, number]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** ISO/IEC 7810 ID-1 proportions: 85.6 × 53.98 mm. */
const CARD_W = 1.712
const CARD_H = 1.08
const CARD_T = 0.024
const CARD_R = 0.09
const CARDS = 3
/** The fan pivots about a point below the stack, like a hand of cards. */
const PIVOT_Y = -0.95
const FAN_ANGLE = 0.34
/** Closest the cards' planes ever get; well over CARD_T, so they never touch. */
const MIN_GAP = 0.07
/** Bounding radius of the fully fanned stack about the heart. */
const RADIUS = 1.3
const HEART: V3 = [0, 0, 0]

/** Rounded-rectangle outline, counter-clockwise. */
const outline = () => {
  const pts: [number, number][] = []
  const seg = 8
  const cx = CARD_W / 2 - CARD_R
  const cy = CARD_H / 2 - CARD_R
  const corners: [number, number, number][] = [
    [cx, -cy, -Math.PI / 2],
    [cx, cy, 0],
    [-cx, cy, Math.PI / 2],
    [-cx, -cy, Math.PI],
  ]
  for (const [x, y, a0] of corners)
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2)
      pts.push([x + Math.cos(a) * CARD_R, y + Math.sin(a) * CARD_R])
    }
  return pts
}

/** Interleaved vertex layout: pos 3, normal 3, uv 2, card 1, material 1. */
const STRIDE = 10
/** Materials: 0 printed face, 1 milled edge, 2 back. */
const buildMesh = () => {
  const v: number[] = []
  const idx: number[] = []
  let count = 0
  const push = (x: number, y: number, z: number, n: V3, u: number, w: number, ci: number, mat: number) => {
    v.push(x, y, z, n[0], n[1], n[2], u, w, ci, mat)
    return count++
  }
  const ol = outline()
  const n = ol.length
  const hz = CARD_T / 2
  for (let ci = 0; ci < CARDS; ci++) {
    // front face samples its own third of the face atlas
    const fu = (x: number) => (x + CARD_W / 2) / CARD_W
    const fv = (y: number) => (ci + (CARD_H / 2 - y) / CARD_H) / CARDS
    const c0 = push(0, 0, hz, [0, 0, 1], fu(0), fv(0), ci, 0)
    const f = ol.map(([x, y]) => push(x, y, hz, [0, 0, 1], fu(x), fv(y), ci, 0))
    for (let i = 0; i < n; i++) idx.push(c0, f[i], f[(i + 1) % n])

    // back face samples its own back atlas; u is mirrored because the back is seen from behind
    const bv = (y: number) => (ci + (CARD_H / 2 - y) / CARD_H) / CARDS
    const b0 = push(0, 0, -hz, [0, 0, -1], 0.5, bv(0), ci, 2)
    const b = ol.map(([x, y]) => push(x, y, -hz, [0, 0, -1], 1 - fu(x), bv(y), ci, 2))
    for (let i = 0; i < n; i++) idx.push(b0, b[(i + 1) % n], b[i])

    // milled edge, hard-normalled so the rim catches a bright line
    for (let i = 0; i < n; i++) {
      const [x0, y0] = ol[i]
      const [x1, y1] = ol[(i + 1) % n]
      const nr = norm([y1 - y0, -(x1 - x0), 0])
      const a = push(x0, y0, hz, nr, 0, 0, ci, 1)
      const bb = push(x1, y1, hz, nr, 0, 0, ci, 1)
      const c = push(x1, y1, -hz, nr, 0, 0, ci, 1)
      const d = push(x0, y0, -hz, nr, 0, 0, ci, 1)
      idx.push(a, bb, c, a, c, d)
    }
  }
  return { data: new Float32Array(v), index: new Uint16Array(idx) }
}

/** Same pose as the vertex shader (minus the idle float), for the 2D fallback. */
const cardPoint = (x: number, y: number, ci: number, k: { fan: number; slide: number; gap: number }, morph: number, d: number): V3 => {
  const i = ci - 1
  const a = -i * FAN_ANGLE * k.fan * d + i * 0.14 * morph
  const c = Math.cos(a)
  const s = Math.sin(a)
  const py = y - PIVOT_Y
  return [
    c * x - s * py + i * (k.slide * d - 0.2 * morph),
    s * x + c * py + PIVOT_Y + i * k.slide * 0.28 * d,
    i * (MIN_GAP + (k.gap - MIN_GAP) * d + 0.28 * morph),
  ]
}

/** Overshoots a touch past 1 and settles, like a card snapped down on a table. */
const easeOutBack = (t: number) => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
// #endregion

// #region card faces
const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => {
    let s = h.replace("#", "").trim()
    if (s.length === 3) s = s.split("").map((c) => c + c).join("")
    const n = parseInt(s.slice(0, 6), 16) || 0
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const x = p(a)
  const y = p(b)
  return "rgb(" + x.map((c, i) => Math.round(c + (y[i] - c) * t)).join(",") + ")"
}

const FACE_W = 1024
const FACE_H = Math.round((FACE_W * CARD_H) / CARD_W)

/** Prints the three card faces, stacked, into one atlas canvas. */
const paintFaces = (cv: HTMLCanvasElement, brand: string, tiers: SpecimenTier[], accent: string, font: string) => {
  cv.width = FACE_W
  cv.height = FACE_H * CARDS
  const g = cv.getContext("2d")
  if (!g) return
  const looks = [
    { bg: ["#e4e5ea", "#a9abb3", "#6f7179"], fg: "#0d0d10", sub: "rgba(13,13,16,0.6)" },
    { bg: ["#26262b", "#101013", "#030304"], fg: "#f4f4f5", sub: "rgba(244,244,245,0.55)" },
    { bg: [mixHex(accent, "#ffffff", 0.22), accent, mixHex(accent, "#000000", 0.55)], fg: "#ffffff", sub: "rgba(255,255,255,0.65)" },
  ]
  const ls = (px: number) => {
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = px + "px"
  }
  for (let i = 0; i < CARDS; i++) {
    const L = looks[i]
    const t = tiers[i]
    const y0 = i * FACE_H
    const grad = g.createLinearGradient(0, y0, FACE_W, y0 + FACE_H)
    grad.addColorStop(0, L.bg[0])
    grad.addColorStop(0.55, L.bg[1])
    grad.addColorStop(1, L.bg[2])
    g.fillStyle = grad
    g.fillRect(0, y0, FACE_W, FACE_H)

    // guilloché: fine concentric arcs off the right edge
    g.save()
    g.strokeStyle = L.sub
    g.globalAlpha = 0.18
    g.lineWidth = 1.5
    for (let r = 120; r < 900; r += 26) {
      g.beginPath()
      g.arc(FACE_W * 1.02, y0 + FACE_H * 0.1, r, 0, Math.PI * 2)
      g.stroke()
    }
    g.restore()

    g.textBaseline = "alphabetic"
    g.fillStyle = L.fg
    g.textAlign = "left"
    ls(-1)
    g.font = "600 64px " + font
    g.fillText(brand, 70, y0 + 118)
    ls(4)
    g.font = "500 24px " + font
    g.fillStyle = L.sub
    g.fillText((t?.name.split(" ").slice(1).join(" ") || "").toUpperCase(), 72, y0 + 160)

    g.fillStyle = L.fg
    g.textAlign = "right"
    ls(2)
    g.font = "italic 800 70px " + font
    g.fillText("VISA", FACE_W - 70, y0 + 120)

    // chip
    const cx = 72
    const cy = y0 + 225
    const chip = g.createLinearGradient(cx, cy, cx + 124, cy + 92)
    chip.addColorStop(0, "#f2f2f4")
    chip.addColorStop(1, "#8e9098")
    g.fillStyle = chip
    g.beginPath()
    g.roundRect(cx, cy, 124, 92, 14)
    g.fill()
    g.strokeStyle = "rgba(0,0,0,0.35)"
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cx, cy + 46); g.lineTo(cx + 124, cy + 46)
    g.moveTo(cx + 44, cy); g.lineTo(cx + 44, cy + 92)
    g.moveTo(cx + 80, cy); g.lineTo(cx + 80, cy + 92)
    g.stroke()

    // contactless
    g.strokeStyle = L.fg
    g.lineWidth = 6
    g.lineCap = "round"
    for (let k = 0; k < 4; k++) {
      g.beginPath()
      g.arc(cx + 190, cy + 46, 14 + k * 14, -0.75, 0.75)
      g.stroke()
    }

    g.textAlign = "left"
    g.fillStyle = L.fg
    ls(7)
    g.font = "500 60px " + font
    g.fillText("2243 6652 9435 9982", 70, y0 + 440)

    const cols: [string, string][] = [
      ["CARD", (t?.name || brand).toUpperCase()],
      ["JOINING BONUS", (t ? t.bonus : 0) + "% USDT"],
      ["CASHBACK", (t ? t.cashback : 0) + "%"],
    ]
    let x = 72
    for (const [k, val] of cols) {
      ls(3)
      g.font = "500 20px " + font
      g.fillStyle = L.sub
      g.fillText(k, x, y0 + 540)
      ls(1)
      g.font = "600 32px " + font
      g.fillStyle = L.fg
      g.fillText(val, x, y0 + 582)
      x += Math.max(250, g.measureText(val).width + 60)
    }
    ls(0)
  }
}

/** Prints the three card backs: magnetic stripe, the Scalio logo, one line of small print. */
const paintBacks = (cv: HTMLCanvasElement, tiers: SpecimenTier[], accent: string, font: string, logo: HTMLImageElement | null) => {
  cv.width = FACE_W
  cv.height = FACE_H * CARDS
  const g = cv.getContext("2d")
  if (!g) return
  const looks = [
    { bg: ["#d9dae0", "#9fa1a9", "#666870"], sub: "rgba(13,13,16,0.6)" },
    { bg: ["#1f1f24", "#0d0d10", "#030304"], sub: "rgba(244,244,245,0.5)" },
    { bg: [mixHex(accent, "#ffffff", 0.16), accent, mixHex(accent, "#000000", 0.6)], sub: "rgba(255,255,255,0.6)" },
  ]
  for (let i = 0; i < CARDS; i++) {
    const L = looks[i]
    const y0 = i * FACE_H
    const grad = g.createLinearGradient(FACE_W, y0, 0, y0 + FACE_H)
    grad.addColorStop(0, L.bg[0])
    grad.addColorStop(0.55, L.bg[1])
    grad.addColorStop(1, L.bg[2])
    g.fillStyle = grad
    g.fillRect(0, y0, FACE_W, FACE_H)

    // guilloché arcs, mirrored to the left edge since this is the reverse side
    g.save()
    g.strokeStyle = L.sub
    g.globalAlpha = 0.14
    g.lineWidth = 1.5
    for (let r = 120; r < 900; r += 26) {
      g.beginPath()
      g.arc(-FACE_W * 0.02, y0 + FACE_H * 0.95, r, 0, Math.PI * 2)
      g.stroke()
    }
    g.restore()

    // magnetic stripe
    const sy = y0 + FACE_H * 0.12
    const sh = FACE_H * 0.18
    const stripe = g.createLinearGradient(0, sy, 0, sy + sh)
    stripe.addColorStop(0, "#0a0a0c")
    stripe.addColorStop(0.5, "#17171b")
    stripe.addColorStop(1, "#050506")
    g.fillStyle = stripe
    g.fillRect(0, sy, FACE_W, sh)

    // the logo, centred below the stripe
    const lw = FACE_W * 0.54
    if (logo && logo.naturalWidth) {
      const lh = (lw * logo.naturalHeight) / logo.naturalWidth
      const lx = (FACE_W - lw) / 2
      const ly = y0 + FACE_H * 0.62 - lh / 2
      g.save()
      g.shadowColor = i === 2 ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)"
      g.shadowBlur = 14
      g.shadowOffsetY = 3
      g.drawImage(logo, lx, ly, lw, lh)
      g.restore()
    } else {
      g.fillStyle = "rgba(255,255,255,0.85)"
      g.textAlign = "center"
      g.font = "600 84px " + font
      g.fillText("Scalio", FACE_W / 2, y0 + FACE_H * 0.66)
    }

    // fine print
    g.textAlign = "center"
    g.fillStyle = L.sub
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "3px"
    g.font = "500 17px " + font
    g.fillText(((tiers[i]?.name || "Scalio") + "  ·  REAL-TIME USDT  ·  NON-CUSTODIAL").toUpperCase(), FACE_W / 2, y0 + FACE_H * 0.92)
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px"
  }
}

// #endregion

// #region scroll
const clamp01 = (x: number) => (x <= 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** 0 while the root's top sits at the stage's top, 1 when its bottom does. */
const progressFrom = (top: number, height: number, viewport: number) => {
  const travel = height - viewport
  if (travel <= 0) return 0
  return clamp01(-top / travel)
}

/**
 * Scroll progress → a continuous frame coordinate in 0..n-1. Integers are the
 * frames; each one holds for `hold` of its slot so the layout can be read
 * before the next morph starts.
 */
const sceneCoord = (p: number, n: number, hold: number) => {
  if (n <= 1) return 0
  const t = clamp01(p) * (n - 1)
  const i = Math.min(Math.floor(t), n - 2)
  const h = hold / 2
  return i + easeInOut(clamp01((t - i - h) / (1 - 2 * h)))
}

/**
 * How present one element of frame `scene` is at `coord`. `delay` 0..1 staggers
 * it: late on the way in, and — mirrored — late on the way out.
 */
const reveal = (coord: number, scene: number, delay: number) => {
  const d = coord - scene
  const lag = d < 0 ? delay : 1 - delay
  return clamp01((0.6 - Math.abs(d) - lag * 0.2) / 0.25)
}
// #endregion

// ---- camera frames -------------------------------------------------------

type Key = {
  /** turn of the stack about its vertical axis, radians */
  spin: number
  /** camera elevation, degrees; +90 looks straight down */
  el: number
  /** stack radius as a fraction of the stage's short side */
  size: number
  /** where the heart lands, in clip space (-1..1, +y up) */
  ox: number
  oy: number
  /** 0 stacked, 1 fanned like a hand */
  fan: number
  /** diagonal cascade: each card steps out sideways and up from the one behind */
  slide: number
  /** distance between the cards' planes; MIN_GAP is a tight stack, 0.5+ an exploded view */
  gap: number
}

const KEYS: Key[] = [
  // cover: a diagonal cascade stepping back in depth
  { spin: -0.5, el: 12, size: 0.6, ox: 0, oy: 0.3, fan: 0.15, slide: 0.32, gap: 0.3 },
  // card: a full hand
  { spin: 0, el: 4, size: 0.56, ox: 0, oy: 0, fan: 1, slide: 0, gap: 0.12 },
  // tiers: exploded, one layer per tier
  { spin: 0.62, el: 18, size: 0.27, ox: 0, oy: 0.42, fan: 0, slide: 0, gap: 0.55 },
  // zero fees: squared up tight, seen from behind
  { spin: Math.PI - 0.35, el: -22, size: 0.66, ox: 0, oy: -0.32, fan: 0.08, slide: 0, gap: MIN_GAP },
  // tap & pay: half fan with a lean
  { spin: Math.PI * 2 - 0.55, el: 14, size: 0.66, ox: 0.56, oy: 0.1, fan: 0.55, slide: 0.22, gap: 0.28 },
  // activate: the hand again, sitting just above the call to action
  { spin: Math.PI * 2 + 0.25, el: 8, size: 0.36, ox: 0, oy: 0.45, fan: 1, slide: 0, gap: 0.14 },
]
// Portrait stages move the stack rather than squeezing the type.
const KEYS_TALL: Partial<Key>[] = [
  { size: 0.82, oy: 0.36 },
  { size: 0.8 },
  { size: 0.36, oy: 0.46 },
  { size: 0.9, oy: -0.22 },
  { size: 0.66, ox: 0, oy: 0.48 },
  { size: 0.5, oy: 0.6 },
]
const SCENES = KEYS.length
const HOLD = 0.34
const NAV = ["Cover", "Card", "Rewards", "Zero Fees", "Tap & Pay", "Activate"]

const keyAt = (coord: number, tall: boolean): Key => {
  const i = Math.max(0, Math.min(SCENES - 1, Math.floor(coord)))
  const j = Math.min(SCENES - 1, i + 1)
  const f = coord - i
  const a = { ...KEYS[i], ...(tall ? KEYS_TALL[i] : {}) }
  const b = { ...KEYS[j], ...(tall ? KEYS_TALL[j] : {}) }
  const l = (x: number, y: number) => x + (y - x) * f
  return {
    spin: l(a.spin, b.spin), el: l(a.el, b.el), size: l(a.size, b.size),
    ox: l(a.ox, b.ox), oy: l(a.oy, b.oy), fan: l(a.fan, b.fan),
    slide: l(a.slide, b.slide), gap: l(a.gap, b.gap),
  }
}

// ---- matrices (column-major) ----------------------------------------------

type M4 = Float32Array
const perspective = (fovy: number, aspect: number, near: number, far: number): M4 => {
  const f = 1 / Math.tan(fovy / 2)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}
const lookAt = (eye: V3, at: V3): M4 => {
  const z = norm(sub(eye, at))
  const x = norm(cross([0, 1, 0], z))
  const y = cross(z, x)
  const m = new Float32Array(16)
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]
  m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye); m[15] = 1
  return m
}
const multiply = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  return o
}
const rotY = (t: number): M4 => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])
}
const rotX = (t: number): M4 => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1])
}

const hexToLinear = (hex: string): V3 => {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0.025, 0.034, 0.216]
  const ch = (v: number) => Math.pow(v / 255, 2.2)
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)]
}

// ---- shaders --------------------------------------------------------------

const VERT = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec2 a_uv;
attribute vec2 a_mat;
uniform mat4 u_vp;
uniform mat4 u_model;
uniform vec2 u_offset;
uniform float u_time;
uniform float u_fan;
uniform float u_slide;
uniform float u_gap;
uniform float u_morph;
uniform float u_sway;
uniform vec3 u_deal;
varying vec3 v_n;
varying vec3 v_w;
varying vec2 v_uv;
varying float v_ci;
varying float v_mat;
mat3 rz(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// Every card only ever rotates about its own normal and translates, so the
// three stay in parallel planes a fixed gap apart and can never cut through
// one another, however hard they fan, slide or float.
void main() {
  float i = a_mat.x - 1.0;
  float d = a_mat.x < 0.5 ? u_deal.x : (a_mat.x < 1.5 ? u_deal.y : u_deal.z);
  float ph = u_time + a_mat.x * 2.1;
  float ang = -i * ${FAN_ANGLE.toFixed(3)} * u_fan * d + i * 0.14 * u_morph + sin(ph * 0.7) * 0.03 * u_sway;
  mat3 R = rz(ang);
  vec3 pivot = vec3(0.0, ${PIVOT_Y.toFixed(3)}, 0.0);
  vec3 p = R * (a_pos - pivot) + pivot;
  p.x += i * (u_slide * d - 0.2 * u_morph);
  p.y += i * u_slide * 0.28 * d + sin(ph * 1.1) * 0.035 * u_sway;
  float breathe = 0.03 * (0.5 + 0.5 * sin(u_time * 0.9)) * u_sway;
  p.z += i * (${MIN_GAP.toFixed(3)} + (u_gap - ${MIN_GAP.toFixed(3)}) * d + 0.28 * u_morph + breathe);
  vec4 w = u_model * vec4(p, 1.0);
  v_w = w.xyz;
  v_n = (u_model * vec4(R * a_nrm, 0.0)).xyz;
  v_uv = a_uv;
  v_ci = a_mat.x;
  v_mat = a_mat.y;
  gl_Position = u_vp * w;
  gl_Position.xy += u_offset * gl_Position.w;
}
`

// A dark studio with one overhead softbox, a tall side strip and a back rim.
// The printed face is mostly diffuse under a clear lacquer; the milled edge
// and the back are near-mirror.
const FRAG = `
precision highp float;
uniform vec3 u_eye;
uniform vec3 u_accent;
uniform sampler2D u_tex;
uniform sampler2D u_back;
uniform float u_hasTex;
varying vec3 v_n;
varying vec3 v_w;
varying vec2 v_uv;
varying float v_ci;
varying float v_mat;
float studio(vec3 r) {
  float key = pow(max(dot(r, normalize(vec3(-0.45, 0.85, 0.35))), 0.0), 18.0) * 2.4;
  float strip = smoothstep(0.6, 0.85, r.x) * smoothstep(-0.7, 0.3, r.y) * 1.2;
  float rim = smoothstep(0.55, 0.95, -r.z) * smoothstep(-0.2, 0.5, r.y) * 0.8;
  float hz = exp(-abs(r.y - 0.05) * 7.0) * 0.3;
  return key + strip + rim + hz;
}
vec3 tint(float ci) {
  if (ci < 0.5) return vec3(0.36, 0.37, 0.4);
  if (ci < 1.5) return vec3(0.008, 0.008, 0.01);
  return u_accent;
}
void main() {
  vec3 n = normalize(v_n);
  vec3 v = normalize(u_eye - v_w);
  if (dot(n, v) < 0.0) n = -n;
  vec3 r = reflect(-v, n);
  float e = studio(r);
  float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float dif = max(dot(n, normalize(vec3(-0.3, 0.8, 0.6))), 0.0);
  vec3 base = tint(v_ci);
  float gloss = 0.4;
  if (v_mat < 0.5) {
    if (u_hasTex > 0.5) base = pow(texture2D(u_tex, v_uv).rgb, vec3(2.2));
    gloss = 0.22;
  } else if (v_mat > 1.5) {
    if (u_hasTex > 0.5) base = pow(texture2D(u_back, v_uv).rgb, vec3(2.2));
    gloss = 0.26;
  } else {
    gloss = 1.0;
  }
  vec3 col = base * (0.45 + 0.9 * dif);
  col += (base * 0.5 + vec3(0.35)) * e * gloss;
  col += vec3(0.5) * fr * 0.35;
  col = 1.0 - exp(-col * 1.6);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}
`

// ---- copy ------------------------------------------------------------------

const DISPLAY = '"Outfit", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif'
const SANS = '"Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif'
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"

const DEFAULT_TIERS: SpecimenTier[] = [
  { id: "core", name: "Scalio Core", balance: 1000, bonus: 10, cashback: 2, support: "Standard" },
  { id: "pro", name: "Scalio Pro", balance: 5000, bonus: 15, cashback: 5, support: "24/7 Priority" },
  { id: "max", name: "Scalio Max", balance: 10000, bonus: 20, cashback: 10, support: "Dedicated VIP Concierge" },
]
const DEFAULT_TAGLINE = [
  { text: "Tap" },
  { text: "and pay anywhere", small: true },
  { text: "Earn" },
  { text: "on every spend", small: true },
]
const DEFAULT_STEPS: SpecimenStep[] = [
  { n: "01", title: "Connect", text: "Trust Wallet via WalletConnect" },
  { n: "02", title: "Activate", text: "Pick a card, claim your bonus" },
  { n: "03", title: "Tap & earn", text: "Real-time USDT debit" },
]

// Scoped by the scs- prefix. No CSS imports, no bare element resets.
const CSS =
  ".scs-stage{container-type:size;container-name:scs}" +
  ".scs-char{display:inline-block;animation:scs-in 1.3s cubic-bezier(.2,.8,.2,1) both}" +
  "@keyframes scs-in{from{opacity:0;transform:translateY(0.35em) rotate(4deg);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}" +
  ".scs-g{display:inline-block;transition:color .25s,transform .25s cubic-bezier(.2,.8,.2,1);cursor:default}" +
  ".scs-g:hover{color:var(--scs-accent);transform:translateY(-0.04em) scale(1.12)}" +
  ".scs-edit{outline:none;cursor:text;border-bottom:1px dashed transparent;transition:border-color .3s}" +
  ".scs-edit:hover,.scs-edit:focus{border-bottom-color:var(--scs-accent)}" +
  ".scs-cta{color:inherit;text-decoration:none;transition:color .3s,letter-spacing .4s}" +
  ".scs-cta:hover{color:var(--scs-accent);letter-spacing:.02em}" +
  ".scs-nav button{display:flex;align-items:center;gap:10px;justify-content:flex-end;background:none;border:0;padding:5px 0;cursor:pointer;color:inherit;font:inherit}" +
  ".scs-nav .scs-tick{display:block;height:1px;width:14px;background:currentColor;opacity:.45;transition:width .4s cubic-bezier(.2,.8,.2,1),opacity .3s,background-color .3s}" +
  ".scs-nav .scs-lab{opacity:0;transform:translateX(6px);transition:opacity .3s,transform .3s}" +
  ".scs-nav button:hover .scs-lab,.scs-nav button:focus-visible .scs-lab{opacity:1;transform:none}" +
  ".scs-nav button[aria-current=step] .scs-tick{width:34px;opacity:1;background:var(--scs-accent)}" +
  "@container scs (orientation: portrait){" +
  ".scs-bloom{left:7cqw!important;top:auto!important;bottom:13cqh}" +
  ".scs-fin{flex-direction:column!important;gap:4cqh!important;top:40cqh!important}" +
  ".scs-spec{grid-template-columns:1fr 1fr!important}.scs-spec-mid{display:none!important}}" +
  "@container scs (max-width: 720px){.scs-hide-sm{display:none!important}" +
  ".scs-note{white-space:normal!important;letter-spacing:.2em!important;text-align:center;max-width:80cqw;padding-left:0!important;line-height:1.7}" +
  ".scs-foot{flex-direction:column!important;gap:2cqh!important;bottom:3cqh!important;font-size:11px!important;text-align:center}" +
  ".scs-foot svg{display:none}}" +
  "@container scs (max-width: 1020px){.scs-hide-md{display:none!important}}" +
  "@media (prefers-reduced-motion: reduce){.scs-char{animation:none}.scs-g{transition:none}}"

type Fx = "rise" | "clip" | "line" | "fade" | "draw"

/** Everything that belongs to one frame registers itself through this. */
const sc = (scene: number, fx: Fx = "rise", delay = 0) => ({
  "data-sc": scene,
  "data-fx": fx,
  "data-d": delay,
})

export default function ScalioCardSpecimen({
  name = "Scalio",
  product = "USDT Card",
  year = "2026",
  highlight = "$0 fees · Up to 10% cashback",
  tiers = DEFAULT_TIERS,
  tagline = DEFAULT_TAGLINE,
  networks = "TRON·ETH·BNB",
  networkDetail = "TRC-20 / ERC-20 / BEP-20",
  steps = DEFAULT_STEPS,
  cta = { label: "Activate", href: "#cards" },
  links = [
    { label: "ACTIVATE CARD & CLAIM BONUS", href: "#cards" },
    { label: "COMPARE CARDS", href: "#compare" },
  ],
  fontFamily = DISPLAY,
  logoSrc = "/scalio-logo.webp",
  fontHref = FONT_HREF,
  ink = "#050505",
  bone = "#ededee",
  accent = "#2C3480",
  accentText = "#8f9af0",
  height = "100svh",
  sceneScroll = 1.2,
  alive = true,
  className = "",
}: ScalioCardSpecimenProps) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const glowRef = React.useRef<HTMLDivElement | null>(null)
  const wordRef = React.useRef<HTMLDivElement | null>(null)
  const [reduced, setReduced] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [inspect, setInspect] = React.useState<string | null>(null)

  const three = tiers.slice(0, CARDS)
  const letters = Array.from(name)
  const firstIdx = letters.findIndex((c) => c.trim() !== "")
  const lastIdx = letters.length - 1 - [...letters].reverse().findIndex((c) => c.trim() !== "")

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  // The display face. A <link>, once per document, never a CSS import.
  React.useEffect(() => {
    if (!fontHref) return
    const exists = Array.from(document.querySelectorAll("link[rel=stylesheet]")).some(
      (l) => (l as HTMLLinkElement).href === fontHref,
    )
    if (exists) return
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = fontHref
    link.setAttribute("data-scalio-font", "")
    document.head.appendChild(link)
  }, [fontHref])

  const look = React.useRef({ accent, alive, reduced, name, three, fontFamily, logoSrc })
  look.current = { accent, alive, reduced, name, three, fontFamily, logoSrc }
  const facesKey = name + "|" + accent + "|" + three.map((t) => t.name + t.bonus + t.cashback).join("|")

  React.useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    const glow = glowRef.current
    const word = wordRef.current
    if (!root || !stage || !canvas || !glow || !word) return

    const mesh = buildMesh()
    const faces = document.createElement("canvas")

    // ---- GL, with a 2D fallback -------------------------------------------
    let gl: WebGLRenderingContext | null = null
    let ctx2d: CanvasRenderingContext2D | null = null
    let prog: WebGLProgram | null = null
    let vbo: WebGLBuffer | null = null
    let ibo: WebGLBuffer | null = null
    let tex: WebGLTexture | null = null
    let texBack: WebGLTexture | null = null
    const backs = document.createElement("canvas")
    const logo = new Image()
    const loc: Record<string, WebGLUniformLocation | null> = {}

    const uploadFaces = () => {
      const L = look.current
      paintFaces(faces, L.name, L.three, L.accent, L.fontFamily)
      paintBacks(backs, L.three, L.accent, L.fontFamily, logo.complete && logo.naturalWidth ? logo : null)
      if (!gl || !tex || !texBack) return
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, faces)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, texBack)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, backs)
      gl.activeTexture(gl.TEXTURE0)
    }
    // the logo loads after first paint; reprint the backs once it arrives
    logo.onload = () => uploadFaces()
    logo.src = look.current.logoSrc

    const initGL = () => {
      gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true }) as WebGLRenderingContext | null
      if (!gl) return false
      const compile = (type: number, src: string) => {
        const sh = gl!.createShader(type)!
        gl!.shaderSource(sh, src)
        gl!.compileShader(sh)
        return gl!.getShaderParameter(sh, gl!.COMPILE_STATUS) ? sh : null
      }
      const vs = compile(gl.VERTEX_SHADER, VERT)
      const fs = compile(gl.FRAGMENT_SHADER, FRAG)
      if (!vs || !fs) return false
      prog = gl.createProgram()!
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
      gl.useProgram(prog)
      vbo = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW)
      ibo = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW)
      const attr = (n: string, size: number, off: number) => {
        const a = gl!.getAttribLocation(prog!, n)
        if (a < 0) return
        gl!.enableVertexAttribArray(a)
        gl!.vertexAttribPointer(a, size, gl!.FLOAT, false, STRIDE * 4, off * 4)
      }
      attr("a_pos", 3, 0)
      attr("a_nrm", 3, 3)
      attr("a_uv", 2, 6)
      attr("a_mat", 2, 8)
      for (const n of ["u_vp", "u_model", "u_offset", "u_time", "u_fan", "u_slide", "u_gap", "u_morph", "u_deal", "u_sway", "u_eye", "u_accent", "u_tex", "u_back", "u_hasTex"])
        loc[n] = gl.getUniformLocation(prog, n)
      // NPOT atlas: no mips, clamped
      tex = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(loc.u_tex, 0)
      texBack = gl.createTexture()
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, texBack)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(loc.u_back, 1)
      gl.activeTexture(gl.TEXTURE0)
      gl.enable(gl.DEPTH_TEST)
      gl.clearColor(0, 0, 0, 0)
      uploadFaces()
      return true
    }
    if (!initGL()) {
      gl = null
      ctx2d = canvas.getContext("2d")
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      gl = null
    }
    const onRestored = () => {
      if (!initGL()) gl = null
    }
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)

    // ---- measuring ---------------------------------------------------------
    let W = 1
    let H = 1
    let dpr = 1
    const chars = Array.from(word.querySelectorAll<HTMLElement>("[data-ch]"))
    let nat: { x: number; y: number; w: number }[] = []
    const measure = () => {
      const sr = stage.getBoundingClientRect()
      W = Math.max(1, sr.width)
      H = Math.max(1, sr.height)
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const cw = Math.round(W * dpr)
      const ch = Math.round(H * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      const saved = chars.map((c) => c.style.transform)
      chars.forEach((c) => (c.style.transform = "none"))
      nat = chars.map((c) => {
        const r = c.getBoundingClientRect()
        return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top, w: r.width }
      })
      chars.forEach((c, i) => (c.style.transform = saved[i]))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    measure()
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    const onFonts = () => {
      measure()
      uploadFaces()
    }
    fonts?.addEventListener?.("loadingdone", onFonts)
    fonts?.ready.then(onFonts)

    // ---- frame elements -----------------------------------------------------
    const items = Array.from(stage.querySelectorAll<HTMLElement>("[data-sc]")).map((el) => ({
      el,
      scene: Number(el.dataset.sc),
      fx: el.dataset.fx as Fx,
      delay: Number(el.dataset.d) || 0,
      last: -1,
    }))

    // ---- input ----------------------------------------------------------------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    let spin = 0
    let spinVel = 0
    let drag: { id: number; x: number } | null = null
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1
      if (drag && drag.id === e.pointerId) {
        spinVel += (e.clientX - drag.x) * 0.0022
        drag.x = e.clientX
      }
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return
      const t = e.target as HTMLElement
      if (t.closest("a,button,[contenteditable],.scs-g")) return
      drag = { id: e.pointerId, x: e.clientX }
      stage.style.cursor = "grabbing"
    }
    const onUp = () => {
      drag = null
      stage.style.cursor = ""
    }
    stage.addEventListener("pointermove", onMove)
    stage.addEventListener("pointerdown", onDown)
    window.addEventListener("pointerup", onUp)

    // ---- loop -------------------------------------------------------------------
    let raf = 0
    let running = false
    let visible = true
    let last = performance.now()
    const born = last
    let time = 0
    let prog01 = -1
    let shownScene = -1

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = look.current
      const moving = L.alive && !L.reduced
      if (moving) time += dt

      const r = root.getBoundingClientRect()
      const p = progressFrom(r.top, r.height, H)
      prog01 = prog01 < 0 || L.reduced ? p : prog01 + (p - prog01) * (1 - Math.exp(-dt * 9))
      const coord = sceneCoord(prog01, SCENES, HOLD)
      const scene = Math.round(coord)
      if (scene !== shownScene) {
        shownScene = scene
        setActive(scene)
      }

      // camera
      const tall = H > W * 1.05
      const k = keyAt(coord, tall)
      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 4))
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 4))
      if (moving) {
        spin += spinVel + Math.sin(time * 0.35) * dt * 0.12
        spinVel *= Math.exp(-dt * 3)
      } else {
        spin += spinVel
        spinVel = 0
      }
      const px = moving ? pointer.x : 0
      const py = moving ? pointer.y : 0
      const fov = (30 * Math.PI) / 180
      const minDim = Math.min(W, H)
      const dist = (RADIUS * H) / (k.size * minDim * Math.tan(fov / 2))
      const el = Math.max(-88, Math.min(88, k.el + py * 9)) * (Math.PI / 180)
      const eye: V3 = [HEART[0], HEART[1] + Math.sin(el) * dist, HEART[2] + Math.cos(el) * dist]
      const proj = perspective(fov, W / H, Math.max(0.05, dist - 6), dist + 8)
      const vp = multiply(proj, lookAt(eye, HEART))
      // the whole stack breathes as one, so this tilt never pulls cards together
      const breathe = moving ? Math.sin(time * 0.5) * 0.05 : 0
      const model = multiply(rotY(k.spin + spin + px * 0.35), rotX(py * 0.05 + breathe))
      // dealt out one at a time, front card first, each snapping into place
      const deal = [0, 1, 2].map((ci) =>
        L.reduced ? 1 : easeOutBack(clamp01(((now - born) / 1000 - 0.3 - (2 - ci) * 0.22) / 1.1)),
      )
      // between frames the stack draws a breath: cards spread in depth,
      // counter-slide and twist, then close back up as the next frame lands
      const morph = L.reduced ? 0 : Math.sin(Math.PI * (coord - Math.floor(coord)))

      // the accent haze behind the stack tracks where the heart lands
      const gx = (0.5 + k.ox / 2) * W
      const gy = (0.5 - k.oy / 2) * H
      const gr = k.size * minDim * 1.25
      glow.style.transform =
        "translate(" + (gx - gr).toFixed(1) + "px," + (gy - gr).toFixed(1) + "px)"
      glow.style.width = glow.style.height = (gr * 2).toFixed(1) + "px"

      if (gl && prog) {
        const g = gl
        g.viewport(0, 0, canvas.width, canvas.height)
        g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT)
        const acc = hexToLinear(L.accent)
        g.uniformMatrix4fv(loc.u_vp, false, vp)
        g.uniformMatrix4fv(loc.u_model, false, model)
        g.uniform2f(loc.u_offset, k.ox, k.oy)
        g.uniform1f(loc.u_time, time)
        g.uniform1f(loc.u_fan, k.fan)
        g.uniform1f(loc.u_slide, k.slide)
        g.uniform1f(loc.u_gap, k.gap)
        g.uniform1f(loc.u_morph, morph)
        g.uniform3f(loc.u_deal, deal[0], deal[1], deal[2])
        g.uniform1f(loc.u_sway, moving ? 1 : 0)
        g.uniform3f(loc.u_eye, eye[0], eye[1], eye[2])
        g.uniform3f(loc.u_accent, acc[0], acc[1], acc[2])
        g.uniform1f(loc.u_hasTex, tex ? 1 : 0)
        g.drawElements(g.TRIANGLES, mesh.index.length, g.UNSIGNED_SHORT, 0)
      } else if (ctx2d) {
        // No WebGL: the same cards, projected and filled flat.
        const c = ctx2d
        const mvp = multiply(vp, model)
        c.setTransform(dpr, 0, 0, dpr, 0, 0)
        c.clearRect(0, 0, W, H)
        const fills = ["#9a9ca3", "#141417", L.accent]
        const ol = outline()
        for (let ci = 0; ci < CARDS; ci++) {
          c.beginPath()
          ol.forEach(([x, y], i) => {
            const q = cardPoint(x, y, ci, k, morph, deal[ci])
            const cx = mvp[0] * q[0] + mvp[4] * q[1] + mvp[8] * q[2] + mvp[12]
            const cy = mvp[1] * q[0] + mvp[5] * q[1] + mvp[9] * q[2] + mvp[13]
            const cw = mvp[3] * q[0] + mvp[7] * q[1] + mvp[11] * q[2] + mvp[15]
            const sx = ((cx / cw + k.ox) * 0.5 + 0.5) * W
            const sy = (0.5 - (cy / cw + k.oy) * 0.5) * H
            if (i === 0) c.moveTo(sx, sy)
            else c.lineTo(sx, sy)
          })
          c.closePath()
          c.fillStyle = fills[ci]
          c.strokeStyle = "rgba(255,255,255,0.35)"
          c.lineWidth = 1
          c.fill()
          c.stroke()
        }
      }

      // ---- the type ---------------------------------------------------------
      const still = L.reduced
      for (const it of items) {
        const v = reveal(coord, it.scene, it.delay)
        const q = Math.round(v * 500) / 500
        if (q === it.last) continue
        it.last = q
        const s = it.el.style
        const dir = coord < it.scene ? 1 : -1
        s.visibility = q <= 0 ? "hidden" : ""
        if (it.fx === "draw") {
          s.setProperty("--v", String(q))
          s.opacity = String(Math.min(1, q * 3))
          continue
        }
        if (it.fx === "line") {
          s.transform = "scaleX(" + q + ")"
          s.opacity = String(Math.min(1, q * 2))
          continue
        }
        s.opacity = String(q)
        if (still || it.fx === "fade") continue
        if (it.fx === "clip") {
          const hid = ((1 - q) * 100).toFixed(1)
          s.clipPath = dir > 0 ? "inset(0 0 " + hid + "% 0)" : "inset(" + hid + "% 0 0 0)"
          s.transform = "translateY(" + ((1 - q) * 0.4 * dir).toFixed(3) + "em)"
        } else {
          s.transform = "translateY(" + ((1 - q) * 34 * dir).toFixed(1) + "px)"
          s.filter = q > 0.995 ? "" : "blur(" + ((1 - q) * 8).toFixed(1) + "px)"
        }
      }

      // The cover word morphs into the card frame: its first and last letters
      // slide out to flank the fanned stack, the rest fall into it.
      const m = easeInOut(clamp01(coord))
      const out = clamp01(coord - 1)
      const r1 = keyAt(1, tall).size * minDim * 0.5
      const cy1 = (0.5 - keyAt(1, tall).oy / 2) * H
      chars.forEach((c, i) => {
        const n0 = nat[i]
        if (!n0) return
        const flank = !tall && (i === firstIdx || i === lastIdx)
        if (flank && firstIdx !== lastIdx) {
          const side = i === firstIdx ? -1 : 1
          const lw = n0.w
          const tx = W / 2 + side * (r1 + lw * 0.55 + minDim * 0.02)
          const dx = (tx - n0.x) * m
          const dy = (cy1 - n0.y) * m - out * 60
          const o = coord < 1 ? 1 : 1 - smoothstep(0.1, 0.45, out)
          c.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)"
          c.style.opacity = String(o)
          c.style.filter = still || out < 0.05 ? "" : "blur(" + (out * 14).toFixed(1) + "px)"
        } else {
          const dx = (W / 2 - n0.x) * m * 0.75
          const dy = (cy1 - n0.y) * m
          const o = 1 - smoothstep(0.0, 0.4, m)
          c.style.transform = still
            ? ""
            : "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + (1 - m * 0.7).toFixed(3) + ")"
          c.style.opacity = String(o)
          c.style.filter = still || m < 0.02 ? "" : "blur(" + (m * 12).toFixed(1) + "px)"
        }
        c.style.visibility = coord > 1.6 ? "hidden" : ""
      })
    }

    const start = () => {
      if (running || !visible || document.hidden) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(root)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener("visibilitychange", onVis)
    start()

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      fonts?.removeEventListener?.("loadingdone", onFonts)
      stage.removeEventListener("pointermove", onMove)
      stage.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      const g = gl as WebGLRenderingContext | null
      if (g) {
        g.deleteBuffer(vbo)
        g.deleteBuffer(ibo)
        g.deleteTexture(tex)
        g.deleteTexture(texBack)
        g.deleteProgram(prog)
      }
    }
  }, [name, firstIdx, lastIdx, facesKey])

  const jump = (i: number) => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const r = root.getBoundingClientRect()
    const travel = r.height - stage.clientHeight
    const delta = (i / (SCENES - 1)) * travel + r.top
    let el: HTMLElement | null = root.parentElement
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) break
      el = el.parentElement
    }
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth"
    if (el && el !== document.body) el.scrollBy({ top: delta, behavior })
    else window.scrollBy({ top: delta, behavior })
  }

  const display: React.CSSProperties = { fontFamily, fontWeight: 500, letterSpacing: "-0.03em" }
  const sans: React.CSSProperties = { fontFamily: SANS }
  const hidden: React.CSSProperties = { opacity: 0 }
  const cur = three.find((t) => t.id === inspect)
  const Figures = ({ pick }: { pick: (t: SpecimenTier) => number }) => (
    <>
      {three.map((t) => (
        <div key={t.id} style={{ fontSize: "min(8.4cqw, 9cqh)", lineHeight: 1.02, whiteSpace: "nowrap" }}>
          <span className="scs-g" data-g={t.id}>{pick(t)}%</span>
        </div>
      ))}
    </>
  )
  const Side = ({ label, side }: { label: string; side: "l" | "r" }) => (
    <span
      className="scs-hide-sm"
      style={{
        ...sans, position: "absolute", top: "50%", [side === "l" ? "right" : "left"]: "calc(100% + 16px)",
        fontSize: 8, letterSpacing: "0.25em", opacity: 0.55, lineHeight: 1,
        transform: "translate(" + (side === "l" ? "50%" : "-50%") + ",-50%) rotate(" + (side === "l" ? -90 : 90) + "deg)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
  const Label = ({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) => (
    <div style={{ ...sans, fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.6, textAlign: align, marginBottom: "1.2cqh" }}>
      {children}
    </div>
  )
  const nets = networks.split("·")

  return (
    <section
      ref={rootRef}
      className={"relative w-full " + className}
      style={{ height: "calc(" + height + " * " + (1 + (SCENES - 1) * sceneScroll).toFixed(3) + ")", background: ink }}
      aria-label={name + " " + product + " specimen"}
    >
      <style>{CSS}</style>
      <div
        ref={stageRef}
        className="scs-stage sticky top-0 w-full overflow-hidden select-none"
        style={{
          height, color: bone, background: ink,
          ["--scs-accent" as string]: accentText,
        } as React.CSSProperties}
        onPointerOver={(e) => {
          const g = (e.target as HTMLElement).dataset?.g
          if (g) setInspect(g)
        }}
        onPointerLeave={() => setInspect(null)}
      >
        {/* frame: a faint bleed at the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, " + bone + "12 100%)" }}
        />
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full"
          style={{
            background: "radial-gradient(closest-side, " + accent + "88, " + accent + "26 45%, transparent 100%)",
            willChange: "transform",
          }}
        />
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 block"
          style={{ width: "100%", height: "100%", maxWidth: "none" }}
        />

        {/* ================================ 0 · cover ================================ */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute" style={{ left: "5cqw", top: "13cqh" }}>
            <div {...sc(0, "clip", 0)} style={{ ...display, ...hidden, fontSize: "clamp(20px, 2.6cqw, 38px)", lineHeight: 0.95, textTransform: "uppercase" }}>
              Real-Time
              <br />
              Self-Custody
              <br />
              <span style={{ color: accentText }}>Spending</span>
            </div>
          </div>

          <div
            ref={wordRef}
            className="absolute whitespace-nowrap"
            style={{ ...display, fontWeight: 600, letterSpacing: "-0.05em", left: "50%", top: "63%", transform: "translate(-50%, -50%)", fontSize: "min(21cqw, 33cqh)", lineHeight: 1 }}
          >
            <span
              {...sc(0, "rise", 0.6)}
              style={{ ...hidden, position: "absolute", right: "0.04em", top: "92%", fontSize: "0.2em", letterSpacing: "-0.02em", color: accentText }}
            >
              USDT Card
            </span>
            <h2 style={{ margin: 0, font: "inherit", letterSpacing: "inherit" }} aria-label={name}>
              {letters.map((c, i) => (
                <span key={i} data-ch className="inline-block" style={{ willChange: "transform" }} aria-hidden>
                  <span className="scs-char" style={{ animationDelay: 0.15 + i * 0.07 + "s" }}>
                    {c === " " ? " " : c}
                  </span>
                </span>
              ))}
            </h2>
          </div>

          <div className="absolute flex items-end justify-between gap-6" style={{ left: "5cqw", right: "5cqw", bottom: "5cqh" }}>
            <div {...sc(0, "rise", 0.3)} style={{ ...sans, ...hidden, fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.75 }}>
              {highlight}
            </div>
            <div {...sc(0, "rise", 0.5)} className="scs-hide-sm" style={{ ...sans, ...hidden, fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.55 }}>
              Scroll ↓
            </div>
          </div>
        </div>

        {/* ================================ 1 · card ================================= */}
        <div className="pointer-events-none absolute inset-0">
          <div {...sc(1, "fade", 0.5)} className="absolute flex gap-6" style={{ ...sans, ...hidden, left: "50%", bottom: "14cqh", transform: "translateX(-50%)", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {three.map((t) => (
              <span key={t.id}>{t.name.split(" ").slice(1).join(" ") || t.name}</span>
            ))}
          </div>
          <div {...sc(1, "rise", 0.7)} className="absolute" style={{ ...sans, ...hidden, left: "5cqw", bottom: "5cqh", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase" }}>
            <span style={{ color: accentText }}>02</span> — Three cards, one wallet
          </div>
        </div>

        {/* =============================== 2 · tiers ================================ */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div
            className="scs-spec pointer-events-auto absolute grid items-center"
            style={{ left: "8cqw", right: "8cqw", top: "14cqh", bottom: "22cqh", gridTemplateColumns: "1fr min(30cqw, 34cqh) 1fr", columnGap: "2cqw" }}
          >
            <div className="relative">
              <div {...sc(2, "fade", 0)} style={hidden}><Label>Instant joining bonus</Label></div>
              <div {...sc(2, "clip", 0.1)} style={hidden} className="relative">
                <Side label="CORE · PRO · MAX" side="l" />
                <Figures pick={(t) => t.bonus} />
              </div>
            </div>
            <div className="scs-spec-mid relative h-full text-center">
              <div {...sc(2, "rise", 0.45)} className="absolute w-full" style={{ ...hidden, top: "58%", lineHeight: 1.05 }}>
                <div style={{ fontSize: cur ? "min(3.6cqw, 5cqh)" : "min(2.4cqw, 3.4cqh)", color: cur ? accentText : undefined, transition: "font-size .35s cubic-bezier(.2,.8,.2,1)" }}>
                  {cur ? cur.name : "Hover a card"}
                </div>
                <div style={{ ...sans, fontSize: 9, letterSpacing: "0.22em", opacity: 0.65, marginTop: 8, minHeight: "2.6em", textTransform: "uppercase", lineHeight: 1.5 }}>
                  {cur ? (
                    <>
                      ${cur.balance.toLocaleString()} USDT balance
                      <br />
                      {cur.support} support
                    </>
                  ) : (
                    "Bonus on activation · cashback on every spend"
                  )}
                </div>
              </div>
            </div>
            <div className="relative flex flex-col items-end text-right">
              <div {...sc(2, "fade", 0.1)} style={hidden}><Label align="right">Everyday cashback</Label></div>
              <div {...sc(2, "clip", 0.2)} style={hidden} className="relative">
                <Side label="CORE · PRO · MAX" side="r" />
                <Figures pick={(t) => t.cashback} />
              </div>
            </div>
          </div>
          <div {...sc(2, "line", 0.5)} className="absolute" style={{ ...hidden, left: "8cqw", right: "8cqw", bottom: "15.5cqh", height: 1, background: bone + "40", transformOrigin: "left" }} />
          <div {...sc(2, "rise", 0.6)} className="absolute flex justify-between" style={{ ...hidden, left: "8cqw", right: "8cqw", bottom: "8cqh", fontSize: "min(3.2cqw, 3.4cqh)" }}>
            {three.map((t) => (
              <span key={t.id}>
                ${t.balance.toLocaleString()}
                <span style={{ ...sans, fontSize: 9, letterSpacing: "0.2em", opacity: 0.6, marginLeft: 10 }}>{(t.name.split(" ")[1] || "").toUpperCase()}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ============================== 3 · zero fees ============================= */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="absolute text-center" style={{ left: "50%", top: "12cqh", transform: "translateX(-50%)", fontSize: "min(15cqw, 12cqh)", fontWeight: 600, lineHeight: 0.9, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            <span {...sc(3, "fade", 0.3)} className="scs-hide-sm" style={{ ...hidden, position: "absolute", right: "100%", top: "0.35em", fontSize: "0.12em", marginRight: "1.2em", textTransform: "none", fontWeight: 400 }}>$0 joining</span>
            <span {...sc(3, "fade", 0.4)} className="scs-hide-sm" style={{ ...hidden, position: "absolute", left: "100%", top: "0.35em", fontSize: "0.12em", marginLeft: "1.2em", textTransform: "none", fontWeight: 400 }}>$0 annual</span>
            <div {...sc(3, "clip", 0)} style={hidden}>Zero</div>
            <div {...sc(3, "clip", 0.15)} style={hidden}>Fees</div>
            <div {...sc(3, "clip", 0.3)} style={{ ...hidden, color: accentText }}>For Life</div>
          </div>
          <div className="absolute flex justify-center" style={{ left: 0, right: 0, bottom: "5cqh" }}>
            <div {...sc(3, "rise", 0.6)} className="scs-note" style={{ ...sans, ...hidden, fontSize: 9, letterSpacing: "0.6em", textTransform: "uppercase", whiteSpace: "nowrap", paddingLeft: "0.6em" }}>
              No top-ups · No preloading · No locked capital
            </div>
          </div>
        </div>

        {/* ============================== 4 · tap & pay ============================= */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="scs-bloom pointer-events-auto absolute" style={{ left: "9cqw", top: "30cqh", fontSize: "min(9.5cqw, 13cqh)", fontWeight: 600, lineHeight: 0.84 }}>
            {tagline.map((t, i) => (
              <div
                key={i}
                {...sc(4, "clip", i * 0.14)}
                style={{
                  ...hidden,
                  fontSize: t.small ? "0.3em" : undefined,
                  fontWeight: t.small ? 400 : undefined,
                  lineHeight: t.small ? 1.1 : undefined,
                  color: t.small ? accentText : undefined,
                  marginLeft: t.small ? (i < 2 ? "3.4em" : "3.2em") : i > 1 ? "0.45em" : 0,
                  marginTop: t.small ? "-0.1em" : 0,
                  marginBottom: t.small ? "0.3em" : 0,
                }}
              >
                <span className="scs-edit" contentEditable spellCheck={false} suppressContentEditableWarning>
                  {t.text}
                </span>
              </div>
            ))}
            <div {...sc(4, "rise", 0.7)} style={{ ...sans, ...hidden, fontSize: 9, fontWeight: 400, letterSpacing: "0.25em", marginTop: "3cqh", opacity: 0.7, textTransform: "uppercase" }}>
              Apple Pay · Google Pay · Global POS
            </div>
          </div>
        </div>

        {/* =============================== 5 · activate ============================== */}
        <div className="pointer-events-none absolute inset-0" style={display}>
          <div className="scs-fin absolute flex items-center justify-around" style={{ left: "4cqw", right: "4cqw", top: "50cqh" }}>
            <div className="pointer-events-auto relative text-center">
              <div {...sc(5, "fade", 0.1)} style={{ ...sans, ...hidden, fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "1.2cqh", opacity: 0.7 }}>
                Three steps · $0 to start
              </div>
              <a
                {...sc(5, "clip", 0)}
                href={cta.href ?? "#"}
                className="scs-cta relative block"
                style={{ ...hidden, fontSize: "min(10cqw, 13cqh)", fontWeight: 600, lineHeight: 1 }}
              >
                {cta.label}
                <svg
                  {...sc(5, "draw", 0.2)}
                  aria-hidden
                  viewBox="0 0 100 100"
                  style={{ ...hidden, position: "absolute", left: "50%", top: "50%", width: "1.3em", height: "1.3em", transform: "translate(-50%,-46%)", overflow: "visible", pointerEvents: "none" }}
                >
                  <circle cx="50" cy="50" r="48" fill="none" stroke={accentText} strokeWidth="1.3" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: "calc(1 - var(--v, 0))" } as React.CSSProperties} />
                  <path d="M2 50H98M50 50V98" fill="none" stroke={accentText} strokeWidth="1.3" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: "calc(1 - var(--v, 0))" } as React.CSSProperties} />
                </svg>
              </a>
              <div {...sc(5, "rise", 0.4)} className="flex justify-center gap-[3cqw]" style={{ ...hidden, marginTop: "2.6cqh" }}>
                {steps.map((s) => (
                  <div key={s.n} className="text-left" style={{ maxWidth: "15cqw" }}>
                    <div style={{ ...sans, fontSize: 9, letterSpacing: "0.2em", color: accentText }}>{s.n}</div>
                    <div style={{ fontSize: "min(2cqw, 2.8cqh)", lineHeight: 1.1 }}>{s.title}</div>
                    <div style={{ ...sans, fontSize: 10, opacity: 0.6, marginTop: 4 }}>{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pointer-events-auto relative">
              <div {...sc(5, "fade", 0.3)} style={{ ...sans, ...hidden, fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.7 }}>Supported networks</div>
              <div {...sc(5, "clip", 0.35)} style={{ ...hidden, fontSize: "min(7cqw, 9.5cqh)", fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
                {nets.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: accentText }}>·</span>}
                    {part}
                  </React.Fragment>
                ))}
              </div>
              <div {...sc(5, "fade", 0.5)} style={{ ...sans, ...hidden, fontSize: "clamp(10px, 1cqw, 13px)", textAlign: "right", letterSpacing: "0.1em" }}>{networkDetail}</div>
            </div>
          </div>

          <div {...sc(5, "rise", 0.75)} className="scs-foot pointer-events-auto absolute flex items-center justify-between gap-4" style={{ ...sans, ...hidden, left: "5cqw", right: "5cqw", bottom: "4.5cqh", fontSize: "clamp(10px, 1.3cqw, 18px)", letterSpacing: "0.04em", color: bone }}>
            <FootLink link={links[0]} />
            <Mark color={bone} accent={accent} />
            <FootLink link={links[1]} />
          </div>
        </div>

        {/* ================================== nav ================================== */}
        <nav
          aria-label="Specimen frames"
          className="scs-nav scs-hide-sm absolute flex flex-col items-end"
          style={{ ...sans, right: "2cqw", top: "50%", transform: "translateY(-50%)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}
        >
          {NAV.map((n, i) => (
            <button key={n} type="button" onClick={() => jump(i)} aria-current={active === i ? "step" : undefined}>
              <span className="scs-lab">{String(i + 1).padStart(2, "0")} {n}</span>
              <span className="scs-tick" />
            </button>
          ))}
        </nav>

      </div>
    </section>
  )
}

function FootLink({ link }: { link: SpecimenLink }) {
  const style: React.CSSProperties = { color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }
  if (!link.href) return <span style={style}>{link.label}</span>
  const external = /^https?:/.test(link.href)
  return (
    <a href={link.href} className="scs-cta" style={style} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {link.label}
    </a>
  )
}

/** A small card, drawn as the brand mark. */
function Mark({ color, accent }: { color: string; accent: string }) {
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden style={{ flex: "none" }}>
      <rect x="1" y="1" width="32" height="22" rx="3.5" fill="none" stroke={color} strokeWidth="1.6" />
      <rect x="5" y="6" width="7" height="5" rx="1" fill={accent} />
      <path d="M5 17H20" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
