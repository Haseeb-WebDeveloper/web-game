import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useQuest } from './questStore.js'
import { QUESTS, QUEST_INDEX } from './questData.js'
import { PLANET_R, latLon } from './planet.js'
import { TOON_GRADIENT } from './World.jsx'

// Everything that celebrates a delivered moment:
// a gold particle burst, a lasting star over each helped person, and —
// once the city warms up to you — the cats come out.
export default function BloomFX() {
  const st = useQuest()
  const doneCount = QUESTS.filter((q) => st.q[q.id].phase === 'done').length

  return (
    <>
      {st.bloom?.questId && (
        <GoldBurst key={st.bloom.questId} center={QUEST_INDEX[st.bloom.questId].giver.pos} />
      )}
      {QUESTS.filter((q) => st.q[q.id].phase === 'done').map((q) => (
        <MomentStar key={q.id} pos={q.giver.pos} />
      ))}
      {doneCount >= 3 && (
        <>
          <Cat lat={33.5} lon={80} color="#c9822f" yaw={0.8} />
          <Cat lat={13} lon={-58} color="#8b8b93" yaw={-1.9} />
        </>
      )}
    </>
  )
}

// Rising golden spray at the giver the instant a moment blooms
function GoldBurst({ center }) {
  const ref = useRef()
  const t = useRef(0)

  const { dirs, geo } = useMemo(() => {
    const n = 180
    const up = center.clone().normalize()
    const dirs = []
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(
        Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5,
      ).normalize().add(up.clone().multiplyScalar(1.7)).normalize()
      dirs.push(d)
      arr[i * 3] = center.x; arr[i * 3 + 1] = center.y; arr[i * 3 + 2] = center.z
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return { dirs, geo: g }
  }, [center])

  useFrame((_, dt) => {
    if (!ref.current) return
    t.current += dt
    const a = ref.current.geometry.attributes.position
    for (let i = 0; i < dirs.length; i++) {
      const s = (1.2 + (i % 6) * 0.45) * t.current
      a.array[i * 3] = center.x + dirs[i].x * s
      a.array[i * 3 + 1] = center.y + dirs[i].y * s
      a.array[i * 3 + 2] = center.z + dirs[i].z * s
    }
    a.needsUpdate = true
    ref.current.material.opacity = Math.max(0, 1 - t.current / 3.6)
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        color="#ffd75e" size={0.22} sizeAttenuation
        transparent opacity={1}
        blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </points>
  )
}

// A small gold star that stays floating over every person you've helped
function MomentStar({ pos }) {
  const ref = useRef()
  const base = useMemo(() => {
    const up = pos.clone().normalize()
    return pos.clone().add(up.multiplyScalar(3.2))
  }, [pos])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    const up = base.clone().normalize()
    ref.current.position.copy(base).add(up.multiplyScalar(Math.sin(t * 1.4) * 0.18))
    ref.current.rotation.y = t * 0.9
  })

  return (
    <mesh ref={ref} position={base}>
      <octahedronGeometry args={[0.24]} />
      <meshBasicMaterial color="#ffd75e" />
    </mesh>
  )
}

// A sitting street cat built from toon primitives, tail always moving
function Cat({ lat, lon, color, yaw }) {
  const tail = useRef()
  const { pos, quat } = useMemo(() => {
    const pos = latLon(lat, lon, PLANET_R + 0.02)
    const up = pos.clone().normalize()
    const quat = new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw))
    return { pos, quat }
  }, [lat, lon, yaw])

  useFrame(({ clock }) => {
    if (tail.current) tail.current.rotation.z = 0.5 + Math.sin(clock.elapsedTime * 2.1) * 0.3
  })

  const mat = <meshToonMaterial color={color} gradientMap={TOON_GRADIENT} />
  return (
    <group position={pos} quaternion={quat}>
      {/* body: a squashed pear, sitting */}
      <mesh position={[0, 0.26, 0]} scale={[0.22, 0.3, 0.26]}>
        <sphereGeometry args={[1, 12, 10]} />
        {mat}
      </mesh>
      {/* head */}
      <mesh position={[0, 0.58, 0.1]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        {mat}
      </mesh>
      {/* ears */}
      <mesh position={[-0.08, 0.72, 0.08]} rotation={[0, 0, 0.25]}>
        <coneGeometry args={[0.05, 0.11, 4]} />
        {mat}
      </mesh>
      <mesh position={[0.08, 0.72, 0.08]} rotation={[0, 0, -0.25]}>
        <coneGeometry args={[0.05, 0.11, 4]} />
        {mat}
      </mesh>
      {/* front paws */}
      <mesh position={[-0.07, 0.08, 0.16]} scale={[0.05, 0.1, 0.06]}>
        <sphereGeometry args={[1, 8, 8]} />
        {mat}
      </mesh>
      <mesh position={[0.07, 0.08, 0.16]} scale={[0.05, 0.1, 0.06]}>
        <sphereGeometry args={[1, 8, 8]} />
        {mat}
      </mesh>
      {/* tail, wagging */}
      <group ref={tail} position={[0.16, 0.14, -0.18]}>
        <mesh position={[0.12, 0.1, 0]} rotation={[0, 0, -0.9]}>
          <cylinderGeometry args={[0.035, 0.05, 0.4, 8]} />
          {mat}
        </mesh>
      </group>
    </group>
  )
}
