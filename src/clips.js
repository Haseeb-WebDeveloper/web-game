import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

const BASE = '/messaggera.glb?v=5'
const CALM_IDLE = '/anim-idle-calm.glb?v=1'

// Every mixer in the game runs at timeScale 0.5, because the Messaggera's clips
// were exported from a 60fps scene but authored at 30fps. Clips that come from
// anywhere else are already correct, so they'd play at half speed under that
// same mixer. Halving their keyframe times cancels it out — the clip then obeys
// the same convention as the rest, and no caller needs a special case.
function preScaleForMixer(clip) {
  const c = clip.clone()
  c.tracks = c.tracks.map((t) => {
    const tt = t.clone()
    tt.times = tt.times.map ? tt.times.map((v) => v * 0.5) : tt.times
    return tt
  })
  c.resetDuration()
  return c
}

// The full clip set every character shares: the Messaggera's originals plus any
// extra animations. Extras come LAST so a same-named clip overrides the
// original — that's how 'Idle' becomes the calm breathing idle everywhere at
// once, instead of the tense combat-ready pose the export shipped with.
export function useSharedClips() {
  const { animations: base } = useGLTF(BASE)
  const { animations: calmIdle } = useGLTF(CALM_IDLE)
  return useMemo(
    () => [...base, ...calmIdle.map(preScaleForMixer)],
    [base, calmIdle],
  )
}

useGLTF.preload(BASE)
useGLTF.preload(CALM_IDLE)
