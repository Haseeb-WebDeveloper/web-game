import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { latLon, PLANET_R } from './planet.js'
import { questStore } from './questStore.js'
import { useHumanBody } from './useHumanBody.js'
import { useSharedClips } from './clips.js'
import { snapToGround } from './ground.js'
import { playerPos } from './playerPos.js'

const P = (lat, lon) => latLon(lat, lon, PLANET_R + 0.5)

const TURN_RATE = 5    // how fast an NPC swings round to face whoever it's addressing
const NPC_WALK = 1.4   // reunion stroll speed (m/s) — unhurried
const MEET_GAP = 1.3   // how far apart the couple end up, standing face to face

// Shared per-couple reunion progress: the walker flips `arrived` so the waiter
// knows to switch from watching-him-approach to chatting. Module-level so both
// NPC instances of a couple see the same record.
const REUNION = {}

// A point `dist` metres from `from`, stepping along the surface toward `toward`.
// Used to park the walker just short of the waiter instead of on top of her.
function tangentStep(from, toward, dist) {
  const R = PLANET_R + 0.5
  const up = from.clone().normalize()
  const dir = toward.clone().sub(from)
  dir.sub(up.clone().multiplyScalar(dir.dot(up)))
  if (dir.lengthSq() < 1e-6) return from.clone()
  dir.normalize()
  return from.clone().addScaledVector(dir, dist).normalize().multiplyScalar(R)
}

// The town's cast — real Mixamo bodies. Their GLBs carry no animations:
// the Messaggera's clips are retargeted onto each skeleton at load
// (all Mixamo rigs share bone names, only the 'mixamorigN:' prefix differs).
// v2 cast: every role now has its own body, so nobody is a tinted copy any more.
// The nonne are scaled below 1 because the pipeline normalizes everyone to 1.75m.
const CAST = [
  { id: 'giornalaio', glb: '/npc-giornalaio.glb?v=2', questId: 'morning', at: 'giver', pos: P(30, 10), look: P(35, 0), scale: 1.0 },
  { id: 'poetessa', glb: '/npc-poetessa.glb?v=2', questId: 'verse', at: 'giver', pos: P(-35, 45), look: P(-31, 49), scale: 0.99 },
  { id: 'fioraia', glb: '/npc-fioraia.glb?v=2', questId: 'flowers', at: 'giver', pos: P(42, 170), look: P(39, 173), scale: 1.0 },
  // The Knot couple. On quest completion he walks over to her and they make up
  // (see the `couple` block). `partner` is the other one's home spot.
  { id: 'signore', glb: '/npc-aldo.glb?v=1', questId: 'knot', at: 'giver', pos: P(33, 94), look: P(36, 77.5), scale: 0.94,
    couple: { id: 'knot', role: 'walker', partner: P(36, 77.5) } },
  { id: 'signora', glb: '/npc-signora.glb?v=2', questId: 'knot', at: 'target', pos: P(36, 77.5), look: P(33, 94), scale: 0.90,
    couple: { id: 'knot', role: 'waiter', partner: P(33, 94) } },
  { id: 'giardiniere', glb: '/npc-giardiniere.glb?v=2', questId: 'springs', at: 'giver', pos: P(-42, 135), look: P(-33, 135), scale: 1.0 },
]

function NPC({ def, collidersRef, animations }) {
  const group = useRef()
  const { model, mixer, actions } = useHumanBody(def.glb, animations, { tint: def.tint })

  // Where the walker parks: MEET_GAP short of the waiter, on the waiter's side.
  // Both members can derive the same spot from their own def, so the waiter knows
  // where to look and the walker knows where to stop.
  const walkerMeet = useMemo(() => {
    if (!def.couple) return null
    return def.couple.role === 'walker'
      ? tangentStep(def.couple.partner, def.pos, MEET_GAP)   // from her, toward him
      : tangentStep(def.pos, def.couple.partner, MEET_GAP)   // from her, toward him (same point)
  }, [def])

  const st = useRef({
    pos: def.pos.clone(),
    grounded: false,
    oriented: false,
    facing: new THREE.Vector3(),
    anim: '',
    idleOffset: Math.random() * 4,   // desync the crowd
  })

  // Smoothly swing to face `dir` (a world vector), snapping instantly the first time
  const orient = (up, dir, dt) => {
    const s = st.current
    if (dir.lengthSq() < 1e-6) return
    const d = dir.clone().normalize()
    if (!s.oriented) { s.facing.copy(d); s.oriented = true }
    else s.facing.lerp(d, 1 - Math.exp(-TURN_RATE * dt)).normalize()
    const x = new THREE.Vector3().crossVectors(up, s.facing).normalize()
    group.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, s.facing))
  }

  const play = (name) => {
    const s = st.current
    if (name === s.anim || !actions[name]) return
    const prev = actions[s.anim]
    if (prev) prev.fadeOut(0.25)
    const a = actions[name].reset().fadeIn(0.25).play()
    if (name === 'Idle') a.time = s.idleOffset % (a.getClip().duration || 1)
    s.anim = name
  }

  useFrame((_, dt) => {
    mixer.update(dt)
    const s = st.current
    if (!group.current || !collidersRef.current) return

    // Drop onto the actual street once the collider exists (see ground.js for
    // why the topmost hit is the right one on paved ground).
    if (!s.grounded) {
      s.pos = snapToGround(def.pos, collidersRef.current)
      s.grounded = true
    }
    const up = s.pos.clone().normalize()

    // --- REUNION: after The Knot is resolved, he walks over and they make up ---
    const reunion = def.couple && questStore.get().q[def.couple.id].phase === 'done'
    if (reunion) {
      const rec = (REUNION[def.couple.id] ||= { arrived: false })
      let desired = 'Talk'

      if (def.couple.role === 'walker') {
        const toM = walkerMeet.clone().sub(s.pos)
        toM.sub(up.clone().multiplyScalar(toM.dot(up)))   // surface tangent
        const dist = toM.length()
        if (!rec.arrived && dist > 0.25) {
          const dir = toM.clone().normalize()
          // if something's in the way, just stop and talk from here rather than
          // shoving through it — a v1 safety net until the path is confirmed clear
          const ahead = new THREE.Raycaster(s.pos.clone().addScaledVector(up, 1.0), dir, 0, 1.0)
          if (ahead.intersectObject(collidersRef.current, false).length) {
            rec.arrived = true
          } else {
            s.pos.addScaledVector(dir, Math.min(NPC_WALK * dt, dist))
            s.pos = snapToGround(s.pos, collidersRef.current)
            orient(s.pos.clone().normalize(), dir, dt)
            desired = 'Walk'
          }
        } else {
          rec.arrived = true
        }
        if (desired === 'Talk') {
          const u2 = s.pos.clone().normalize()
          orient(u2, def.couple.partner.clone().sub(s.pos), dt)   // turn to face her
        }
      } else {
        // waiter: stay put, watch him approach, start chatting once he's here
        orient(up, walkerMeet.clone().sub(s.pos), dt)
        desired = rec.arrived ? 'Talk' : 'Idle'
      }

      group.current.position.copy(s.pos)
      play(desired)
      return
    }

    // --- NORMAL: static, faces whoever they're addressing ---
    group.current.position.copy(s.pos)

    // Talk when THEIR dialogue is open; otherwise idle
    const qs = questStore.get().q[def.questId]
    const talkingAt = qs
      ? (['intro', 'outro'].includes(qs.phase) ? 'giver' : ['mid', 'choice'].includes(qs.phase) ? 'target' : null)
      : null
    const desired = talkingAt === def.at ? 'Talk' : 'Idle'

    // Turn to face whoever they're addressing: the player while she's talking
    // to them, otherwise their resting look-point (couple face each other,
    // sellers face their square). Smooth so it reads as looking up to greet her.
    const lookAt = desired === 'Talk' ? playerPos : def.look
    orient(up, lookAt.clone().sub(s.pos), dt)
    play(desired)
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
