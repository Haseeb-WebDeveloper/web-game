import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { questStore } from './questStore.js'

// Day and dusk lighting states — the world's one global lighting shift,
// triggered when the florist's lanterns are lit (quest 3, per the brief).
const DAY = {
  sun: new THREE.Color('#fff6e0'), sunI: 1.7,
  hemiSky: new THREE.Color('#d5efe9'), hemiI: 1.15,
  fog: new THREE.Color('#a9ded6'),
  bg: 'linear-gradient(#7fcfc5, #dcf3ef)',   // the reference's painted teal sky
}
const DUSK = {
  sun: new THREE.Color('#ffab68'), sunI: 1.2,
  hemiSky: new THREE.Color('#8b7fae'), hemiI: 0.75,
  fog: new THREE.Color('#d0a8a4'),
  bg: 'linear-gradient(#5a6aa0, #f0b48a)',
}

export default function Atmosphere() {
  const sun = useRef()
  const hemi = useRef()
  const fog = useRef()
  const { gl } = useThree()
  const mix = useRef(0)
  const bgSet = useRef(false)

  useFrame((_, dt) => {
    const target = questStore.get().dusk ? 1 : 0
    const prev = mix.current
    mix.current += (target - prev) * (1 - Math.exp(-0.35 * dt))   // slow, cinematic transition
    const m = mix.current
    if (Math.abs(m - prev) < 1e-5 && Math.abs(m - target) > 1e-4) return

    if (sun.current) {
      sun.current.color.lerpColors(DAY.sun, DUSK.sun, m)
      sun.current.intensity = DAY.sunI + (DUSK.sunI - DAY.sunI) * m
    }
    if (hemi.current) {
      hemi.current.color.lerpColors(DAY.hemiSky, DUSK.hemiSky, m)
      hemi.current.intensity = DAY.hemiI + (DUSK.hemiI - DAY.hemiI) * m
    }
    if (fog.current) fog.current.color.lerpColors(DAY.fog, DUSK.fog, m)

    // swap the CSS sky once the transition passes halfway (with its own CSS fade)
    if (m > 0.5 && !bgSet.current) {
      gl.domElement.style.transition = 'background 12s'
      gl.domElement.style.background = DUSK.bg
      bgSet.current = true
    }
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#bcd6f5', '#8a7a5a', 0.9]} />
      {/* No cast shadows — flat painted light like the reference, and buttery frames */}
      <directionalLight ref={sun} position={[40, 60, 25]} intensity={1.7} color="#fff6e0" />
      <fog ref={fog} attach="fog" args={['#b8d0ec', 160, 440]} />
    </>
  )
}
