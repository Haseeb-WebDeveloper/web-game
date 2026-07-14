import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { latLon, PLANET_R } from './planet.js'
import { TOON_GRADIENT } from './World.jsx'
import { playerPos } from './playerPos.js'

// --- tuning ---
const SURF = PLANET_R + 0.5
const COUNT = 8
const HOME = [30, 10]        // the café / newsstand square (Scene 1)
const SPREAD_DEG = 5
const SCARE = 3.2            // flee when the player gets this close
const WALK_SPEED = 0.35      // little ground shuffles
const FLY_SPEED = 6.0

const mat = (c) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: TOON_GRADIENT, flatShading: true })

// Build one low-poly-but-readable pigeon (faces +Z, standing at y=0).
function buildPigeon() {
  const g = new THREE.Group()

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat('#9aa0a8'))
  body.scale.set(1, 0.9, 1.5); body.position.y = 0.14; g.add(body)

  // iridescent neck ring
  const collar = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 6), mat('#3f6f5a'))
  collar.scale.set(1, 0.7, 0.7); collar.position.set(0, 0.2, 0.09); g.add(collar)

  // head group (skull + beak + eyes) so they dip together when pecking
  const head = new THREE.Group(); head.position.set(0, 0.24, 0.15)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), mat('#9aa0a8')); head.add(skull)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 6), mat('#c98a5a'))
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0, 0.09); head.add(beak)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), mat('#1c2026'))
  eyeL.position.set(0.045, 0.02, 0.04); head.add(eyeL)
  const eyeR = eyeL.clone(); eyeR.position.x = -0.045; head.add(eyeR)
  g.add(head)

  // fanned tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.22, 6), mat('#868c95'))
  tail.scale.set(1, 0.28, 1); tail.rotation.x = -1.3; tail.position.set(0, 0.16, -0.24); g.add(tail)

  // wings on shoulder pivots so they flap
  const mkWing = (side) => {
    const piv = new THREE.Group(); piv.position.set(0.05 * side, 0.17, 0)
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat('#868c95'))
    w.scale.set(1.0, 0.12, 0.55); w.position.set(0.12 * side, 0, -0.02); piv.add(w)
    g.add(piv); return piv
  }
  const wingL = mkWing(1), wingR = mkWing(-1)

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false } })
  return { group: g, head, wingL, wingR }
}

const flap = (p, dt, freq, amp) => {
  p.flap += dt * freq
  const a = 0.25 + Math.sin(p.flap) * amp
  p.wingL.rotation.z = a
  p.wingR.rotation.z = -a
}
const fold = (p, dt) => {
  p.wingL.rotation.z += (-0.15 - p.wingL.rotation.z) * (1 - Math.exp(-10 * dt))
  p.wingR.rotation.z += (0.15 - p.wingR.rotation.z) * (1 - Math.exp(-10 * dt))
}

export default function Pigeons({ collidersRef }) {
  const pigeons = useMemo(() => Array.from({ length: COUNT }, () => {
    const lat = HOME[0] + (Math.random() - 0.5) * 2 * SPREAD_DEG
    const lon = HOME[1] + (Math.random() - 0.5) * 2 * SPREAD_DEG
    return {
      ...buildPigeon(),
      pos: latLon(lat, lon, SURF),
      facing: new THREE.Vector3(),
      home: [lat, lon],
      state: 'ground',
      grounded: false,
      peckT: Math.random() * 3,
      stepT: 1 + Math.random() * 3,
      walkDir: new THREE.Vector3(),
      walkUntil: 0,
      flap: Math.random() * 6,
      target: new THREE.Vector3(),
      stateT: 0,
    }
  }), [])

  const snap = (pos) => {
    const up = pos.clone().normalize()
    const rc = new THREE.Raycaster(pos.clone().addScaledVector(up, 10), up.clone().negate(), 0, 40)
    const hits = rc.intersectObject(collidersRef.current, false)
    if (!hits.length) return pos
    let g = hits[0]
    for (const h of hits) if (h.point.length() < g.point.length()) g = h
    return g.point.clone().addScaledVector(up, 0.02)
  }

  useFrame((_, dt) => {
    if (!collidersRef.current) return
    for (const p of pigeons) {
      if (!p.grounded) {
        p.pos = snap(p.pos)
        p.facing.set(0, 1, 0).cross(p.pos.clone().normalize()).normalize()
        p.grounded = true
      }
      const up = p.pos.clone().normalize()

      if (p.state === 'ground') {
        fold(p, dt)
        // scatter if the player is close
        if (p.pos.distanceTo(playerPos) < SCARE) {
          const away = p.pos.clone().sub(playerPos)
          away.sub(up.clone().multiplyScalar(away.dot(up)))
          if (away.lengthSq() < 1e-4) away.copy(p.facing)
          away.normalize()
          p.target.copy(p.pos).addScaledVector(away, 4 + Math.random() * 4).addScaledVector(up, 6 + Math.random() * 4)
          p.state = 'up'; p.stateT = 0; p.head.rotation.x = 0
        } else {
          // peck bob
          p.peckT -= dt
          let peck = 0
          if (p.peckT < 0.45) peck = Math.sin((0.45 - p.peckT) / 0.45 * Math.PI)
          if (p.peckT <= 0) p.peckT = 1.5 + Math.random() * 3
          p.head.rotation.x = peck * 0.8
          // occasional little shuffle
          p.stepT -= dt
          if (p.stepT <= 0) {
            p.stepT = 2 + Math.random() * 4
            const t1 = new THREE.Vector3(0, 1, 0).cross(up).normalize()
            const t2 = up.clone().cross(t1)
            const ang = Math.random() * Math.PI * 2
            p.walkDir.copy(t1).multiplyScalar(Math.cos(ang)).addScaledVector(t2, Math.sin(ang)).normalize()
            p.walkUntil = 0.6
          }
          if (p.walkUntil > 0) {
            p.walkUntil -= dt
            p.pos.addScaledVector(p.walkDir, WALK_SPEED * dt)
            p.pos = snap(p.pos)
            p.facing.lerp(p.walkDir, 1 - Math.exp(-6 * dt)).normalize()
          }
        }
      } else if (p.state === 'up') {
        p.stateT += dt
        flyToward(p, dt, up, FLY_SPEED)
        flap(p, dt, 22, 0.95)
        if (p.stateT > 2.0 + Math.random() * 1.5) {
          const lat = p.home[0] + (Math.random() - 0.5) * 2 * SPREAD_DEG
          const lon = p.home[1] + (Math.random() - 0.5) * 2 * SPREAD_DEG
          p.target.copy(latLon(lat, lon, SURF))
          p.state = 'down'; p.stateT = 0
        }
      } else if (p.state === 'down') {
        p.stateT += dt
        flyToward(p, dt, up, FLY_SPEED * 0.7)
        flap(p, dt, 16, 0.75)
        if (p.pos.distanceTo(p.target) < 0.35) {
          p.pos = snap(p.pos); p.state = 'ground'
        }
      }

      // apply transform: stand along the surface normal, face heading
      p.group.position.copy(p.pos)
      const upN = p.pos.clone().normalize()
      const z = p.facing.clone().sub(upN.clone().multiplyScalar(p.facing.dot(upN)))
      if (z.lengthSq() < 1e-4) continue
      z.normalize()
      const x = new THREE.Vector3().crossVectors(upN, z).normalize()
      p.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, upN, z))
    }
  })

  return <>{pigeons.map((p, i) => <primitive key={i} object={p.group} />)}</>
}

function flyToward(p, dt, up, speed) {
  const to = p.target.clone().sub(p.pos)
  const dist = to.length()
  if (dist < 1e-4) return
  const dir = to.normalize()
  p.pos.addScaledVector(dir, Math.min(speed * dt, dist))
  const h = dir.clone().sub(up.clone().multiplyScalar(dir.dot(up)))
  if (h.lengthSq() > 1e-4) p.facing.lerp(h.normalize(), 1 - Math.exp(-5 * dt)).normalize()
}
