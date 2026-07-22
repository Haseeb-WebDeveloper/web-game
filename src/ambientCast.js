import { latLon, PLANET_R } from './planet.js'

const P = (lat, lon) => latLon(lat, lon, PLANET_R + 0.5)

// The background people. They give no quests — they just make the town feel
// lived-in. Same rigged bodies as the quest cast, so the Messaggera's clips
// retarget onto them the same way.
//
// Only four bodies exist, so each one appears several times in different parts
// of town. Duplicates are spread far apart and given slightly different sizes
// and roam radii, so two copies of the same person are never on screen together
// looking like twins.
//
// The pipeline normalizes every character to 1.75m, so `scale` is where each
// body gets its real size back: Nino is a boy, Assunta is a small nonna.
const BODIES = {
  nino: { glb: '/npc-nino.glb?v=1', scale: 0.80 },
  assunta: { glb: '/npc-assunta.glb?v=1', scale: 0.88 },
  giovanni: { glb: '/npc-giovanni.glb?v=1', scale: 1.00 },
  mia: { glb: '/npc-mia.glb?v=1', scale: 0.97 },
}

// [body, lat, lon, roam radius in world units, size nudge]
const PLACES = [
  ['giovanni', 28, 14, 16, 1.00],
  ['nino', 31, 6, 20, 1.00],
  ['assunta', 34, 92, 12, 1.00],
  ['mia', 40, 168, 18, 1.00],

  ['mia', 29, 2, 16, 0.98],
  ['giovanni', 36, 84, 14, 1.03],
  ['nino', 38, 165, 18, 1.06],
  ['assunta', -36, 48, 12, 0.97],

  ['giovanni', -40, 132, 16, 0.97],
  ['mia', -33, 41, 20, 1.02],
  ['nino', 33, 97, 14, 0.94],
  ['assunta', 27, 12, 12, 1.02],
]

export const AMBIENT_CAST = PLACES.map(([body, lat, lon, roam, sizeNudge], i) => ({
  id: `${body}-${i}`,
  glb: BODIES[body].glb,
  scale: BODIES[body].scale * sizeNudge,
  pos: P(lat, lon),
  roam,
}))
