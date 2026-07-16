import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  computeBoundsTree, disposeBoundsTree, acceleratedRaycast,
  StaticGeometryGenerator, MeshBVH,
} from 'three-mesh-bvh'

// Accelerate all raycasts with a BVH (bounding volume hierarchy)
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// One shared URL so every component (World, Lanterns) hits the same GLTF cache
export const PLANET_URL = '/planet.glb?v=46'

// 3-step toon gradient — the reference game's entire lighting model in a few bytes
export const TOON_GRADIENT = (() => {
  const tex = new THREE.DataTexture(
    new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]),
    3, 1, THREE.RGBAFormat
  )
  tex.needsUpdate = true
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
})()

export function toToon(mesh) {
  const old = mesh.material
  if (!old || old.userData?.isToon) return
  const toon = new THREE.MeshToonMaterial({
    color: old.color ? old.color.clone() : new THREE.Color('#ffffff'),
    map: old.map || null,
    gradientMap: TOON_GRADIENT,
    transparent: !!old.transparent,
    opacity: old.opacity ?? 1,
    side: old.side ?? THREE.FrontSide,
  })
  // Anisotropic filtering: without it, textures smear into blur at glancing
  // angles (ground, facades) and on distant characters. Nearly free on GPU.
  if (toon.map) {
    toon.map.anisotropy = 8
    toon.map.needsUpdate = true
  }
  toon.name = old.name || ''   // keep names so outfit looks can find materials
  toon.userData.isToon = true
  mesh.material = toon
}

export default function World({ collidersRef }) {
  const { scene } = useGLTF(PLANET_URL)
  const waterUniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const swayRef = useMemo(() => ({ list: [] }), [])

  useEffect(() => {
    scene.updateMatrixWorld(true)

    // Collect solid meshes — water and foam are visual only, you can wade through them
    const solid = []
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = true

      // LIVING WATER: replace the Tiber's flat material with an animated one —
      // rolling waves (vertex), moving shimmer + drifting foam (fragment)
      if (child.name.includes('Tiber_Water')) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x1e6b7d, roughness: 0.12, metalness: 0.0,
          transparent: true, opacity: 0.92,
        })
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = waterUniforms.uTime
          sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' +
            sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
              vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
              float wave = sin(wp.x * 1.4 + uTime * 1.5) * 0.35
                         + sin(wp.z * 1.8 - uTime * 1.1) * 0.35
                         + sin((wp.x + wp.z) * 0.7 + uTime * 0.6) * 0.3;
              transformed += normal * wave * 0.09;
              vWPos = wp;`)
          sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' +
            sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
              float s1 = sin(vWPos.x * 2.2 + uTime * 1.4) * sin(vWPos.z * 2.6 - uTime * 1.0);
              float s2 = sin((vWPos.x - vWPos.z) * 3.4 + uTime * 1.9);
              float shimmer = s1 * 0.5 + s2 * 0.5;
              diffuseColor.rgb += vec3(0.10, 0.14, 0.15) * shimmer * 0.5;
              float foam = smoothstep(0.82, 0.98, shimmer);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.94, 0.96), foam * 0.4);`)
        }
        child.material = mat
      }

      const matName = child.material?.name || ''
      // Everything except the animated water goes toon — the reference's look
      if (!child.name.includes('Tiber_Water')) toToon(child)

      // Tree canopies sway in the wind (visual only — collision uses a static copy)
      if (/Crown|Canopy|Cypress_|Jasmine|PineCrown/i.test(child.name)) {
        swayRef.list.push({
          mesh: child,
          baseX: child.rotation.x,
          baseZ: child.rotation.z,
          phase: swayRef.list.length * 1.7,
        })
      }
      // Foam is decoration; trim rings are step-over curbs. Water is walkable
      // (it sits sunken in the carved channel, so crossing reads as wading a ford).
      if (matName.includes('Foam')) return
      if (child.name.includes('Trim')) return
      // All water is walkable/wade-through: the river (Tiber_Water) and the
      // fountain basins (FS_Water_*, material Fountain_Water_Pretty).
      if (/Water/i.test(child.name) || /Water/i.test(matName)) return
      solid.push(child)
    })

    // Merge everything into ONE static world-space geometry with a single BVH.
    // The character capsule and the camera both collide against this.
    const generator = new StaticGeometryGenerator(solid)
    generator.attributes = ['position']
    const merged = generator.generate()
    merged.boundsTree = new MeshBVH(merged)

    const colliderMesh = new THREE.Mesh(merged)
    colliderMesh.visible = false
    collidersRef.current = colliderMesh

    return () => {
      merged.dispose()
      collidersRef.current = null
    }
  }, [scene, collidersRef])

  useFrame((_, dt) => {
    waterUniforms.uTime.value += dt
    const t = waterUniforms.uTime.value
    for (const s of swayRef.list) {
      s.mesh.rotation.x = s.baseX + Math.sin(t * 0.9 + s.phase) * 0.016
      s.mesh.rotation.z = s.baseZ + Math.cos(t * 0.7 + s.phase * 1.3) * 0.013
    }
  })

  return <primitive object={scene} />
}

useGLTF.preload(PLANET_URL)
