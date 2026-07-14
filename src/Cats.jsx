import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { latLon, PLANET_R } from './planet.js'
import { toToon } from './World.jsx'

// Cat model: Blend Swap #86110 "Rigged and animated Cat" — CC-BY 3.0.
// ⚠️ ATTRIBUTION REQUIRED: credit the author in the game credits / README.
// (Hair particles stripped, exported to /cat.glb with the Walk clip.)

// --- tuning ---
const CAT_SCALE = 0.11       // native model ~9 units → small cat
const CAT_LIFT = 0.12        // small lift so the animated paws clear the ground
const MODEL_FWD = 1          // flip to -1 if the cat moon-walks (faces -Z)
const WALK_SPEED = 1.1       // cats saunter slower than the dog
const WANDER_DEG = 4         // cats stay close to the signora
const PAUSE_MIN = 2.0, PAUSE_MAX = 6.5
const SURF = PLANET_R + 0.5

// Cats live by the signora at the fountain (Scene 4 — "feeding the cats")
const CATS = [
  { home: [36, 79] },
  { home: [35, 84] },
]

function Cat({ def, collidersRef, source }) {
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
  // this cat only has a Walk cycle — play it, and freeze it (frame 0) while paused
  const walk = useMemo(() => {
    const clip = source.animations.find((a) => /walk/i.test(a.name)) || source.animations[0]
    const a = mixer.clipAction(clip)
    a.play()
    return a
  }, [source, mixer])

  const st = useRef({
    pos: latLon(def.home[0], def.home[1], SURF),
    target: null,
    facing: new THREE.Vector3(),
    phase: 'pause',
    timer: 1 + Math.random() * 3,
    grounded: false,
    moving: null,
  })

  const setMoving = (m) => {
    const s = st.current
    if (m === s.moving) return
    s.moving = m
    walk.paused = !m
    if (!m) walk.time = 0   // freeze on a neutral standing frame while paused
  }

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
      setMoving(false)
    }

    const up = s.pos.clone().normalize()

    if (s.phase === 'walk' && s.target) {
      const toT = s.target.clone().sub(s.pos)
      toT.sub(up.clone().multiplyScalar(toT.dot(up)))
      const dist = toT.length()
      if (dist < 0.3) {
        s.phase = 'pause'
        s.timer = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN)
        setMoving(false)
      } else {
        const dir = toT.normalize()
        // don't walk through buildings — if something's right ahead, stop and repick
        const ahead = new THREE.Raycaster(s.pos.clone().addScaledVector(up, 0.25), dir, 0, 0.6)
        if (ahead.intersectObject(collidersRef.current, false).length) {
          s.phase = 'pause'
          s.timer = 0.4 + Math.random() * 0.8
          setMoving(false)
        } else {
          s.pos.addScaledVector(dir, Math.min(WALK_SPEED * dt, dist))
          s.pos = snapToGround(s.pos)
          s.facing.lerp(dir, 1 - Math.exp(-8 * dt)).normalize()
          setMoving(true)
        }
      }
    } else {
      s.timer -= dt
      if (s.timer <= 0) { s.target = pickTarget(); s.phase = 'walk' }
    }

    const upN = s.pos.clone().normalize()
    group.current.position.copy(s.pos).addScaledVector(upN, CAT_LIFT)
    const zAxis = s.facing.clone().sub(upN.clone().multiplyScalar(s.facing.dot(upN)))
    if (zAxis.lengthSq() < 1e-4) return
    zAxis.normalize().multiplyScalar(MODEL_FWD)
    const xAxis = new THREE.Vector3().crossVectors(upN, zAxis).normalize()
    group.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, upN, zAxis))
  })

  return (
    <group ref={group} scale={CAT_SCALE}>
      <primitive object={model} />
    </group>
  )
}

export default function Cats({ collidersRef }) {
  const source = useGLTF('/cat.glb')
  return CATS.map((def, i) => (
    <Cat key={i} def={def} collidersRef={collidersRef} source={source} />
  ))
}

useGLTF.preload('/cat.glb')
