import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { latLon, PLANET_R } from './planet.js'
import { questStore } from './questStore.js'
import { toToon } from './World.jsx'

const P = (lat, lon) => latLon(lat, lon, PLANET_R + 0.5)

// The town's cast — real Mixamo bodies. Their GLBs carry no animations:
// the Messaggera's clips are retargeted onto each skeleton at load
// (all Mixamo rigs share bone names, only the 'mixamorigN:' prefix differs).
// The Signore reuses the giornalaio body with a warm-gray tint.
const CAST = [
  { id: 'giornalaio', glb: '/npc-giornalaio.glb?v=1', questId: 'morning', at: 'giver', pos: P(30, 10), look: P(35, 0), scale: 1.0 },
  { id: 'poetessa', glb: '/npc-poetessa.glb?v=1', questId: 'verse', at: 'giver', pos: P(-35, 45), look: P(-31, 49), scale: 0.99 },
  { id: 'fioraia', glb: '/npc-fioraia.glb?v=1', questId: 'flowers', at: 'giver', pos: P(42, 170), look: P(39, 173), scale: 1.0 },
  { id: 'signore', glb: '/npc-giornalaio.glb?v=1', questId: 'knot', at: 'giver', pos: P(33, 94), look: P(36, 77.5), tint: '#d8cfc4', scale: 0.97 },
  { id: 'signora', glb: '/npc-signora.glb?v=1', questId: 'knot', at: 'target', pos: P(36, 77.5), look: P(33, 94), scale: 0.96 },
  { id: 'giardiniere', glb: '/npc-giardiniere.glb?v=1', questId: 'springs', at: 'giver', pos: P(-42, 135), look: P(-33, 135), scale: 1.0 },
]

function NPC({ def, collidersRef, animations }) {
  const group = useRef()
  const { scene: source } = useGLTF(def.glb)

  // Skinned meshes MUST be cloned with SkeletonUtils so each instance
  // gets its own bone hierarchy — a plain clone() shares (and breaks) skeletons.
  const model = useMemo(() => {
    const c = cloneSkeleton(source)
    c.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false
        if (o.material) {
          o.material = o.material.clone()
          if (def.tint) o.material.color = new THREE.Color(def.tint)
          o.material.side = THREE.DoubleSide
          toToon(o)
        }
      }
    })
    return c
  }, [source, def])

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

  // Retarget the Messaggera's clips: swap the bone prefix, drop root motion
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

  const st = useRef({
    grounded: false,
    oriented: false,
    anim: '',
    idleOffset: Math.random() * 4,   // desync the crowd
  })

  useFrame((_, dt) => {
    mixer.update(dt)
    const s = st.current
    if (!group.current) return
    const up = def.pos.clone().normalize()

    // Drop onto the actual ground once the collider exists. A building sitting
    // over the NPC's spot adds roof/floor hits ABOVE the street, so the first
    // hit can be a roof. The street is always the hit closest to the planet
    // centre, so we take the lowest-radius hit — this keeps NPCs on the ground
    // even when a house is directly over them. (firstHitOnly OFF: we need all.)
    if (!s.grounded && collidersRef.current) {
      const rc = new THREE.Raycaster(def.pos.clone().addScaledVector(up, 10), up.clone().negate(), 0, 40)
      const hits = rc.intersectObject(collidersRef.current, false)
      if (hits.length) {
        let ground = hits[0]
        for (const h of hits) if (h.point.length() < ground.point.length()) ground = h
        group.current.position.copy(ground.point)
      } else {
        group.current.position.copy(def.pos)
      }
      s.grounded = true
    }

    // Face their look-point (couple face each other, sellers face their square)
    if (!s.oriented) {
      const fwd = def.look.clone().sub(def.pos)
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize()
      const x = new THREE.Vector3().crossVectors(up, fwd).normalize()
      group.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, fwd))
      s.oriented = true
    }

    // Talk when THEIR dialogue is open; otherwise idle
    const qs = questStore.get().q[def.questId]
    const talkingAt = qs
      ? (['intro', 'outro'].includes(qs.phase) ? 'giver' : ['mid', 'choice'].includes(qs.phase) ? 'target' : null)
      : null
    const desired = talkingAt === def.at ? 'Talk' : 'Idle'
    if (desired !== s.anim && actions[desired]) {
      const prev = actions[s.anim]
      if (prev) prev.fadeOut(0.25)
      const a = actions[desired].reset().fadeIn(0.25).play()
      if (desired === 'Idle') a.time = s.idleOffset % (a.getClip().duration || 1)
      s.anim = desired
    }
  })

  return (
    <group ref={group} scale={def.scale}>
      <primitive object={model} />
    </group>
  )
}

export default function NPCs({ collidersRef }) {
  const { animations } = useGLTF('/messaggera.glb?v=5')
  return CAST.map((def) => (
    <NPC key={def.id} def={def} collidersRef={collidersRef} animations={animations} />
  ))
}

useGLTF.preload('/npc-giornalaio.glb?v=1')
useGLTF.preload('/npc-poetessa.glb?v=1')
useGLTF.preload('/npc-fioraia.glb?v=1')
useGLTF.preload('/npc-signora.glb?v=1')
useGLTF.preload('/npc-giardiniere.glb?v=1')
