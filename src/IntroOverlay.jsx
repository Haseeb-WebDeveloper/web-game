import { useEffect, useRef, useState } from 'react'
import { useQuest, startDive, introProgress } from './questStore.js'
import { initAudioOnGesture } from './audio.js'
import { STR } from './i18n.js'

// The landing page: scroll to spin the planet closer, then press the
// perfume pump to dive in.
export default function IntroOverlay({ booted }) {
  const st = useQuest()
  const [p, setP] = useState(0)
  const scrollRef = useRef(null)
  const inScroll = st.intro === 'scroll'

  // Keyboard must work BEFORE the user ever clicks: focus the scroll layer on
  // mount, and drive it from window-level key handlers so arrows / PageDown /
  // Space scroll the intro no matter what has focus. A tap gives one smooth
  // step; HOLDING the key scrolls continuously (repeated smooth scrollBy calls
  // cancel each other, which made held keys crawl).
  useEffect(() => {
    if (!inScroll) return
    const el = scrollRef.current
    if (el) el.focus({ preventScroll: true })

    const KEYS = {
      ArrowDown: { dir: 1, mult: 1 }, KeyS: { dir: 1, mult: 1 },
      PageDown: { dir: 1, mult: 3 }, Space: { dir: 1, mult: 3 },
      ArrowUp: { dir: -1, mult: 1 }, KeyW: { dir: -1, mult: 1 },
      PageUp: { dir: -1, mult: 3 },
    }
    const HOLD_SPEED = 1100 // px per second while a key is held
    const held = { dir: 0, mult: 1, since: 0 }
    let raf = 0
    let last = 0

    const tick = (t) => {
      raf = 0
      const sc = scrollRef.current
      if (!sc || !held.dir) return
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0
      last = t
      // let the initial smooth step play out before the hold speed kicks in
      if (t - held.since > 250) sc.scrollBy(0, held.dir * held.mult * HOLD_SPEED * dt)
      raf = requestAnimationFrame(tick)
    }
    const onKeyDown = (e) => {
      const k = KEYS[e.code]
      if (!k) return
      e.preventDefault()
      if (e.repeat) return
      const sc = scrollRef.current
      if (sc) sc.scrollBy({ top: k.dir * k.mult * 140, behavior: 'smooth' })
      held.dir = k.dir; held.mult = k.mult; held.since = performance.now()
      last = 0
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onKeyUp = (e) => {
      if (KEYS[e.code]) held.dir = 0
    }
    const onBlur = () => { held.dir = 0 }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [inScroll])

  if (!st.intro) return null

  const onScroll = (e) => {
    const el = e.target
    const v = Math.min(1, el.scrollTop / (el.scrollHeight - el.clientHeight))
    introProgress.v = v
    setP(v)
  }
  const dive = () => { initAudioOnGesture(); startDive() }

  return (
    <>
      {st.intro === 'scroll' && (
        <div className="intro-scroll" onScroll={onScroll} ref={scrollRef} tabIndex={-1}>
          <div className="intro-track" />
          <div className={booted ? 'intro-fixed boot' : 'intro-fixed'}>
            <div className="intro-title">{STR.ui.introTitle}</div>
            <div className="intro-bottom">
              {p < 0.82 ? (
                <button
                  className="intro-hint"
                  aria-label={STR.ui.introHint}
                  onClick={() => {
                    const sc = scrollRef.current
                    if (!sc) return
                    const range = sc.scrollHeight - sc.clientHeight
                    sc.scrollBy({ top: range * 0.34, behavior: 'smooth' })
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 15C5 16.8565 5.73754 18.6371 7.05029 19.9498C8.36305 21.2626 10.1435 21.9999 12 21.9999C13.8565 21.9999 15.637 21.2626 16.9498 19.9498C18.2625 18.6371 19 16.8565 19 15V9C19 7.14348 18.2625 5.36305 16.9498 4.05029C15.637 2.73754 13.8565 2 12 2C10.1435 2 8.36305 2.73754 7.05029 4.05029C5.73754 5.36305 5 7.14348 5 9V15Z" fill="rgba(28,28,28,0.65)" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 6V14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 11L12 14L9 11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button className="vaporize" onClick={dive}>
                  {STR.ui.vaporize}
                </button>
              )}
            </div>
            <button className="intro-skip" onClick={dive}>{STR.ui.skip}</button>
          </div>
        </div>
      )}
      {st.intro === 'diving' && <div className="intro-dive-tint" />}
    </>
  )
}
