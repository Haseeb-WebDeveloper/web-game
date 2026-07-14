import * as THREE from 'three'

export const PLANET_R = 50   // world radius — keep in sync with the Blender build

// A point on the planet: Blender latitude/longitude → three.js coordinates
// (glTF converts Blender's Z-up to three.js Y-up: (x,y,z) → (x,z,-y))
export function latLon(latDeg, lonDeg, radius) {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon)
  ).multiplyScalar(radius)
}
