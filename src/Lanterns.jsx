import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useQuest } from './questStore.js'
import { PLANET_URL } from './World.jsx'
import { LightPool } from './StreetLamps.jsx'

// The florist's four terrace lanterns (QLantern_0..3 in the world model).
// Each lantern maps 1:1 to a target of the 'flowers' quest: when the player
// lights it, its glass ignites, a REAL point light warms the corner, and a
// pool of light lands on the plaza below.
export default function Lanterns() {
  const st = useQuest()
  const { scene } = useGLTF(PLANET_URL)

  const lanterns = useMemo(() => {
    scene.updateMatrixWorld(true)
    const found = {}
    // NOTE: multi-material objects load as a GROUP named 'QLantern_N' whose
    // child meshes carry Blender's internal mesh-data names — so match the
    // group, then find the glass among its children by MATERIAL name.
    scene.traverse((o) => {
      const m = o.name.match(/^QLantern_(\d+)$/)
      if (!m) return
      o.traverse((c) => {
        if (!c.isMesh || !/QGlass/i.test(c.material?.name || '')) return
        const base = new THREE.Vector3()
        c.getWorldPosition(base)
        const up = base.clone().normalize()
        found[+m[1]] = {
          mesh: c,
          base,
          lightPos: base.clone().addScaledVector(up, 2.7),
        }
      })
    })
    return found
  }, [scene])

  const s = st.q?.flowers
  const lit = !s ? []
    : (s.phase === 'outro' || s.phase === 'done') ? [0, 1, 2, 3]
    : (s.progress || [])

  // drive the glass material (each glTF primitive has its own toon material)
  for (const [i, l] of Object.entries(lanterns)) {
    const on = lit.includes(+i)
    const mat = l.mesh.material
    if (mat && mat.emissive) {
      mat.emissive.set(on ? '#ffbe5e' : '#000000')
      mat.emissiveIntensity = on ? 1.6 : 0
      mat.color.set(on ? '#ffd98f' : '#6b5228')
    }
  }

  return lit.map((i) => lanterns[i] ? (
    <group key={i}>
      <pointLight
        position={lanterns[i].lightPos.toArray()}
        color="#ffc46a" intensity={3.6} distance={14} decay={1.6}
      />
      <LightPool pos={lanterns[i].base} radius={4.4} opacity={0.85} />
    </group>
  ) : null)
}
