import { useSyncExternalStore } from 'react'
import { QUESTS, QUEST_INDEX, NOTES, BONUS_LINES, EGG } from './questData.js'
import { setMusicDusk } from './audio.js'
import { STR, fill } from './i18n.js'

// Per-quest phases: available -> intro -> task -> (mid -> choice)? -> outro -> done
let state = {
  q: Object.fromEntries(QUESTS.map((q) => [q.id, { phase: 'available', line: 0, progress: [], midTarget: null, bonus: false }])),
  near: null,          // { questId, kind: 'giver'|'target', idx } — written by Player each frame
  bloom: null,         // { title, perfume, text } — the "moment blooms" flash
  card: null,          // questId whose fragrance card is showing
  dusk: false,         // flipped by the flowers quest; drives the global lighting shift
  collected: [],       // note ids picked up
  toast: null,         // short pickup message
  egg: { phase: 'hidden', line: 0 },   // the Venezia letter: hidden -> talk -> done
  ending: null,        // null -> 'flyover' -> 'panel'
  intro: 'scroll',     // 'scroll' -> 'diving' -> null (playing)
  look: 0,             // outfit: 0 Classica, 1 Aurea (2 deliveries), 2 Notte (4)
}

// Scroll progress 0..1, written by IntroOverlay, read per-frame by IntroCamera
export const introProgress = { v: 0 }
// Set to performance.now() the moment the loader starts fading out — drives
// the boot reveal (globe zooming in from small, title/scroll sliding in).
export const bootSignal = { at: 0 }

export function startDive() {
  if (state.intro !== 'scroll') return
  questStore.set({ intro: 'diving' })
  try { (window.dataLayer = window.dataLayer || []).push({ event: 'vaporize_click' }) } catch {}
  setTimeout(() => {
    questStore.set({ intro: null })
    try { window.dataLayer.push({ event: 'game_start' }) } catch {}
  }, 2600)
}

const listeners = new Set()
export const questStore = {
  get: () => state,
  set(partial) {
    state = { ...state, ...partial }
    listeners.forEach((l) => l())
  },
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
export function useQuest() {
  return useSyncExternalStore(questStore.subscribe, questStore.get)
}

function setQuest(id, patch) {
  questStore.set({ q: { ...state.q, [id]: { ...state.q[id], ...patch } } })
}

export function isDialogueActive() {
  if (state.egg.phase === 'talk') return true
  return Object.values(state.q).some((s) => ['intro', 'mid', 'choice', 'outro'].includes(s.phase))
}

export function dialogueQuestId() {
  const e = Object.entries(state.q).find(([, s]) => ['intro', 'mid', 'choice', 'outro'].includes(s.phase))
  return e ? e[0] : null
}

// Which world points currently deserve a beacon (marker + beam + arrow)?
export function activeBeacons() {
  const out = []
  for (const quest of QUESTS) {
    const s = state.q[quest.id]
    if (s.phase === 'available') {
      out.push({ pos: quest.giver.pos, questId: quest.id })
    } else if (s.phase === 'task') {
      const allDone = s.progress.length === quest.targets.length
      if (allDone) out.push({ pos: quest.giver.pos, questId: quest.id })
      else quest.targets.forEach((t, i) => {
        if (!s.progress.includes(i)) out.push({ pos: t.pos, questId: quest.id })
      })
    }
  }
  return out
}

// Called by Player every frame with her position
export function updateNear(pos) {
  let best = null
  let bestD = 1e9
  for (const quest of QUESTS) {
    const s = state.q[quest.id]
    const allDone = s.progress.length === quest.targets.length
    if (s.phase === 'available' || (s.phase === 'task' && allDone)) {
      const d = pos.distanceTo(quest.giver.pos)
      if (d < 4.5 && d < bestD) { best = { questId: quest.id, kind: 'giver' }; bestD = d }
    }
    if (s.phase === 'task' && !allDone) {
      quest.targets.forEach((t, i) => {
        if (s.progress.includes(i)) return
        const d = pos.distanceTo(t.pos)
        if (d < 3.5 && d < bestD) { best = { questId: quest.id, kind: 'target', idx: i }; bestD = d }
      })
    }
  }
  // the hidden envelope: only offered when nothing else is nearby
  if (!best && state.egg.phase === 'hidden' && pos.distanceTo(EGG.pos) < 4.0) {
    best = { kind: 'egg' }
  }
  const cur = state.near
  const same = (!best && !cur) ||
    (best && cur && best.questId === cur.questId && best.kind === cur.kind && best.idx === cur.idx)
  if (!same) questStore.set({ near: best })
}

function completeTarget(quest, s, idx) {
  const progress = [...s.progress, idx]
  setQuest(quest.id, { phase: 'task', progress, midTarget: null })
}

function finishQuest(quest) {
  setQuest(quest.id, { phase: 'done' })
  questStore.set({ bloom: { questId: quest.id, title: quest.title, perfume: quest.perfume, text: quest.bloomText } })
  if (quest.onDone === 'dusk') { questStore.set({ dusk: true }); setMusicDusk(true) }
  // the bloom flash fades into the fragrance card
  setTimeout(() => questStore.set({ bloom: null, card: quest.id }), 4200)
  try { (window.dataLayer = window.dataLayer || []).push({ event: 'quest_complete', quest: quest.id }) } catch {}
  // outfit unlocks at 2 and 4 deliveries — announce after the bloom settles
  const done = QUESTS.filter((q) => state.q[q.id].phase === 'done').length
  if (done === 2 || done === 4) {
    const name = STR.ui.looks[done === 2 ? 1 : 2]
    setTimeout(() => {
      questStore.set({ toast: fill(STR.ui.lookUnlocked, { name }) })
      setTimeout(() => questStore.set({ toast: null }), 4200)
      try { window.dataLayer.push({ event: 'look_unlocked', look: name }) } catch {}
    }, 5400)
  }
}

// Outfits unlock with deliveries: 2 done -> Aurea, 4 done -> Notte
export function unlockedLooks() {
  const done = QUESTS.filter((q) => state.q[q.id].phase === 'done').length
  return done >= 4 ? 2 : done >= 2 ? 1 : 0
}

export function cycleLook() {
  questStore.set({ look: (state.look + 1) % (unlockedLooks() + 1) })
}

export function dismissCard() {
  questStore.set({ card: null })
  maybeStartEnding()
}

// When the last delivery's card is dismissed, the camera rises to space
export function maybeStartEnding() {
  const allDone = QUESTS.every((q) => state.q[q.id].phase === 'done')
  if (!allDone || state.ending) return
  questStore.set({ ending: 'flyover' })
  try { (window.dataLayer = window.dataLayer || []).push({ event: 'ending_start' }) } catch {}
  setTimeout(() => {
    if (questStore.get().ending === 'flyover') questStore.set({ ending: 'panel' })
  }, 9000)
}

export function endEnding() {
  questStore.set({ ending: null })
}

// Walk-through note pickup — called by Player each frame
export function collectNear(pos) {
  for (const n of NOTES) {
    if (state.collected.includes(n.id)) continue
    if (pos.distanceTo(n.pos) < 1.8) {
      questStore.set({
        collected: [...state.collected, n.id],
        toast: fill(STR.ui.noteToast, { icon: n.icon, label: n.label }),
      })
      setTimeout(() => questStore.set({ toast: null }), 2600)
      try { (window.dataLayer = window.dataLayer || []).push({ event: 'note_collected', note: n.id }) } catch {}
      return n
    }
  }
  return null
}

// Did the player collect a quest's full set of notes (checked at delivery)?
export function hasFullPyramid(questId) {
  const set = NOTES.filter((n) => n.questId === questId)
  return set.length > 0 && set.every((n) => state.collected.includes(n.id))
}

// Outro lines, including the secret bonus line if the pyramid was completed first
export function getOutroLines(quest, qs) {
  return qs.bonus ? [...quest.outro, BONUS_LINES[quest.id]] : quest.outro
}

// The one interaction verb: E / click / Space advance
export function advance(choiceIndex = null) {
  // the Venezia letter monologue
  if (state.egg.phase === 'talk') {
    if (state.egg.line + 1 < EGG.lines.length) {
      questStore.set({ egg: { phase: 'talk', line: state.egg.line + 1 } })
    } else {
      questStore.set({ egg: { phase: 'done', line: 0 }, toast: STR.ui.eggToast })
      setTimeout(() => questStore.set({ toast: null }), 3200)
      try { (window.dataLayer = window.dataLayer || []).push({ event: 'easter_egg_venezia' }) } catch {}
    }
    return
  }
  if (state.near?.kind === 'egg' && state.egg.phase === 'hidden') {
    questStore.set({ egg: { phase: 'talk', line: 0 } })
    return
  }

  // a dialogue in progress always has priority
  const dq = dialogueQuestId()
  if (dq) {
    const quest = QUEST_INDEX[dq]
    const s = state.q[dq]
    if (s.phase === 'intro') {
      if (s.line + 1 < quest.intro.length) setQuest(dq, { line: s.line + 1 })
      else setQuest(dq, { phase: 'task', line: 0 })
    } else if (s.phase === 'mid') {
      const t = quest.targets[s.midTarget]
      if (s.line + 1 < t.midLines.length) setQuest(dq, { line: s.line + 1 })
      else if (t.choice) setQuest(dq, { phase: 'choice', line: 0 })
      else completeTarget(quest, s, s.midTarget)
    } else if (s.phase === 'choice') {
      if (choiceIndex === null) return // must click an option
      completeTarget(quest, s, s.midTarget)
    } else if (s.phase === 'outro') {
      const lines = getOutroLines(quest, s)
      if (s.line + 1 < lines.length) setQuest(dq, { line: s.line + 1 })
      else finishQuest(quest)
    }
    return
  }

  const near = state.near
  if (!near) return
  const quest = QUEST_INDEX[near.questId]
  const s = state.q[near.questId]

  if (near.kind === 'giver') {
    if (s.phase === 'available') setQuest(quest.id, { phase: 'intro', line: 0 })
    else if (s.phase === 'task' && s.progress.length === quest.targets.length) {
      setQuest(quest.id, { phase: 'outro', line: 0, bonus: hasFullPyramid(quest.id) })
    }
  } else if (near.kind === 'target' && s.phase === 'task') {
    const t = quest.targets[near.idx]
    if (t.midLines) setQuest(quest.id, { phase: 'mid', line: 0, midTarget: near.idx })
    else completeTarget(quest, s, near.idx)
  }
}
