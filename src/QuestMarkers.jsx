import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuest, activeBeacons } from './questStore.js'

// The beam floats ABOVE head height so its translucent glow never washes
// over the NPC standing at the target — it points at them, not through them.
const BEAM_BOTTOM = 2 
const BEAM_TOP = 13
const BEAM_HEIGHT = BEAM_TOP - BEAM_BOTTOM

function Beacon({ pos }) {
  const diamond = useRef()
  const up = pos.clone().normalize()
  const groundR = pos.length()
  const beamPos = up.clone().multiplyScalar(groundR + BEAM_BOTTOM + BEAM_HEIGHT / 2)
  const beamQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)

  useFrame(({ clock }) => {
    if (!diamond.current) return
    const bob = Math.sin(clock.elapsedTime * 2.5) * 0.3
    diamond.current.position.copy(up.clone().multiplyScalar(groundR + 4.5 + bob))
    diamond.current.rotation.y = clock.elapsedTime * 1.5
  })

  return (
    <>
      <mesh ref={diamond}>
        <octahedronGeometry args={[0.45]} />
        <meshStandardMaterial color="#f5c542" emissive="#c89020" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={beamPos} quaternion={beamQuat}>
        <cylinderGeometry args={[0.3, 0.55, BEAM_HEIGHT, 16, 1, true]} />
        <meshBasicMaterial color="#ffd875" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

export default function QuestMarkers() {
  useQuest() // re-render when quest state changes
  const beacons = activeBeacons()
  return beacons.map((b, i) => <Beacon key={`${b.questId}-${i}-${beacons.length}`} pos={b.pos} />)
}
