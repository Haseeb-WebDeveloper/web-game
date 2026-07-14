import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLANET_R } from './planet.js'
import { questStore } from './questStore.js'

// When the ending starts, the camera leaves her shoulder and rises to space,
// slowly drifting around the planet with every lit-up moment visible below.
export default function EndingCamera() {
  const { camera } = useThree()
  const st = useRef({ t: 0 })

  useFrame((_, dt) => {
    const ending = questStore.get().ending
    if (!ending) { st.current.t = 0; return }
    st.current.t += dt
    const ang = st.current.t * 0.045
    const target = new THREE.Vector3(Math.cos(ang), 0.5, Math.sin(ang))
      .normalize()
      .multiplyScalar(PLANET_R + 120)
    camera.position.lerp(target, 1 - Math.exp(-0.6 * dt))
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0, 0)
  })

  return null
}
