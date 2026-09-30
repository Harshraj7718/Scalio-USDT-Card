"use client"

import * as React from "react"
import * as THREE from "three"

/**
 * Covelight — glowing light trails that run along a floor, bend up a curved
 * cove and climb a wall, with travelling pulses, a floor reflection, bloom and
 * a near-field focus blur. Rendered with three.js.
 *
 * Ported from the Framer code component "Covelight" to plain React: the
 * Framer runtime (property controls, static renderer, palette menu) is gone,
 * everything else is the same engine. Pick a preset or pass your own palette.
 */

export type CovelightPreset = "scalio" | "tidewater" | "ember" | "aurora" | "orchid" | "glacier"

export type CovelightProps = {
  preset?: CovelightPreset
  /** Overrides the preset. Up to 8 colours. */
  palette?: string[]
  backdrop?: string
  trails?: Partial<typeof TRAIL_DEFAULT>
  motion?: Partial<typeof MOTION_DEFAULT>
  pulses?: Partial<typeof PULSE_DEFAULT>
  glow?: Partial<typeof GLOW_DEFAULT>
  stage?: Partial<typeof STAGE_DEFAULT>
  /** Cap on device pixel ratio; the bloom chain is costly at 2×+. */
  pixelRatio?: number
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

const PRESETS: Record<CovelightPreset, string[]> = {
  scalio: ["#2C3480", "#4B5BD6", "#1E2566", "#8F9AF0", "#DDE2FF"],
  tidewater: ["#004C94", "#2E89FF", "#003994", "#004BAD", "#FF5900"],
  ember: ["#8A1C00", "#FF4A1C", "#B32400", "#FF8A3D", "#FFD166"],
  aurora: ["#00A884", "#19E6B5", "#006E8A", "#7C4DFF", "#B8FF5C"],
  orchid: ["#6A00B8", "#C33BFF", "#FF3DA8", "#3D1AE6", "#FF9AD5"],
  glacier: ["#3A7BD5", "#7FD6FF", "#00E0FF", "#A5B4FC", "#E6F7FF"],
}
const TRAIL_DEFAULT = { count: 100, spread: 80, thickness: 1, seed: 7 }
const MOTION_DEFAULT = { speed: 1, reverse: false }
const PULSE_DEFAULT = { density: 70, size: 0.25, rate: 1.5 }
const GLOW_DEFAULT = { intensity: 1, exposure: 1, bloom: 0.2, bloomRadius: 0.3, bloomThreshold: 0, reflection: 0.4, focusBlur: 3.5 }
const STAGE_DEFAULT = { floorReach: 132, bendDepth: 150, arcRadius: 10, wallHeight: 200 }
const VIEW = { height: 20, distance: 140, fov: 55 }
const PALETTE_SLOTS = 8
const RIBS_ALONG = 180
const RIBS_AROUND = 6
const BLOOM_TIERS = 5
const GAIN_SCALE = 2.2
const SPEED_SCALE = 0.1

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const tidyPalette = (list?: string[]) => {
  const clean = (list || []).filter((c) => typeof c === "string" && c.trim().length > 0)
  return (clean.length ? clean : PRESETS.scalio).slice(0, PALETTE_SLOTS)
}

// #region layout (deterministic, shared by geometry)
type Strand = { x: number; radius: number; pace: number; phase: number; tail: number; hue: number }
type CoveSpec = { front: number; bend: number; radius: number; run: number; arc: number; climb: number; total: number }

const seededRandom = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 1831565813) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const layStrands = (t: typeof TRAIL_DEFAULT): Strand[] => {
  const rand = seededRandom(Math.floor(t.seed) * 9973 + 17)
  const n = clampTo(Math.round(t.count), 1, 240)
  const list: Strand[] = []
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
    const bias = Math.sign(u) * Math.pow(Math.abs(u), 1.2)
    const jitter = (rand() - 0.5) * 2
    list.push({
      x: (u + bias) * 0.5 * t.spread + jitter,
      radius: (0.1 + rand() * 0.2) * Math.max(0.05, t.thickness),
      pace: 0.2 + rand() * 0.5,
      phase: rand(),
      tail: 0.3 + rand() * 0.4,
      hue: rand(),
    })
  }
  return list
}

const coveSpec = (s: typeof STAGE_DEFAULT): CoveSpec => {
  const front = s.floorReach
  const bend = -s.bendDepth
  const radius = Math.max(1, s.arcRadius)
  const run = Math.max(0.1, front - bend)
  const arc = radius * Math.PI * 0.5
  const climb = Math.max(0.1, s.wallHeight - radius)
  return { front, bend, radius, run, arc, climb, total: run + arc + climb }
}

/** Arc-length walk along the floor → curved cove → wall. */
const walkCove = (spec: CoveSpec, dist: number, out: { y: number; z: number }) => {
  if (dist <= spec.run) {
    out.y = 0
    out.z = spec.front - dist
    return out
  }
  const into = dist - spec.run
  if (into <= spec.arc) {
    const p = into / spec.arc
    const warped = p - (0.55 * Math.sin(Math.PI * 2 * p)) / (Math.PI * 2)
    const angle = warped * Math.PI * 0.5
    out.y = spec.radius * (1 - Math.cos(angle))
    out.z = spec.bend - spec.radius * Math.sin(angle)
    return out
  }
  out.y = spec.radius + (into - spec.arc)
  out.z = spec.bend - spec.radius
  return out
}
// #endregion

// #region shaders
const STRAND_VERT = /* glsl */ `
attribute vec4 aStrand;
varying vec2 vUv;
varying vec3 vFacingN;
varying vec3 vToEye;
varying vec4 vStrand;
void main() {
    vUv = uv;
    vStrand = aStrand;
    vFacingN = normalMatrix * normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vToEye = -mv.xyz;
    gl_Position = projectionMatrix * mv;
}
`
const STRAND_FRAG = /* glsl */ `
uniform float uClock;
uniform float uFlow;
uniform float uGain;
uniform float uPulseCount;
uniform float uPulseSize;
uniform float uPulseRate;
uniform float uMirror;
uniform float uFloorEnd;
uniform float uReflect;
uniform vec3 uPalette[${PALETTE_SLOTS}];
uniform float uPaletteSize;
varying vec2 vUv;
varying vec3 vFacingN;
varying vec3 vToEye;
varying vec4 vStrand;

float grain(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

void main() {
    float pace = vStrand.x;
    float phase = vStrand.y;
    float tail = vStrand.z;

    float head = fract(uClock * pace * uFlow + phase);
    float behind = fract((head - vUv.x) * uFlow + 1.0);
    float body = 1.0 - smoothstep(0.0, tail, behind);
    body = pow(max(body, 0.0), 1.2);

    float facing = abs(dot(normalize(vFacingN), normalize(vToEye)));
    body *= smoothstep(0.0, 0.02, facing);
    float core = body * body * body * 1.5;

    float lane = (vUv.x - uClock * pace * uPulseRate * uFlow - phase) * uPulseCount;
    float cell = floor(lane);
    vec2 local = vec2((fract(lane) - 0.5) * 2.0, (fract(vUv.y + 0.5) - 0.5) * 6.0);
    float pulse = 1.0 - smoothstep(0.0, max(uPulseSize, 0.001), length(local));
    pulse *= step(0.6, grain(vec2(cell, phase * 97.0)));
    pulse *= 0.7 + 0.3 * sin(uClock * 40.0 + grain(vec2(cell, 1.7)) * 6.2832);
    pulse *= body;

    float gain = uGain;
    if (uMirror > 0.5) {
        float fade = 1.0 - smoothstep(uFloorEnd - 0.015, uFloorEnd, vUv.x);
        body *= fade;
        core *= fade * 0.3;
        pulse *= fade * 0.1;
        body = sqrt(max(body, 0.0)) * (0.7 + 0.3 * grain(vUv * 300.0 + uClock * 0.5));
        gain *= uReflect * 0.4;
    }

    float slot = min(floor(vStrand.w * uPaletteSize), uPaletteSize - 1.0);
    vec3 tint = uPalette[0];
    for (int i = 1; i < ${PALETTE_SLOTS}; i++) {
        if (float(i) <= slot) tint = uPalette[i];
    }

    float boost = 1.0 / max(1.0 - min(pulse * 1.8, 0.95), 0.05);
    vec3 col = tint * ((body + core * 1.5) * boost + pulse * 2.5) * (body + pulse) * gain;
    gl_FragColor = vec4(col, 1.0);
}
`
const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
const SHRINK_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uCut;
uniform float uGate;
varying vec2 vUv;
void main() {
    vec2 o = uTexel * 0.5;
    vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
    c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
    c += texture2D(tSrc, vUv + vec2( o.x, -o.y)).rgb;
    c += texture2D(tSrc, vUv + vec2(-o.x,  o.y)).rgb;
    c += texture2D(tSrc, vUv + vec2( o.x,  o.y)).rgb;
    c /= 8.0;
    if (uGate > 0.5) {
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c *= smoothstep(uCut, uCut + 0.01, luma);
    }
    gl_FragColor = vec4(c, 1.0);
}
`
const GROW_FRAG = /* glsl */ `
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 uTexel;
uniform float uSpread;
varying vec2 vUv;
void main() {
    vec2 o = uTexel * 0.5;
    vec3 s = vec3(0.0);
    s += texture2D(tLow, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
    s += texture2D(tLow, vUv + vec2( o.x * 2.0, 0.0)).rgb;
    s += texture2D(tLow, vUv + vec2(0.0, -o.y * 2.0)).rgb;
    s += texture2D(tLow, vUv + vec2(0.0,  o.y * 2.0)).rgb;
    s += texture2D(tLow, vUv + vec2(-o.x,  o.y)).rgb * 2.0;
    s += texture2D(tLow, vUv + vec2( o.x,  o.y)).rgb * 2.0;
    s += texture2D(tLow, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
    s += texture2D(tLow, vUv + vec2( o.x, -o.y)).rgb * 2.0;
    s /= 12.0;
    gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + s * uSpread, 1.0);
}
`
const BLEND_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tHalo;
uniform float uHalo;
varying vec2 vUv;
void main() {
    vec3 c = texture2D(tScene, vUv).rgb + texture2D(tHalo, vUv).rgb * uHalo;
    gl_FragColor = vec4(c, 1.0);
}
`
const FINISH_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uBlur;
uniform float uExposure;
uniform vec3 uBackdrop;
varying vec2 vUv;

vec3 encode(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

float noise(vec2 p) {
    return fract(sin(dot(p, vec2(41.37, 289.13))) * 15731.743);
}

void main() {
    float amount = (1.0 - smoothstep(0.0, 0.35, vUv.y)) * uBlur;
    vec3 c;
    if (amount < 0.1) {
        c = texture2D(tSrc, vUv).rgb;
    } else {
        c = vec3(0.0);
        for (int i = 0; i < 28; i++) {
            float f = float(i);
            float r = sqrt(f + 0.5) * amount;
            float th = f * 2.39996;
            c += texture2D(tSrc, vUv + vec2(cos(th), sin(th)) * r * uTexel).rgb;
        }
        c /= 28.0;
    }
    vec3 lit = min(c * uExposure, vec3(1.0)) + uBackdrop;
    vec3 outc = encode(lit) + (noise(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(outc, 1.0);
}
`
// #endregion

// #region geometry
const weaveStrands = (strands: Strand[], spec: CoveSpec) => {
  const ring = RIBS_AROUND + 1
  const perStrand = (RIBS_ALONG + 1) * ring
  const total = strands.length * perStrand
  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const uvs = new Float32Array(total * 2)
  const seeds = new Float32Array(total * 4)
  const indices = new Uint32Array(strands.length * RIBS_ALONG * RIBS_AROUND * 6)

  // The spine profile is identical for every strand (only x differs).
  const spineY = new Float32Array(RIBS_ALONG + 1)
  const spineZ = new Float32Array(RIBS_ALONG + 1)
  const sideY = new Float32Array(RIBS_ALONG + 1)
  const sideZ = new Float32Array(RIBS_ALONG + 1)
  const a = { y: 0, z: 0 }
  const b = { y: 0, z: 0 }
  const step = 0.05
  for (let j = 0; j <= RIBS_ALONG; j++) {
    const d = (j / RIBS_ALONG) * spec.total
    walkCove(spec, d, a)
    spineY[j] = a.y
    spineZ[j] = a.z
    walkCove(spec, Math.max(0, d - step), a)
    walkCove(spec, Math.min(spec.total, d + step), b)
    let ty = b.y - a.y
    let tz = b.z - a.z
    const len = Math.hypot(ty, tz) || 1
    ty /= len
    tz /= len
    sideY[j] = tz
    sideZ[j] = -ty
  }
  const cosR = new Float32Array(ring)
  const sinR = new Float32Array(ring)
  for (let k = 0; k < ring; k++) {
    const ang = (k / RIBS_AROUND) * Math.PI * 2
    cosR[k] = Math.cos(ang)
    sinR[k] = Math.sin(ang)
  }
  let v = 0
  let t = 0
  strands.forEach((s, si) => {
    const base = si * perStrand
    for (let j = 0; j <= RIBS_ALONG; j++) {
      for (let k = 0; k < ring; k++) {
        const nx = cosR[k]
        const ny = sinR[k] * sideY[j]
        const nz = sinR[k] * sideZ[j]
        positions[v * 3] = s.x + nx * s.radius
        positions[v * 3 + 1] = spineY[j] + ny * s.radius
        positions[v * 3 + 2] = spineZ[j] + nz * s.radius
        normals[v * 3] = nx
        normals[v * 3 + 1] = ny
        normals[v * 3 + 2] = nz
        uvs[v * 2] = j / RIBS_ALONG
        uvs[v * 2 + 1] = k / RIBS_AROUND
        seeds[v * 4] = s.pace
        seeds[v * 4 + 1] = s.phase
        seeds[v * 4 + 2] = s.tail
        seeds[v * 4 + 3] = s.hue
        v++
      }
    }
    for (let j = 0; j < RIBS_ALONG; j++) {
      for (let k = 0; k < RIBS_AROUND; k++) {
        const p0 = base + j * ring + k
        const p1 = p0 + ring
        const p2 = p1 + 1
        const p3 = p0 + 1
        indices[t++] = p0; indices[t++] = p3; indices[t++] = p1
        indices[t++] = p1; indices[t++] = p3; indices[t++] = p2
      }
    }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute("aStrand", new THREE.BufferAttribute(seeds, 4))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeBoundingSphere()
  return geo
}
// #endregion

type Settings = {
  palette: string[]
  backdrop: string
  trails: typeof TRAIL_DEFAULT
  motion: typeof MOTION_DEFAULT
  pulses: typeof PULSE_DEFAULT
  glow: typeof GLOW_DEFAULT
  stage: typeof STAGE_DEFAULT
  pixelRatio: number
}

// #region engine
const startEngine = (host: HTMLElement, settings: React.MutableRefObject<Settings>) => {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" })
  } catch {
    return null
  }
  renderer.autoClear = false
  renderer.toneMapping = THREE.NoToneMapping
  const canvas = renderer.domElement
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;"
  host.appendChild(canvas)

  // --- scene -------------------------------------------------------------
  const world = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 1, 2000)
  camera.position.set(0, VIEW.height, VIEW.distance)
  camera.lookAt(0, VIEW.height, -50)
  const paletteColors = Array.from({ length: PALETTE_SLOTS }, () => new THREE.Color())
  const shared = {
    uClock: { value: 0 },
    uFlow: { value: 1 },
    uGain: { value: GAIN_SCALE },
    uPulseCount: { value: PULSE_DEFAULT.density },
    uPulseSize: { value: PULSE_DEFAULT.size },
    uPulseRate: { value: PULSE_DEFAULT.rate },
    uFloorEnd: { value: 0.5 },
    uReflect: { value: GLOW_DEFAULT.reflection },
    uPalette: { value: paletteColors },
    uPaletteSize: { value: 1 },
  }
  const strandBlend = {
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquation: THREE.AddEquation,
  }
  const directMat = new THREE.ShaderMaterial({ vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, uniforms: { ...shared, uMirror: { value: 0 } }, ...strandBlend })
  const mirrorMat = new THREE.ShaderMaterial({ vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, uniforms: { ...shared, uMirror: { value: 1 } }, ...strandBlend })
  let strandGeo = new THREE.BufferGeometry()
  const direct = new THREE.Mesh(strandGeo, directMat)
  const mirror = new THREE.Mesh(strandGeo, mirrorMat)
  mirror.scale.y = -1
  mirror.position.y = -1
  direct.frustumCulled = false
  mirror.frustumCulled = false
  world.add(mirror, direct)

  // --- post chain --------------------------------------------------------
  const hdr = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false }
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples: 4 })
  const blendTarget = new THREE.WebGLRenderTarget(1, 1, hdr)
  const shrinkTargets = Array.from({ length: BLOOM_TIERS }, () => new THREE.WebGLRenderTarget(1, 1, hdr))
  const growTargets = Array.from({ length: BLOOM_TIERS - 1 }, () => new THREE.WebGLRenderTarget(1, 1, hdr))
  ;[blendTarget, ...shrinkTargets, ...growTargets].forEach((rt) => {
    rt.texture.minFilter = THREE.LinearFilter
    rt.texture.magFilter = THREE.LinearFilter
    rt.texture.generateMipmaps = false
  })
  const flat = { depthTest: false, depthWrite: false }
  const shrinkMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: SHRINK_FRAG, uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uCut: { value: 0 }, uGate: { value: 0 } }, ...flat })
  const growMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: GROW_FRAG, uniforms: { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 0.6 } }, ...flat })
  const blendMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: BLEND_FRAG, uniforms: { tScene: { value: sceneTarget.texture }, tHalo: { value: null }, uHalo: { value: GLOW_DEFAULT.bloom } }, ...flat })
  const finishMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: FINISH_FRAG, uniforms: { tSrc: { value: blendTarget.texture }, uTexel: { value: new THREE.Vector2() }, uBlur: { value: GLOW_DEFAULT.focusBlur }, uExposure: { value: GLOW_DEFAULT.exposure }, uBackdrop: { value: new THREE.Color(0, 0, 0) } }, ...flat })
  const quadScene = new THREE.Scene()
  const quadCam = new THREE.Camera()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finishMat)
  quad.frustumCulled = false
  quadScene.add(quad)
  const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = mat
    renderer.setRenderTarget(target)
    renderer.render(quadScene, quadCam)
  }

  // --- sizing ------------------------------------------------------------
  let cssW = 0
  let cssH = 0
  let ratio = 0
  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    const r = clampTo(Math.min(window.devicePixelRatio || 1, settings.current.pixelRatio), 0.5, 2)
    if (w < 1 || h < 1) return
    if (w === cssW && h === cssH && r === ratio) return
    cssW = w
    cssH = h
    ratio = r
    renderer.setPixelRatio(r)
    renderer.setSize(w, h, false)
    const bw = Math.max(1, Math.floor(w * r))
    const bh = Math.max(1, Math.floor(h * r))
    sceneTarget.setSize(bw, bh)
    blendTarget.setSize(bw, bh)
    shrinkTargets.forEach((rt, i) => rt.setSize(Math.max(1, bw >> (i + 1)), Math.max(1, bh >> (i + 1))))
    growTargets.forEach((rt, i) => rt.setSize(Math.max(1, bw >> (i + 1)), Math.max(1, bh >> (i + 1))))
    finishMat.uniforms.uTexel.value.set(1 / bw, 1 / bh)
    const aspect = w / h
    const baseTan = Math.tan(THREE.MathUtils.degToRad(VIEW.fov / 2))
    // portrait: widen the vertical fov so the trails still fill the width
    const tanV = aspect < 1 ? Math.min(baseTan / aspect, 1) : baseTan
    camera.aspect = aspect
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV))
    camera.updateProjectionMatrix()
  }

  // --- per-frame sync ----------------------------------------------------
  let paletteKey = ""
  let backdropKey = ""
  const sync = () => {
    const p = settings.current
    shared.uFlow.value = p.motion.reverse ? -1 : 1
    shared.uGain.value = p.glow.intensity * GAIN_SCALE
    shared.uPulseCount.value = p.pulses.density
    shared.uPulseSize.value = p.pulses.size
    shared.uPulseRate.value = p.pulses.rate
    shared.uReflect.value = p.glow.reflection
    const pk = p.palette.join("|")
    if (pk !== paletteKey) {
      paletteKey = pk
      for (let i = 0; i < PALETTE_SLOTS; i++) {
        try {
          paletteColors[i].setStyle(p.palette[Math.min(i, p.palette.length - 1)])
        } catch {
          paletteColors[i].set(0xffffff)
        }
      }
      shared.uPaletteSize.value = p.palette.length
    }
    if (p.backdrop !== backdropKey) {
      backdropKey = p.backdrop
      try {
        finishMat.uniforms.uBackdrop.value.setStyle(p.backdrop)
      } catch {
        finishMat.uniforms.uBackdrop.value.set(0)
      }
    }
    blendMat.uniforms.uHalo.value = p.glow.bloom
    growMat.uniforms.uSpread.value = 0.35 + p.glow.bloomRadius * 0.55
    shrinkMat.uniforms.uCut.value = p.glow.bloomThreshold
    finishMat.uniforms.uBlur.value = p.glow.focusBlur
    finishMat.uniforms.uExposure.value = p.glow.exposure
  }

  const draw = () => {
    if (cssW < 1 || cssH < 1) return
    sync()
    renderer.setRenderTarget(sceneTarget)
    renderer.setClearColor(0, 1)
    renderer.clear()
    renderer.render(world, camera)
    // bloom: shrink chain
    let source = sceneTarget.texture
    let sw = sceneTarget.width
    let sh = sceneTarget.height
    for (let i = 0; i < BLOOM_TIERS; i++) {
      shrinkMat.uniforms.tSrc.value = source
      shrinkMat.uniforms.uTexel.value.set(1 / sw, 1 / sh)
      shrinkMat.uniforms.uGate.value = i === 0 ? 1 : 0
      pass(shrinkMat, shrinkTargets[i])
      source = shrinkTargets[i].texture
      sw = shrinkTargets[i].width
      sh = shrinkTargets[i].height
    }
    // bloom: grow chain
    let low = shrinkTargets[BLOOM_TIERS - 1]
    for (let i = BLOOM_TIERS - 2; i >= 0; i--) {
      growMat.uniforms.tLow.value = low.texture
      growMat.uniforms.tHigh.value = shrinkTargets[i].texture
      growMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height)
      pass(growMat, growTargets[i])
      low = growTargets[i]
    }
    blendMat.uniforms.tHalo.value = growTargets[0].texture
    pass(blendMat, blendTarget)
    pass(finishMat, null)
  }

  // --- geometry ----------------------------------------------------------
  const rebuild = () => {
    const p = settings.current
    const spec = coveSpec(p.stage)
    const next = weaveStrands(layStrands(p.trails), spec)
    strandGeo.dispose()
    strandGeo = next
    direct.geometry = next
    mirror.geometry = next
    shared.uFloorEnd.value = spec.run / spec.total
    wake()
  }

  // --- gated loop: only runs in view, with the tab open ------------------
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null
  const gate = {
    inView: typeof IntersectionObserver === "undefined",
    tabOpen: document.visibilityState !== "hidden",
    calm: motionQuery ? motionQuery.matches : false,
  }
  const permitted = () => gate.inView && gate.tabOpen
  let rafId = 0
  let lastStamp = 0
  let clock = 0
  const tick = (now: number) => {
    rafId = 0
    if (!permitted()) {
      lastStamp = 0
      return
    }
    const dt = lastStamp ? Math.min((now - lastStamp) / 1000, 0.05) : 0
    lastStamp = now
    if (!gate.calm) {
      clock += dt * settings.current.motion.speed * SPEED_SCALE
      shared.uClock.value = clock
    }
    draw()
    // reduced motion: one still frame, no loop
    if (!gate.calm) rafId = requestAnimationFrame(tick)
    else lastStamp = 0
  }
  function wake() {
    if (rafId || !permitted()) return
    rafId = requestAnimationFrame(tick)
  }
  const park = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    lastStamp = 0
  }
  let observer: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        gate.inView = !!entry && entry.isIntersecting
        if (gate.inView) wake()
        else park()
      },
      { threshold: 0 },
    )
    observer.observe(host)
  }
  const onTab = () => {
    gate.tabOpen = document.visibilityState !== "hidden"
    if (gate.tabOpen) wake()
    else park()
  }
  document.addEventListener("visibilitychange", onTab)
  const onMotionPref = () => {
    gate.calm = motionQuery ? motionQuery.matches : false
    park()
    wake()
  }
  motionQuery?.addEventListener("change", onMotionPref)
  const onSize = () => {
    resize()
    wake()
  }
  const sizeWatcher = new ResizeObserver(onSize)
  sizeWatcher.observe(host)
  resize()
  rebuild()

  const refresh = () => {
    resize()
    wake()
  }
  const teardown = () => {
    park()
    observer?.disconnect()
    sizeWatcher.disconnect()
    document.removeEventListener("visibilitychange", onTab)
    motionQuery?.removeEventListener("change", onMotionPref)
    strandGeo.dispose()
    quad.geometry.dispose()
    ;[directMat, mirrorMat, shrinkMat, growMat, blendMat, finishMat].forEach((m) => m.dispose())
    ;[sceneTarget, blendTarget, ...shrinkTargets, ...growTargets].forEach((rt) => rt.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
  }
  return { rebuild, refresh, teardown }
}
// #endregion

export default function Covelight({
  preset = "scalio",
  palette,
  backdrop = "#000000",
  trails,
  motion,
  pulses,
  glow,
  stage,
  pixelRatio = 1.5,
  className = "",
  style,
  children,
}: CovelightProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const engineRef = React.useRef<ReturnType<typeof startEngine>>(null)
  const settings = React.useRef<Settings>(null as unknown as Settings)
  settings.current = {
    palette: palette ? tidyPalette(palette) : PRESETS[preset],
    backdrop,
    trails: { ...TRAIL_DEFAULT, ...trails },
    motion: { ...MOTION_DEFAULT, ...motion },
    pulses: { ...PULSE_DEFAULT, ...pulses },
    glow: { ...GLOW_DEFAULT, ...glow },
    stage: { ...STAGE_DEFAULT, ...stage },
    pixelRatio,
  }

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const engine = startEngine(host, settings)
    engineRef.current = engine
    return () => {
      engine?.teardown()
      engineRef.current = null
    }
  }, [])

  // geometry only rebuilds when the trail layout or stage shape changes
  const shapeKey = JSON.stringify([settings.current.trails, settings.current.stage])
  React.useEffect(() => {
    engineRef.current?.rebuild()
  }, [shapeKey])
  React.useEffect(() => {
    engineRef.current?.refresh()
  })

  return (
    <div className={"relative w-full h-full overflow-hidden " + className} style={{ background: backdrop, ...style }}>
      <div ref={hostRef} className="absolute inset-0" aria-hidden />
      {children}
    </div>
  )
}
