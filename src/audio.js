// Synthesized game audio — no sound files needed.
// Everything is generated with WebAudio: footsteps (filtered noise bursts),
// wind (looped noise + slow swell), birdsong (little sine chirps).

let ctx = null
let master = null
let muted = false
let started = false

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.65
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

export function initAudioOnGesture() {
  ensure()
  if (!started) {
    started = true
    startAmbience()
    startMusic()
  }
}

export function setMuted(m) {
  muted = m
  if (master) master.gain.value = m ? 0 : 0.65
}
export function isMuted() { return muted }

function noiseBuffer(dur = 1) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

export function footstep(run = false) {
  if (!ctx || muted) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(0.09)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = run ? 950 : 620
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(run ? 0.08 : 0.09, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  src.connect(f); f.connect(g); g.connect(master)
  src.start(t); src.stop(t + 0.1)
}

export function pickup() {
  if (!ctx || muted) return
  const t = ctx.currentTime
  ;[880, 1320].forEach((freq, i) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t + i * 0.07)
    g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.07 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.22)
    o.connect(g); g.connect(master)
    o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.25)
  })
}

function startAmbience() {
  // soft wind bed with a slow breathing swell
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(2)
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 320
  const g = ctx.createGain()
  g.gain.value = 0.05
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.13
  const lg = ctx.createGain()
  lg.gain.value = 0.022
  lfo.connect(lg); lg.connect(g.gain); lfo.start()
  src.connect(f); f.connect(g); g.connect(master)
  src.start()
  scheduleChirp()
}

function scheduleChirp() {
  setTimeout(() => { chirp(); scheduleChirp() }, 2500 + Math.random() * 6500)
}

// ---------- generative music ----------
// A slow chord pad that never repeats exactly. Day is bright and airy;
// after the dusk shift the harmony warms up and the tempo relaxes.
let duskMode = false
export function setMusicDusk(d) { duskMode = d }

// chords as frequency ratios over a root (Hz)
const DAY_ROOT = 261.63 // C4
const DAY_CHORDS = [
  [1, 5 / 4, 3 / 2, 15 / 8],      // Cmaj7
  [5 / 6, 1, 5 / 4, 3 / 2],       // Am-ish
  [2 / 3, 5 / 6, 1, 5 / 4],       // F-ish
  [3 / 4, 15 / 16, 9 / 8, 3 / 2], // G-ish
]
const DUSK_ROOT = 220 // A3
const DUSK_CHORDS = [
  [1, 6 / 5, 3 / 2, 9 / 5],       // Am7
  [4 / 3, 5 / 3, 2, 5 / 2],       // F-ish, high
  [9 / 10, 9 / 8, 27 / 20, 9 / 5],// Dm-ish
  [1, 5 / 4, 3 / 2, 15 / 8],      // warm resolve
]
let chordIdx = 0

function playChord() {
  if (!ctx) return
  const root = duskMode ? DUSK_ROOT : DAY_ROOT
  const chords = duskMode ? DUSK_CHORDS : DAY_CHORDS
  const ratios = chords[chordIdx % chords.length]
  chordIdx++
  const t = ctx.currentTime
  const hold = duskMode ? 7.5 : 5.5
  ratios.forEach((r, i) => {
    const o = ctx.createOscillator()
    o.type = i === 0 ? 'sine' : 'triangle'
    o.frequency.value = root * r
    o.detune.value = (Math.random() - 0.5) * 7
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 900
    const g = ctx.createGain()
    const peak = (i === 0 ? 0.035 : 0.02) * (muted ? 0 : 1)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(Math.max(peak, 0.0001), t + hold * 0.45)
    g.gain.linearRampToValueAtTime(0.0001, t + hold * 1.15)
    o.connect(f); f.connect(g); g.connect(master)
    o.start(t); o.stop(t + hold * 1.2)
  })
}

// an occasional single pentatonic sparkle over the pad
function sparkle() {
  if (!ctx || muted) return
  const root = duskMode ? DUSK_ROOT : DAY_ROOT
  const penta = [2, 9 / 4, 5 / 2, 3, 10 / 3]
  const f0 = root * penta[Math.floor(Math.random() * penta.length)]
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = f0
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
  o.connect(g); g.connect(master)
  o.start(t); o.stop(t + 1.5)
}

function startMusic() {
  const chordLoop = () => {
    playChord()
    setTimeout(chordLoop, (duskMode ? 7500 : 5500))
  }
  chordLoop()
  const sparkleLoop = () => {
    if (Math.random() < 0.6) sparkle()
    setTimeout(sparkleLoop, 3500 + Math.random() * 5000)
  }
  setTimeout(sparkleLoop, 4000)
}

function chirp() {
  if (!ctx || muted) return
  const t0 = ctx.currentTime
  const notes = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < notes; i++) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    const g = ctx.createGain()
    const t = t0 + i * 0.13
    const f0 = 2300 + Math.random() * 1500
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.35), t + 0.07)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    o.connect(g); g.connect(master)
    o.start(t); o.stop(t + 0.13)
  }
}
