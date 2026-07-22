import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { latLon, PLANET_R } from './planet.js'
import { questStore } from './questStore.js'
import { useHumanBody } from './useHumanBody.js'
import { useSharedClips } from './clips.js'
import { snapToGround } from './ground.js'

const P = (lat, lon) => latLon(lat, lon, PLANET_R + 0.5)

// The town's cast — real Mixamo bodies. Their GLBs carry no animations:
// the Messaggera's clips are retargeted onto each skeleton at load
// (all Mixamo rigs share bone names, only the 'mixamorigN:' prefix differs).
// v2 cast: every role now has its own body, so nobody is a tinted copy any more.
// The nonne are scaled below 1 because the pipeline normalizes everyone to 1.75m.
const CAST = [
  { id: 'giornalaio', glb: '/npc-giornalaio.glb?v=2', questId: 'morning', at: 'giver', pos: P(30, 10), look: P(35, 0), scale: 1.0 },
  { id: 'poetessa', glb: '/npc-poetessa.glb?v=2', questId: 'verse', at: 'giver', pos: P(-35, 45), look: P(-31, 49), scale: 0.99 },
  { id: 'fioraia', glb: '/npc-fioraia.glb?v=2', questId: 'flowers', at: 'giver', pos: P(42, 170), look: P(39, 173), scale: 1.0 },
  { id: 'signore', glb: '/npc-aldo.glb?v=1', questId: 'knot', at: 'giver', pos: P(33, 94), look: P(36, 77.5), scale: 0.94 },
  { id: 'signora', glb: '/npc-signora.glb?v=2', questId: 'knot', at: 'target', pos: P(36, 77.5), look: P(33, 94), scale: 0.90 },
  { id: 'giardiniere', glb: '/npc-giardiniere.glb?v=2', questId: 'springs', at: 'giver', pos: P(-42, 135), look: P(-33, 135), scale: 1.0 },
]

function NPC({ def, collidersRef, animations }) {
  const group = useRef()
  const { model, mixer, actions } = useHumanBody(def.glb, animations, { tint: def.tint })

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

    // Drop onto the actual street once the collider exists (see ground.js for
    // why the topmost hit is the right one on paved ground).
    if (!s.grounded && collidersRef.current) {
      group.current.position.copy(snapToGround(def.pos, collidersRef.current))
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
  const animations = useSharedClips()
  return CAST.map((def) => (
    <NPC key={def.id} def={def} collidersRef={collidersRef} animations={animations} />
  ))
}

// derived from CAST so a body swap can't leave a stale preload behind
for (const d of CAST) useGLTF.preload(d.glb)
