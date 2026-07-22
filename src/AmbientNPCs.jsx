import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { PLANET_R } from './planet.js'
import { AMBIENT_CAST } from './ambientCast.js'
import { useHumanBody } from './useHumanBody.js'
import { useSharedClips } from './clips.js'
import { snapToGround } from './ground.js'

// --- tuning ---
const WALK_SPEED = 1.6        // slower than the player's 3.0 — these are strollers
const PAUSE_MIN = 1.2, PAUSE_MAX = 4.0
const MIN_TRIP = 5            // never pick a target closer than this, or they
                              // shuffle a step and stop, which reads as broken
const ARRIVE = 0.4
const TURN_RATE = 6           // how fast they swing round to a new heading
const BLOCKED_TRIES = 6       // re-aim this many times before giving up a frame

// The background people. Same bodies and clips as the quest cast, but nobody
// talks to them: they just stroll around their corner of town so the streets
// aren't empty. Wander logic mirrors Dogs.jsx — walk, pause, repeat.
function Ambient({ def, collidersRef, animations }) {
  const group = useRef()
  const { model, mixer, actions } = useHumanBody(def.glb, animations)

  const st = useRef({
    pos: def.pos.clone(),
    target: null,
    facing: new THREE.Vector3(),
    phase: 'pause',
    timer: Math.random() * PAUSE_MAX,   // desync the crowd
    anim: '',
    grounded: false,
  })

  const play = (name) => {
    const s = st.current
    if (name === s.anim || !actions[name]) return
    const prev = actions[s.anim]
    if (prev) prev.fadeOut(0.3)
    const a = actions[name].reset().fadeIn(0.3).play()
    if (name === 'Idle') a.time = Math.random() * (a.getClip().duration || 1)
    s.anim = name
  }

  // a random point on the surface within the character's roam radius of home,
  // kept on the sphere so nobody wanders off into the sky or down into the crust
  const home = useMemo(() => def.pos.clone(), [def])
  const pickTarget = () => {
    const up = home.clone().normalize()
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize()
    const north = up.clone().cross(east).normalize()
    // sqrt() spreads points evenly over the disc; the MIN_TRIP floor keeps them
    // from picking somewhere they're already standing
    for (let i = 0; i < BLOCKED_TRIES; i++) {
      const a = Math.random() * Math.PI * 2
      const r = def.roam * Math.sqrt(Math.random())
      const t = home.clone()
        .addScaledVector(east, Math.cos(a) * r)
        .addScaledVector(north, Math.sin(a) * r)
        .normalize().multiplyScalar(PLANET_R + 0.5)
      if (t.distanceTo(st.current.pos) > MIN_TRIP) return t
    }
    return home.clone()   // hemmed in — head back to base
  }

  useFrame((_, dt) => {
    mixer.update(dt)
    const s = st.current
    if (!group.current || !collidersRef.current) return

    if (!s.grounded) {
      const up0 = s.pos.clone().normalize()
      s.pos = snapToGround(s.pos, collidersRef.current)
      s.facing.set(0, 1, 0).cross(up0).normalize()
      s.grounded = true
      play('Idle')
    }

    const up = s.pos.clone().normalize()

    if (s.phase === 'walk' && s.target) {
      const toT = s.target.clone().sub(s.pos)
      toT.sub(up.clone().multiplyScalar(toT.dot(up)))   // project onto the surface tangent
      const dist = toT.length()
      if (dist < ARRIVE) {
        s.phase = 'pause'
        s.timer = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN)
        play('Idle')
      } else {
        const dir = toT.normalize()
        // don't walk into walls. Rather than stopping dead (which looked like
        // they'd frozen), pick somewhere else and keep moving.
        const ahead = new THREE.Raycaster(s.pos.clone().addScaledVector(up, 1.0), dir, 0, 1.2)
        if (ahead.intersectObject(collidersRef.current, false).length) {
          s.target = pickTarget()
        } else {
          s.pos.addScaledVector(dir, Math.min(WALK_SPEED * dt, dist))
          s.pos = snapToGround(s.pos, collidersRef.current)
          s.facing.lerp(dir, 1 - Math.exp(-TURN_RATE * dt)).normalize()
          play('Walk')
        }
      }
    } else {
      s.timer -= dt
      if (s.timer <= 0) { s.target = pickTarget(); s.phase = 'walk' }
    }

    // stand on the ground, upright along the surface normal, facing the heading
    const upN = s.pos.clone().normalize()
    group.current.position.copy(s.pos)
    const zAxis = s.facing.clone().sub(upN.clone().multiplyScalar(s.facing.dot(upN)))
    if (zAxis.lengthSq() < 1e-4) return
    zAxis.normalize()
    const xAxis = new THREE.Vector3().crossVectors(upN, zAxis).normalize()
    group.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, upN, zAxis))
  })

  return (
    <group ref={group} scale={def.scale}>
      <primitive object={model} />
    </group>
  )
}

export default function AmbientNPCs({ collidersRef }) {
  const animations = useSharedClips()
  return AMBIENT_CAST.map((def) => (
    <Ambient key={def.id} def={def} collidersRef={collidersRef} animations={animations} />
  ))
}

for (const d of AMBIENT_CAST) useGLTF.preload(d.glb)
