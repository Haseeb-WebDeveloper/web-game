import { latLon, PLANET_R } from './planet.js'
import { STR } from './i18n.js'

const P = (lat, lon) => latLon(lat, lon, PLANET_R + 0.5)

// The five scenes from the brief (LB-3D-GAME-EXPLAINED.md §4).
// ALL text lives in src/copy/{it,en}.json — this file is structure only.
// NOTE: olfactory pyramids are PLACEHOLDERS — real ones are a client blocker (§7).

const UTM = 'utm_source=roma_respiro&utm_medium=game_card&utm_campaign=lb_parfums'

const BOTTLES = {
  morning: { bottle: 'ROMA UOMO', slug: 'roma-uomo' },
  verse: { bottle: 'ROMA', slug: 'roma' },
  flowers: { bottle: 'ROMA FIORI BIANCHI', slug: 'roma-fiori-bianchi' },
  knot: { bottle: 'FOREVER', slug: 'forever' },
  springs: { bottle: 'AQVE ROMANE', slug: 'aqve-romane' },
}

export const CARDS = Object.fromEntries(
  Object.entries(BOTTLES).map(([id, b]) => [id, {
    bottle: b.bottle,
    story: STR.cards[id].story,
    notes: STR.cards[id].notes,
    url: `https://laurabiagiottiparfums.com/${b.slug}?${UTM}`,
  }]),
)

// Every quest runs the same machine:
//   available -> intro (at giver) -> task (visit all targets) -> outro (back at giver) -> done
// 'midLines'/'choice' on a target inserts dialogue at that target (quest 4's note).

const GEO = {
  morning: { giver: P(30, 10), targets: [P(29, -12)] },
  // pages land along the Trastevere street (rows sit at lat -29.5/-40.8 —
  // the open alley band is lat -32..-38.3, keep targets inside it)
  verse: { giver: P(-35, 45), targets: [P(-33.5, 39), P(-36.8, 56), P(-33, 65)] },
  // the four lanterns stand at the terrace-plaza corners (QLantern_0..3 in the
  // world model — Lanterns.jsx lights each one as its target is completed)
  flowers: { giver: P(42, 170), targets: [P(49.5, 160.5), P(49.5, 175.5), P(37.5, 160.5), P(37.5, 175.5)] },
  knot: { giver: P(33, 94), targets: [P(36, 77.5)] },
  springs: { giver: P(-42, 135), targets: [P(-33, 130), P(-33, 135), P(-33, 140)] },
}

function buildQuest(id, extra = {}) {
  const t = STR.quests[id]
  return {
    id,
    title: t.title,
    arrow: t.arrow,
    perfume: BOTTLES[id].bottle,
    bloomText: t.bloom,
    giver: { name: t.giver, pos: GEO[id].giver },
    intro: t.intro,
    outro: t.outro,
    objective: t.objective,
    carryLabel: t.carry,
    targets: GEO[id].targets.map((pos, i) => ({ pos, prompt: t.prompts[i] })),
    ...extra,
  }
}

export const QUESTS = [
  buildQuest('morning'),
  buildQuest('verse'),
  buildQuest('flowers', { onDone: 'dusk' }), // the world's ONE global lighting shift
  buildQuest('knot'),
  buildQuest('springs'),
]

// quest 4's target is a person with dialogue and the game's only choice
QUESTS[3].targets[0] = {
  ...QUESTS[3].targets[0],
  name: STR.quests.knot.targetName,
  midLines: STR.quests.knot.midLines,
  choice: {
    prompt: STR.quests.knot.choicePrompt,
    options: STR.quests.knot.choiceOptions,
  },
}

export const QUEST_INDEX = Object.fromEntries(QUESTS.map((q) => [q.id, q]))

// The 12 collectible olfactory notes (brief §4) — glowing ingredients scattered
// near their perfume's scene. Walk through one to add it to the diary.
const NOTE_GEO = [
  ['bergamot', '🍋', 'morning', 28, 2],
  ['cardamom', '🌿', 'morning', 33, -9],
  ['blackcurrant', '🫐', 'verse', -34.5, 36],
  ['lily', '🌸', 'verse', -36.5, 60.5],
  ['neroli', '🍊', 'flowers', 40, 176],
  ['orangeblossom', '🌼', 'flowers', 36, 167],
  ['pinkpepper', '🌶️', 'knot', 35, 91],
  ['rose', '🌹', 'knot', 30, 88],
  ['chamomile', '🌼', 'springs', -36, 141],
  ['fig', '🍈', 'springs', -38, 129],
  ['grape', '🍇', 'springs', -30, 133],
  ['laurel', '🌿', 'springs', -33, 137],
]
export const NOTES = NOTE_GEO.map(([id, icon, questId, lat, lon]) => ({
  id, icon, questId, label: STR.notes[id], pos: P(lat, lon),
}))

// The hidden sixth envelope (brief §4) — no checklist entry, found at the harbour.
// FLAGGED: needs client approval (references the discontinued Venezia fragrance).
export const EGG = {
  pos: P(5, -120),
  prompt: STR.egg.prompt,
  lines: STR.egg.lines,
}

// Secret bonus lines — spoken only if the perfume's notes were all collected first
export const BONUS_LINES = STR.bonus
