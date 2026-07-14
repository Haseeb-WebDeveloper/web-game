import { useState } from 'react'
import { initAudioOnGesture } from './audio.js'
import { useQuest } from './questStore.js'

// Shared with Player: analog stick vector, run flag, queued jump
export const touchState = { x: 0, y: 0, run: false, jump: false }

const isTouch =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

// Virtual thumbstick (appears where the left thumb lands) + jump button.
// Camera drag on the right half is handled by the existing pointer events.
export default function TouchControls() {
  const [stick, setStick] = useState(null)
  const st = useQuest()
  if (!isTouch || st.intro) return null

  const RADIUS = 55

  const start = (e) => {
    initAudioOnGesture()
    const t = e.touches[0]
    setStick({ ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 })
  }
  const move = (e) => {
    if (!stick) return
    const t = e.touches[0]
    let dx = t.clientX - stick.ox
    let dy = t.clientY - stick.oy
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len }
    setStick((s) => ({ ...s, dx, dy }))
    touchState.x = dx / RADIUS
    touchState.y = -dy / RADIUS
    touchState.run = len > RADIUS * 0.85   // push to the edge to run
  }
  const end = () => {
    setStick(null)
    touchState.x = 0; touchState.y = 0; touchState.run = false
  }

  return (
    <>
      <div
        className="stick-zone"
        onTouchStart={start} onTouchMove={move}
        onTouchEnd={end} onTouchCancel={end}
      >
        {stick && (
          <>
            <div className="stick-base" style={{ left: stick.ox, top: stick.oy }} />
            <div className="stick-knob" style={{ left: stick.ox + stick.dx, top: stick.oy + stick.dy }} />
          </>
        )}
      </div>
      <button
        className="jump-btn"
        aria-label="jump"
        onTouchStart={(e) => { e.preventDefault(); initAudioOnGesture(); touchState.jump = true }}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 19V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 11.5L12 6l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 19.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </>
  )
}
