import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { toToon } from './World.jsx'

// Shared setup for every human character that isn't the player: clone the body,
// retarget the Messaggera's clips onto its skeleton, build a mixer + actions.
// Used by both the quest cast (NPCs.jsx) and the background people
// (AmbientNPCs.jsx) so the retargeting rules live in exactly one place.
export function useHumanBody(glb, animations, { tint } = {}) {
  const { scene: source } = useGLTF(glb)

  // Skinned meshes MUST be cloned with SkeletonUtils so each instance
  // gets its own bone hierarchy — a plain clone() shares (and breaks) skeletons.
  const model = useMemo(() => {
    const c = cloneSkeleton(source)
    c.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false
        if (o.material) {
          o.material = o.material.clone()
          if (tint) o.material.color = new THREE.Color(tint)
          o.material.side = THREE.DoubleSide
          toToon(o)
        }
      }
    })
    return c
  }, [source, tint])

  // This rig's bone prefix. NOTE: three.js strips ':' from node names at
  // load, so 'mixamorig:Hips' arrives as 'mixamorigHips' — prefixes here
  // are 'mixamorig', 'mixamorig2', etc., colon-free.
  const prefix = useMemo(() => {
    let p = 'mixamorig'
    model.traverse((o) => {
      if (o.isBone && o.name.endsWith('Hips')) p = o.name.slice(0, -4)
    })
    return p
  }, [model])

  // Retarget the Messaggera's clips: swap the bone prefix, drop root motion.
  // Rigs exported at a reduced Mixamo skeleton LOD are missing finger bones —
  // those tracks simply find no target and are skipped, which is harmless.
  const clips = useMemo(() => animations.map((clip) => {
    const c = clip.clone()
    c.tracks = c.tracks
      .filter((t) => !/Hips\.position$/i.test(t.name))
      .map((t) => {
        const tt = t.clone()
        tt.name = tt.name.replace(/^mixamorig\d*/, prefix)
        return tt
      })
    return c
  }), [animations, prefix])

  const mixer = useMemo(() => {
    const m = new THREE.AnimationMixer(model)
    m.timeScale = 0.5   // 60fps-scene export vs 30fps clips, same as the player
    return m
  }, [model])

  const actions = useMemo(() => {
    const map = {}
    for (const clip of clips) map[clip.name] = mixer.clipAction(clip)
    return map
  }, [clips, mixer])

  return { model, mixer, actions }
}
