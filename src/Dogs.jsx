import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { latLon, PLANET_R } from './planet.js'
import { toToon } from './World.jsx'

// --- tuning ---
const DOG_SCALE = 0.26       // native model is ~3 units tall → small street dog
const MODEL_FWD = 1          // flip to -1 if the dog moon-walks (faces -Z)
const DOG_LIFT = 0.08        // small lift so the animated paws clear the ground
const WALK_SPEED = 1.6       // units/sec
const WANDER_DEG = 7         // how far from home it roams (degrees of arc)
const PAUSE_MIN = 1.6, PAUSE_MAX = 5.0
const SURF = PLANET_R + 0.5

// Where the dogs live (lat, lon). One by the fountain (with the cats), one by the kiosk.
const DOGS = [
  { home: [34, 90] },
  { home: [28, 8] },
]

function Dog({ def, collidersRef, source }) {
  const group = useRef()

  const model = useMemo(() => {
    const c = cloneSkeleton(source.scene)
    c.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.frustumCulled = false
        o.castShadow = true
        if (o.material) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; toToon(o) }
      }
    })
    // drop the model so its feet sit exactly at the group origin → no sinking
    const box = new THREE.Box3().setFromObject(c)
    c.position.y -= box.min.y
    return c
  }, [source])

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])
  const actions = useMemo(() => {
    const map = {}
    for (const clip of source.animations) map[clip.name] = mixer.clipAction(clip)
    return map
  }, [source, mixer])

  const st = useRef({
    pos: latLon(def.home[0], def.home[1], SURF),
    target: null,
    facing: new THREE.Vector3(),
    phase: 'pause',
    timer: 1 + Math.random() * 2.5,   // desync the dogs
    anim: '',
    grounded: false,
  })

  const play = (name) => {
    const s = st.current
    if (name === s.anim || !actions[name]) return
    const prev = actions[s.anim]
    if (prev) prev.fadeOut(0.25)
    actions[name].reset().fadeIn(0.25).play()
    s.anim = name
  }

  // drop a point onto the actual street (lowest-radius hit, so roofs don't win)
  const snapToGround = (pos) => {
    const up = pos.clone().normalize()
    const rc = new THREE.Raycaster(pos.clone().addScaledVector(up, 8), up.clone().negate(), 0, 30)
    const hits = rc.intersectObject(collidersRef.current, false)
    if (!hits.length) return pos
    let g = hits[0]
    for (const h of hits) if (h.point.length() < g.point.length()) g = h
    return g.point.clone()
  }

  const pickTarget = () => latLon(
    def.home[0] + (Math.random() - 0.5) * 2 * WANDER_DEG,
    def.home[1] + (Math.random() - 0.5) * 2 * WANDER_DEG,
    SURF,
  )

  useFrame((_, dt) => {
    mixer.update(dt)
    const s = st.current
    if (!group.current || !collidersRef.current) return

    if (!s.grounded) {
      const up0 = s.pos.clone().normalize()
      s.pos = snapToGround(s.pos)
      s.facing.set(0, 1, 0).cross(up0).normalize()
      s.grounded = true
      play('Idle')
    }

    const up = s.pos.clone().normalize()

    if (s.phase === 'walk' && s.target) {
      const toT = s.target.clone().sub(s.pos)
      toT.sub(up.clone().multiplyScalar(toT.dot(up)))   // project onto the surface tangent
      const dist = toT.length()
      if (dist < 0.4) {
        // arrived → pause and do a little idle / sniff / nibble
        s.phase = 'pause'
        s.timer = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN)
        const r = Math.random()
        play(r < 0.3 ? 'Eating' : r < 0.6 ? 'Idle_2' : 'Idle')
      } else {
        const dir = toT.normalize()
        // don't walk through buildings — if something's right ahead, stop and repick
        const ahead = new THREE.Raycaster(s.pos.clone().addScaledVector(up, 0.35), dir, 0, 0.8)
        if (ahead.intersectObject(collidersRef.current, false).length) {
          s.phase = 'pause'
          s.timer = 0.4 + Math.random() * 0.8
          play('Idle')
        } else {
          s.pos.addScaledVector(dir, Math.min(WALK_SPEED * dt, dist))
          s.pos = snapToGround(s.pos)
          s.facing.lerp(dir, 1 - Math.exp(-8 * dt)).normalize()
          play('Walk')
        }
      }
    } else {
      s.timer -= dt
      if (s.timer <= 0) { s.target = pickTarget(); s.phase = 'walk' }
    }

    // place feet on the ground, stand up along the surface normal, face the heading
    const upN = s.pos.clone().normalize()
    group.current.position.copy(s.pos).addScaledVector(upN, DOG_LIFT)
    const zAxis = s.facing.clone().sub(upN.clone().multiplyScalar(s.facing.dot(upN)))
    if (zAxis.lengthSq() < 1e-4) return
    zAxis.normalize().multiplyScalar(MODEL_FWD)
    const xAxis = new THREE.Vector3().crossVectors(upN, zAxis).normalize()
    group.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, upN, zAxis))
  })

  return (
    <group ref={group} scale={DOG_SCALE}>
      <primitive object={model} />
    </group>
  )
}

export default function Dogs({ collidersRef }) {
  const source = useGLTF('/dog.gltf')
  return DOGS.map((def, i) => (
    <Dog key={i} def={def} collidersRef={collidersRef} source={source} />
  ))
}

useGLTF.preload('/dog.gltf')
