import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOTES } from './questData.js'
import { useQuest } from './questStore.js'
import { TOON_GRADIENT } from './World.jsx'

// The 12 olfactory notes as tiny 3D ingredients — each one modelled from
// primitives (fruit, flower, sprig, berries...), toon-shaded like the world,
// bobbing and spinning with a soft halo so they still read as pickups.

function Mat({ color, glow = 0.25 }) {
  return (
    <meshToonMaterial
      color={color}
      gradientMap={TOON_GRADIENT}
      emissive={color}
      emissiveIntensity={glow}
    />
  )
}

// a citrus fruit with a stem and two leaves (bergamot, neroli)
function Citrus({ color }) {
  return (
    <group>
      <mesh><sphereGeometry args={[0.26, 14, 12]} /><Mat color={color} /></mesh>
      <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.025, 0.035, 0.12, 6]} /><Mat color="#5d8a3c" glow={0.1} /></mesh>
      <mesh position={[0.1, 0.31, 0]} rotation={[0, 0, -0.6]} scale={[0.16, 0.05, 0.09]}>
        <sphereGeometry args={[1, 8, 6]} /><Mat color="#5d8a3c" glow={0.1} />
      </mesh>
      <mesh position={[-0.09, 0.33, 0.03]} rotation={[0, 0.8, 0.6]} scale={[0.14, 0.045, 0.08]}>
        <sphereGeometry args={[1, 8, 6]} /><Mat color="#6d9a48" glow={0.1} />
      </mesh>
    </group>
  )
}

// a hanging bunch of berries (blackcurrant, grape)
const BERRY_AT = [[0, 0.1, 0], [0.11, 0.02, 0.04], [-0.11, 0.02, -0.03],
  [0.01, -0.02, -0.11], [-0.02, -0.01, 0.11], [0.06, -0.12, 0.02], [-0.06, -0.13, -0.02], [0, -0.22, 0]]
function Berries({ color }) {
  return (
    <group>
      {BERRY_AT.map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.095, 10, 8]} /><Mat color={color} /></mesh>
      ))}
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 5]} /><Mat color="#7a5a34" glow={0.1} />
      </mesh>
    </group>
  )
}

// a simple open flower: ring of petals + centre (lily, orangeblossom, chamomile)
function Flower({ petal, center, petals = 6 }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]}><sphereGeometry args={[0.11, 10, 8]} /><Mat color={center} glow={0.45} /></mesh>
      {Array.from({ length: petals }, (_, i) => {
        const a = (i / petals) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18]}
            rotation={[0.25 * Math.sin(a), -a, 0.25 * Math.cos(a)]}
            scale={[0.15, 0.04, 0.1]}>
            <sphereGeometry args={[1, 8, 6]} /><Mat color={petal} />
          </mesh>
        )
      })}
      <mesh position={[0, -0.16, 0]}><cylinderGeometry args={[0.02, 0.025, 0.3, 5]} /><Mat color="#5d8a3c" glow={0.1} /></mesh>
    </group>
  )
}

// a rose: cupped outer petals around a tight bud
function Rose({ color }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} scale={[0.13, 0.16, 0.13]}><sphereGeometry args={[1, 10, 8]} /><Mat color={color} /></mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14]}
            rotation={[-0.55 * Math.sin(a), -a, -0.55 * Math.cos(a)]}
            scale={[0.13, 0.17, 0.06]}>
            <sphereGeometry args={[1, 8, 6]} /><Mat color={color} />
          </mesh>
        )
      })}
      <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.02, 0.025, 0.34, 5]} /><Mat color="#4e7d3e" glow={0.1} /></mesh>
    </group>
  )
}

// a leafy sprig (cardamom, laurel)
function Sprig({ color }) {
  return (
    <group rotation={[0, 0, 0.3]}>
      <mesh><cylinderGeometry args={[0.018, 0.022, 0.5, 5]} /><Mat color="#6d4c2f" glow={0.1} /></mesh>
      {[[0, 0.16, 0.5], [1, 0.02, -0.5], [0, -0.14, 0.5]].map(([s, y, r], i) => (
        <mesh key={i} position={[s ? -0.12 : 0.12, y, 0]} rotation={[0, s ? 2.6 : 0.5, r]}
          scale={[0.2, 0.05, 0.1]}>
          <sphereGeometry args={[1, 8, 6]} /><Mat color={color} />
        </mesh>
      ))}
    </group>
  )
}

// a few pink peppercorns on a twig
function Peppercorns({ color }) {
  return (
    <group>
      {[[0.08, 0.04, 0], [-0.07, 0.06, 0.05], [0, -0.04, -0.07], [-0.02, -0.08, 0.08]].map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.1, 10, 8]} /><Mat color={color} /></mesh>
      ))}
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 5]} /><Mat color="#7a5a34" glow={0.1} />
      </mesh>
    </group>
  )
}

// a fig: teardrop body with a little neck
function Fig({ color }) {
  return (
    <group>
      <mesh scale={[1, 1.2, 1]}><sphereGeometry args={[0.22, 12, 10]} /><Mat color={color} /></mesh>
      <mesh position={[0, 0.3, 0]}><coneGeometry args={[0.07, 0.16, 8]} /><Mat color="#6d8a4a" glow={0.1} /></mesh>
    </group>
  )
}

const MODELS = {
  bergamot: <Citrus color="#f3d94f" />,
  neroli: <Citrus color="#ff9d3c" />,
  blackcurrant: <Berries color="#41284f" />,
  grape: <Berries color="#7b4ea3" />,
  lily: <Flower petal="#ffd7e8" center="#e8b84a" />,
  orangeblossom: <Flower petal="#fff6ee" center="#ffb62e" petals={5} />,
  chamomile: <Flower petal="#ffffff" center="#f4c430" petals={8} />,
  rose: <Rose color="#d8455f" />,
  cardamom: <Sprig color="#7bb661" />,
  laurel: <Sprig color="#4e7d3e" />,
  pinkpepper: <Peppercorns color="#e2637a" />,
  fig: <Fig color="#6e4f8a" />,
}

export default function Collectibles() {
  const st = useQuest()
  const refs = useRef({})

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (const n of NOTES) {
      const g = refs.current[n.id]
      if (!g) continue
      const up = n.pos.clone().normalize()
      const bob = Math.sin(t * 2.2 + n.pos.x) * 0.15
      g.position.copy(up.multiplyScalar(n.pos.length() + 0.9 + bob))
      // stand upright on the sphere, then spin in place
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.pos.clone().normalize())
      g.rotateY(t * 1.6)
    }
  })

  return NOTES.filter((n) => !st.collected.includes(n.id)).map((n) => (
    <group key={n.id} ref={(el) => (refs.current[n.id] = el)}>
      {MODELS[n.id]}
      {/* soft golden halo keeps them readable as pickups from afar */}
      <mesh>
        <sphereGeometry args={[0.48, 14, 10]} />
        <meshBasicMaterial color="#ffe9a0" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  ))
}
