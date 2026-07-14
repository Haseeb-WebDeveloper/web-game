import { useEffect, useRef, useState } from 'react'
import { useQuest, startDive, introProgress } from './questStore.js'
import { initAudioOnGesture } from './audio.js'
import { STR } from './i18n.js'

// The landing page: scroll to spin the planet closer, then press the
// perfume pump to dive in.
export default function IntroOverlay() {
  const st = useQuest()
  const [p, setP] = useState(0)
  const scrollRef = useRef(null)
  const inScroll = st.intro === 'scroll'

  // Keyboard must work BEFORE the user ever clicks: focus the scroll layer on
  // mount, and drive it directly from a window-level key handler so arrows /
  // PageDown / Space scroll the intro no matter what has focus.
  useEffect(() => {
    if (!inScroll) return
    const el = scrollRef.current
    if (el) el.focus({ preventScroll: true })
    const onKey = (e) => {
      const sc = scrollRef.current
      if (!sc) return
      const steps = {
        ArrowDown: 140, KeyS: 140, PageDown: 420, Space: 420,
        ArrowUp: -140, KeyW: -140, PageUp: -420,
      }
      const d = steps[e.code]
      if (d === undefined) return
      e.preventDefault()
      sc.scrollBy({ top: d, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
          <div className="intro-fixed">
            <div className="intro-title">{STR.ui.introTitle}</div>
            <div className="intro-bottom">
              {p < 0.82 ? (
                <div className="intro-hint" role="img" aria-label={STR.ui.introHint}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 15C5 16.8565 5.73754 18.6371 7.05029 19.9498C8.36305 21.2626 10.1435 21.9999 12 21.9999C13.8565 21.9999 15.637 21.2626 16.9498 19.9498C18.2625 18.6371 19 16.8565 19 15V9C19 7.14348 18.2625 5.36305 16.9498 4.05029C15.637 2.73754 13.8565 2 12 2C10.1435 2 8.36305 2.73754 7.05029 4.05029C5.73754 5.36305 5 7.14348 5 9V15Z" fill="rgba(28,28,28,0.65)" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 6V14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 11L12 14L9 11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
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
