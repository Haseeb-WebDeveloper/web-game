import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { activeBeacons } from './questStore.js'

// Screen-edge arrow pointing toward the NEAREST active quest beacon when off-screen.
export default function GuideArrow() {
  const tmp = useRef({ v: new THREE.Vector3(), fwd: new THREE.Vector3() })

  useFrame(({ camera }) => {
    const el = document.getElementById('quest-arrow')
    if (!el) return

    const beacons = activeBeacons()
    if (beacons.length === 0) { el.style.display = 'none'; return }
    let pos = beacons[0].pos
    let bd = camera.position.distanceTo(pos)
    for (const b of beacons) {
      const d = camera.position.distanceTo(b.pos)
      if (d < bd) { bd = d; pos = b.pos }
    }

    const { v, fwd } = tmp.current
    camera.getWorldDirection(fwd)
    const behind = pos.clone().sub(camera.position).dot(fwd) < 0
    v.copy(pos).project(camera)
    if (behind) { v.x = -v.x; v.y = -v.y }

    const onScreen = !behind && Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.75
    if (onScreen) { el.style.display = 'none'; return }

    const angle = Math.atan2(v.y, v.x)
    el.style.display = 'flex'
    el.style.left = `${(0.5 + Math.cos(angle) * 0.40) * window.innerWidth}px`
    el.style.top = `${(0.5 - Math.sin(angle) * 0.38) * window.innerHeight}px`
    const arr = el.querySelector('.arr')
    if (arr) arr.style.transform = `rotate(${-angle}rad)`
    const dist = el.querySelector('.dist')
    if (dist) dist.textContent = `${Math.max(1, Math.round(bd))}m`
  })

  return null
}
