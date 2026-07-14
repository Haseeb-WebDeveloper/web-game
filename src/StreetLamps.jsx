import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useQuest } from './questStore.js'
import { PLANET_URL } from './World.jsx'

// Soft radial "light pool" texture, generated once — the cheap trick that sells
// dozens of lit lamps without dozens of real dynamic lights.
const POOL_TEX = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()

// A warm circle of light on the ground, tangent to the planet surface.
export function LightPool({ pos, radius = 3.2, opacity = 0.7 }) {
  const { p, q } = useMemo(() => {
    const up = pos.clone().normalize()
    return {
      p: up.clone().multiplyScalar(pos.length() + 0.07),
      q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up),
    }
  }, [pos])
  return (
    <mesh position={p} quaternion={q}>
      <circleGeometry args={[radius, 24]} />
      <meshBasicMaterial
        map={POOL_TEX} color="#ffbe5e" transparent opacity={opacity}
        blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </mesh>
  )
}

// Every street lamp in the city comes alive at dusk: glowing lantern glass +
// a pool of warm light on the pavement below.
export default function StreetLamps() {
  const st = useQuest()
  const { scene } = useGLTF(PLANET_URL)

  const lamps = useMemo(() => {
    scene.updateMatrixWorld(true)
    const list = []
    // Multi-material lamps load as a GROUP named 'Lamp_N' whose child meshes
    // carry Blender mesh-data names — match the group, find glass by material.
    scene.traverse((o) => {
      if (!/^Lamp_\d+$/.test(o.name)) return
      o.traverse((c) => {
        if (!c.isMesh || !/LampGlow/i.test(c.material?.name || '')) return
        const p = new THREE.Vector3()
        c.getWorldPosition(p)
        list.push({ mesh: c, base: p })
      })
    })
    return list
  }, [scene])

  const on = st.dusk
  for (const l of lamps) {
    const mat = l.mesh.material
    if (mat && mat.emissive) {
      mat.emissive.set(on ? '#ffca6a' : '#000000')
      mat.emissiveIntensity = on ? 1.6 : 0
      mat.color.set(on ? '#ffe2a4' : '#f2e3c0')
    }
  }

  if (!on) return null
  return lamps.map((l, i) => <LightPool key={i} pos={l.base} />)
}
