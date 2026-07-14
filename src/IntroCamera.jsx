import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLANET_R, latLon } from './planet.js'
import { questStore, introProgress, useQuest } from './questStore.js'

import { spawnGround } from './Player.jsx'

// Where the character starts: the fountain square at latLon(33,85).
const SPAWN_LAT = 33
const SPAWN_LON = 85
const SPAWN_DIR = latLon(SPAWN_LAT, SPAWN_LON, 1)
const SPAWN_UP = SPAWN_DIR.clone()
const SPAWN_FWD = new THREE.Vector3(0, 1, 0).cross(SPAWN_UP).normalize()
// These mirror Player.jsx's camera so the dive lands on its exact pose.
const CAM_BACK = 6.6
const CAM_PITCH = 0.3

// The dive-end pose is computed live from spawnGround.r (the measured pavement
// height), so it matches the in-game camera to the millimetre — no snap.
function spawnPose(cam, look) {
  const pos = SPAWN_DIR.clone().multiplyScalar(spawnGround.r)
  cam.copy(pos)
    .addScaledVector(SPAWN_FWD, -CAM_BACK * Math.cos(CAM_PITCH))
    .addScaledVector(SPAWN_UP, 1.1 + CAM_BACK * Math.sin(CAM_PITCH))
  look.copy(pos)
    .addScaledVector(SPAWN_UP, 0.85)
    .addScaledVector(SPAWN_FWD, 2.6)
}

// Scrolling swings the globe around and zooms in until the camera hovers
// straight above the spawn square; VAPORIZE then descends onto the character.
export default function IntroCamera() {
  const { camera } = useThree()
  // A persistent look point so the dive can ease its gaze from the planet
  // center onto the character instead of snapping.
  const lookAt = useRef(new THREE.Vector3(0, 0, 0))
  const diveCam = useRef(new THREE.Vector3())
  const diveLook = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const intro = questStore.get().intro
    if (!intro) return
    if (intro === 'scroll') {
      // Start far out (small globe) and swing around while zooming in, ending
      // hovering directly ABOVE the spawn square — the dive is then a descent.
      const p = introProgress.v
      const dir = latLon(SPAWN_LAT - 21 * (1 - p), SPAWN_LON - 130 * (1 - p), 1)
      const pos = dir.multiplyScalar(PLANET_R + 170 - 80 * p)
      camera.position.lerp(pos, 1 - Math.exp(-8 * dt))
      camera.up.set(0, 1, 0)
      lookAt.current.set(0, 0, 0)   // pinned to planet center; seeds the dive
      camera.lookAt(0, 0, 0)
    } else {
      // Diving: mostly straight down from above the square onto the exact
      // in-game camera pose BEHIND the character (she's already standing there).
      // We roll `up` from world-up to the local surface normal and ease the look
      // point onto her, so we never arrive upside-down and there's no jump when
      // Player.jsx assumes control (it snaps to this same pose = invisible).
      const a = 1 - Math.exp(-1.9 * dt)
      spawnPose(diveCam.current, diveLook.current)
      camera.position.lerp(diveCam.current, a)
      camera.up.lerp(SPAWN_UP, a).normalize()
      lookAt.current.lerp(diveLook.current, a)
      camera.lookAt(lookAt.current)
    }
  })

  return <GoldBurst />
}

// Golden perfume droplets swirling around the landing spot during the dive
function GoldBurst() {
  const st = useQuest()
  const ref = useRef()

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 320
    const arr = new Float32Array(n * 3)
    const center = SPAWN_DIR.clone().multiplyScalar(PLANET_R + 4)
    for (let i = 0; i < n; i++) {
      arr[i * 3 + 0] = center.x + (Math.random() - 0.5) * 16
      arr[i * 3 + 1] = center.y + (Math.random() - 0.5) * 16
      arr[i * 3 + 2] = center.z + (Math.random() - 0.5) * 16
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [])

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6
  })

  if (st.intro !== 'diving') return null
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        color="#ffd75e" size={0.35} sizeAttenuation
        transparent opacity={0.9}
        blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </points>
  )
}
