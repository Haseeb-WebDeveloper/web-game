import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuest, activeBeacons } from './questStore.js'

// A shaft of light POINTING DOWN at the spot: narrow high up, widening to a
// pool of light on the ground — like a sunbeam landing exactly where to go.
// Additive blending brightens whatever it touches instead of tinting it.
const BEAM_TOP = 13

// soft radial gradient for the ground pool, generated once
const POOL_TEX = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.32)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()

function Beacon({ pos }) {
  const diamond = useRef()
  const pool = useRef()
  const { up, groundR, beamPos, beamQuat, poolPos, poolQuat } = useMemo(() => {
    const up = pos.clone().normalize()
    const groundR = pos.length()
    return {
      up,
      groundR,
      // cone base sits just above the walk surface, apex far overhead
      beamPos: up.clone().multiplyScalar(groundR - 0.3 + BEAM_TOP / 2),
      beamQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up),
      poolPos: up.clone().multiplyScalar(groundR - 0.28),
      poolQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up),
    }
  }, [pos])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (diamond.current) {
      const bob = Math.sin(t * 2.5) * 0.3
      diamond.current.position.copy(up.clone().multiplyScalar(groundR + 4.5 + bob))
      diamond.current.rotation.y = t * 1.5
    }
    if (pool.current) {
      const pulse = 1 + Math.sin(t * 2.5) * 0.12
      pool.current.scale.setScalar(pulse)
    }
  })

  return (
    <>
      <mesh ref={diamond}>
        <octahedronGeometry args={[0.45]} />
        <meshStandardMaterial color="#f5c542" emissive="#c89020" emissiveIntensity={0.6} />
      </mesh>
      {/* downward light shaft: thin at the sky, wide where it lands */}
      <mesh position={beamPos} quaternion={beamQuat}>
        <cylinderGeometry args={[0.25, 1.45, BEAM_TOP, 16, 1, true]} />
        <meshBasicMaterial
          color="#ffd875" transparent opacity={0.18} depthWrite={false}
          blending={THREE.AdditiveBlending} side={THREE.DoubleSide}
        />
      </mesh>
      {/* the pool of light on the ground — the actual "go here" spot */}
      <mesh ref={pool} position={poolPos} quaternion={poolQuat}>
        <circleGeometry args={[1.9, 24]} />
        <meshBasicMaterial
          map={POOL_TEX} color="#ffd875" transparent opacity={0.85}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

export default function QuestMarkers() {
  useQuest() // re-render when quest state changes
  const beacons = activeBeacons()
  return beacons.map((b, i) => <Beacon key={`${b.questId}-${i}-${beacons.length}`} pos={b.pos} />)
}
