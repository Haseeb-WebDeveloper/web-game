import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { latLon, PLANET_R } from './planet.js'

function rng(seed) {
  let s = seed
  return () => (s = (s * 16807 + 19) % 2147483647) / 2147483647
}

// Little dark swallows circling the sky in tilted loops, wings flapping.
export default function Birds() {
  const refs = useRef([])

  const birds = useMemo(() => {
    const rand = rng(31)
    const list = []
    for (let i = 0; i < 9; i++) {
      const n = latLon((rand() * 2 - 1) * 55, rand() * 360, 1)
      const u = new THREE.Vector3(0, 0, 1).cross(n).normalize()
      const v = n.clone().cross(u).normalize()
      list.push({
        n, u, v,
        alt: 12 + rand() * 12,
        orbit: 4 + rand() * 7,
        speed: 0.35 + rand() * 0.4,
        phase: rand() * Math.PI * 2,
        flap: 7 + rand() * 4,
        key: i,
      })
    }
    return list
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    birds.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = b.phase + t * b.speed
      const center = b.n.clone().multiplyScalar(PLANET_R + b.alt)
      const pos = center
        .addScaledVector(b.u, Math.cos(a) * b.orbit)
        .addScaledVector(b.v, Math.sin(a) * b.orbit)
      // tangent of the circle = flight direction
      const dir = b.u.clone().multiplyScalar(-Math.sin(a)).addScaledVector(b.v, Math.cos(a)).normalize()
      g.position.copy(pos)
      const up = pos.clone().normalize()
      const x = new THREE.Vector3().crossVectors(up, dir).normalize()
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, dir))
      // flap
      const flap = Math.sin(t * b.flap + b.phase) * 0.7
      if (g.children[0]) g.children[0].rotation.z = 0.4 + flap
      if (g.children[1]) g.children[1].rotation.z = -0.4 - flap
    })
  })

  return birds.map((b, i) => (
    <group key={b.key} ref={(el) => (refs.current[i] = el)}>
      <mesh position={[-0.02, 0, 0]}>
        <planeGeometry args={[0.55, 0.16]} />
        <meshBasicMaterial color="#2a3138" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.02, 0, 0]}>
        <planeGeometry args={[0.55, 0.16]} />
        <meshBasicMaterial color="#2a3138" side={THREE.DoubleSide} />
      </mesh>
    </group>
  ))
}
