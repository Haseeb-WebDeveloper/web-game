import * as THREE from 'three'

// How far above the character we start the downward probe. Must be well under
// roof height so a building overhead can never be mistaken for the street, but
// tall enough to clear a kerb or a step the character is walking onto.
const PROBE_UP = 1.5
const PROBE_LEN = 8

const _rc = new THREE.Raycaster()

// Snap a point onto the street surface it is standing on.
//
// Paved areas are TWO stacked surfaces: the tiles, and the terrain sphere that
// runs underneath them. Picking the hit nearest the planet centre lands the feet
// on the terrain and buries them by the tile thickness — which is why grass
// looked right and cobbles didn't. So we take the TOPMOST hit instead, and keep
// roofs out of the running by starting the probe below them rather than above.
export function snapToGround(pos, colliders) {
  if (!colliders) return pos
  const up = pos.clone().normalize()
  _rc.set(pos.clone().addScaledVector(up, PROBE_UP), up.clone().negate())
  _rc.near = 0
  _rc.far = PROBE_LEN
  const hits = _rc.intersectObject(colliders, false)
  return hits.length ? hits[0].point.clone() : pos   // hits are sorted nearest-first
}
