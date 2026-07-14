import { useEffect, useState } from 'react'
import { useQuest, advance, dialogueQuestId, isDialogueActive, dismissCard, getOutroLines, endEnding, unlockedLooks, cycleLook } from './questStore.js'
import { QUESTS, QUEST_INDEX, CARDS, NOTES, EGG } from './questData.js'
import { setMuted, isMuted, initAudioOnGesture } from './audio.js'
import { STR, LANG, fill, switchLang } from './i18n.js'

// Compose the Instagram-story share card from the live game frame
function makeShareCard(collectedCount) {
  const glCanvas = document.querySelector('canvas')
  const c = document.createElement('canvas')
  c.width = 1080; c.height = 1920
  const x = c.getContext('2d')
  const grad = x.createLinearGradient(0, 0, 0, 1920)
  grad.addColorStop(0, '#5a6aa0'); grad.addColorStop(1, '#f0b48a')
  x.fillStyle = grad; x.fillRect(0, 0, 1080, 1920)
  if (glCanvas) {
    const s = Math.max(980 / glCanvas.width, 1200 / glCanvas.height)
    const w = glCanvas.width * s, h = glCanvas.height * s
    x.save()
    x.beginPath(); x.roundRect(50, 280, 980, 1200, 40); x.clip()
    x.drawImage(glCanvas, 50 + (980 - w) / 2, 280 + (1200 - h) / 2, w, h)
    x.restore()
    x.lineWidth = 10; x.strokeStyle = '#1c1c1c'
    x.beginPath(); x.roundRect(50, 280, 980, 1200, 40); x.stroke()
  }
  x.fillStyle = '#fff'; x.textAlign = 'center'
  x.font = '62px Bungee, sans-serif'
  x.fillText(STR.ui.shareTitle, 540, 170)
  x.font = '46px "Patrick Hand", sans-serif'
  x.fillText(fill(STR.ui.shareStats, { n: collectedCount }), 540, 1580)
  x.font = '54px "Patrick Hand", sans-serif'
  x.fillText(STR.ui.shareQuestion1, 540, 1710)
  x.fillText(STR.ui.shareQuestion2, 540, 1780)
  return c.toDataURL('image/png')
}

export default function HUD() {
  const st = useQuest()
  const [muted, setMutedState] = useState(isMuted())
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  // build the share card once the ending panel opens
  useEffect(() => {
    if (st.ending === 'panel' && !shareUrl) {
      setTimeout(() => setShareUrl(makeShareCard(st.collected.length)), 300)
    }
  }, [st.ending, shareUrl, st.collected.length])

  // fragrance finder: the perfume whose notes you gathered most
  const counts = {}
  for (const n of NOTES) if (st.collected.includes(n.id)) counts[n.questId] = (counts[n.questId] || 0) + 1
  const recId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'verse'
  const rec = CARDS[recId]
  const toggleMute = () => {
    initAudioOnGesture()
    const m = !muted
    setMuted(m)
    setMutedState(m)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyE') advance()
      if (e.code === 'Space' && isDialogueActive()) advance()
      if (e.code === 'Digit1') advance(0)
      if (e.code === 'Digit2') advance(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // during the scroll intro the IntroOverlay owns the screen
  if (st.intro) return null

  // --- dialogue state ---
  const dq = dialogueQuestId()
  const quest = dq ? QUEST_INDEX[dq] : null
  const qs = dq ? st.q[dq] : null
  let speaker = '', line = '', choice = null
  if (quest && qs) {
    if (qs.phase === 'intro') { speaker = quest.giver.name; line = quest.intro[qs.line] }
    if (qs.phase === 'outro') { speaker = quest.giver.name; line = getOutroLines(quest, qs)[qs.line] }
    if (qs.phase === 'mid') {
      const t = quest.targets[qs.midTarget]
      speaker = t.name || quest.giver.name; line = t.midLines[qs.line]
    }
    if (qs.phase === 'choice') {
      const t = quest.targets[qs.midTarget]
      speaker = t.name || quest.giver.name
      choice = t.choice
    }
  }

  // the Venezia letter monologue overrides normal dialogue rendering
  if (st.egg.phase === 'talk') {
    speaker = STR.ui.messaggera
    line = EGG.lines[st.egg.line]
  }

  // --- interaction prompt ---
  let prompt = null
  if (!dq && st.egg.phase !== 'talk' && st.near) {
    if (st.near.kind === 'egg') {
      prompt = EGG.prompt
    } else {
      const q = QUEST_INDEX[st.near.questId]
      const s = st.q[st.near.questId]
      if (st.near.kind === 'giver') {
        prompt = s.phase === 'available' ? STR.ui.talk : fill(STR.ui.deliver, { perfume: q.perfume })
      } else {
        prompt = q.targets[st.near.idx].prompt
      }
    }
  }

  // --- carrying indicator: quests in task phase with a carryLabel and some progress context ---
  const carrying = QUESTS.filter((q) => {
    const s = st.q[q.id]
    return q.carryLabel && s.phase === 'task' && s.progress.length > 0 && s.progress.length <= q.targets.length
  }).map((q) => {
    const s = st.q[q.id]
    const n = s.progress.length, total = q.targets.length
    return total > 1 ? `${q.carryLabel} ${n}/${total}` : q.carryLabel
  })

  const doneCount = QUESTS.filter((q) => st.q[q.id].phase === 'done').length

  return (
    <>
      {/* Delivery checklist */}
      <div className="checklist">
        <div className="checklist-title">{STR.ui.checklist} · {doneCount}/5</div>
        {QUESTS.map((q) => {
          const s = st.q[q.id]
          const done = s.phase === 'done'
          const active = ['intro', 'task', 'mid', 'choice', 'outro'].includes(s.phase)
          return (
            <div key={q.id}>
              <div className={done ? 'quest done' : 'quest'}>
                {done ? '✓' : active ? '➤' : '○'} {q.title}
              </div>
              {s.phase === 'task' && (
                <div className="objective">
                  → {q.objective}
                  {q.targets.length > 1 && ` (${s.progress.length}/${q.targets.length})`}
                  {s.progress.length === q.targets.length && STR.ui.objectiveReturn}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {carrying.length > 0 && (
        <div className="carrying">{carrying.join(' · ')}</div>
      )}

      {prompt && <button className="prompt" onClick={() => advance()}>{prompt}</button>}

      {/* Speech bubble */}
      {line && (
        <div className="bubble" onClick={() => advance()}>
          <div className="speaker">{speaker}</div>
          <div className="line">{line}</div>
          <div className="continue">{STR.ui.continue}</div>
        </div>
      )}

      {/* The only choice in the game */}
      {choice && (
        <div className="bubble">
          <div className="speaker">{speaker}</div>
          <div className="line">{choice.prompt}</div>
          <div className="choices">
            {choice.options.map((opt, i) => (
              <button key={i} onClick={() => advance(i)}>
                <span className="choice-key">{i + 1}</span> {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fragrance card — the product moment, after the bloom fades */}
      {st.card && CARDS[st.card] && (
        <div className="fragrance-card">
          <button className="card-close" onClick={dismissCard}>×</button>
          <div className="card-flacon">🧴</div>
          <div className="card-name">{CARDS[st.card].bottle}</div>
          <div className="card-story">{CARDS[st.card].story}</div>
          <div className="card-pyramid">
            <div><span>{STR.ui.top}</span> {CARDS[st.card].notes.top.join(' · ')}</div>
            <div><span>{STR.ui.heart}</span> {CARDS[st.card].notes.heart.join(' · ')}</div>
            <div><span>{STR.ui.base}</span> {CARDS[st.card].notes.base.join(' · ')}</div>
          </div>
          <a
            className="card-cta"
            href={CARDS[st.card].url}
            target="_blank"
            rel="noreferrer"
            onClick={() => { try { window.dataLayer.push({ event: 'card_click', quest: st.card }) } catch {} }}
          >
            {STR.ui.cta}
          </a>
        </div>
      )}

      {/* The moment blooms */}
      {st.bloom && (
        <div className="moment">
          <div className="moment-glow" />
          <div className="moment-text">
            {st.bloom.text}
            <br />
            <strong>{st.bloom.perfume}</strong> — {STR.ui.delivered}
          </div>
        </div>
      )}

      {/* ENDING: the question during the flyover */}
      {st.ending === 'flyover' && (
        <div className="ending-question">
          {STR.ui.endingQuestion1}<br />{STR.ui.endingQuestion2}
          {STR.ui.endingQuestionSub && <span>{STR.ui.endingQuestionSub}</span>}
        </div>
      )}

      {/* ENDING: the finale panel */}
      {st.ending === 'panel' && (
        <div className="ending-panel">
          <div className="ending-title">{STR.ui.endingTitle}</div>
          {shareUrl ? (
            <a href={shareUrl} download="roma-in-un-respiro.png"
               onClick={() => { try { window.dataLayer.push({ event: 'share_download' }) } catch {} }}>
              <img className="share-preview" src={shareUrl} alt="share card" />
              <div className="share-hint">{STR.ui.saveCard}</div>
            </a>
          ) : (
            <div className="share-hint">{STR.ui.creatingCard}</div>
          )}
          {rec && (
            <div className="ending-rec">
              <div className="ending-rec-label">{STR.ui.recLabel}</div>
              <div className="ending-rec-name">{rec.bottle}</div>
              <a className="card-cta" href={rec.url} target="_blank" rel="noreferrer"
                 onClick={() => { try { window.dataLayer.push({ event: 'finder_click', perfume: recId }) } catch {} }}>
                {STR.ui.cta}
              </a>
            </div>
          )}
          {!subscribed ? (
            <div className="ending-news">
              <input
                type="email" placeholder={STR.ui.newsPlaceholder}
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <button onClick={() => {
                if (!email.includes('@')) return
                setSubscribed(true)
                try { window.dataLayer.push({ event: 'newsletter_signup' }) } catch {}
              }}>{STR.ui.newsButton}</button>
            </div>
          ) : (
            <div className="share-hint">{STR.ui.newsThanks}</div>
          )}
          <button className="ending-continue" onClick={endEnding}>{STR.ui.backToRome}</button>
        </div>
      )}

      <div id="quest-arrow" className="guide-arrow" style={{ display: 'none' }}>
        <span className="arr">➤</span>
        <span className="dist"></span>
      </div>

      <button className="mute-btn" onClick={toggleMute} title={muted ? 'unmute' : 'mute'}>
        {muted ? (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 5L6.5 9H3v6h3.5L11 19V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 5L6.5 9H3v6h3.5L11 19V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18.2 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <button className="lang-toggle" onClick={switchLang} title="language" aria-label="switch language">
        <span className={LANG === 'it' ? 'lt-opt active' : 'lt-opt'}>IT</span>
        <span className={LANG === 'en' ? 'lt-opt active' : 'lt-opt'}>EN</span>
        <span className="lt-knob" style={{ left: LANG === 'it' ? 2 : 36 }} />
      </button>
      <button className="diary-btn" onClick={() => setDiaryOpen(!diaryOpen)} title="olfactory diary">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5.5C10.5 4.2 8.4 3.5 6 3.5H3.5v14H6c2.4 0 4.5.7 6 2 1.5-1.3 3.6-2 6-2h2.5v-14H18c-2.4 0-4.5.7-6 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5.5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6.5 8.5c1.4.1 2.7.5 3.5 1M6.5 12c1.4.1 2.7.5 3.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="diary-count">{st.collected.length}/{NOTES.length}</span>
      </button>
      {/* wardrobe button disabled until the new character's outfit looks are remade
      {unlockedLooks() > 0 && (
        <button className="look-btn" onClick={cycleLook} title="wardrobe">
          👗 <span className="diary-count">{STR.ui.looks[st.look]}</span>
        </button>
      )} */}

      {/* pickup toast */}
      {st.toast && <div className="toast">{st.toast}</div>}

      {/* Olfactory diary */}
      {diaryOpen && (
        <div className="diary">
          <div className="diary-title">{STR.ui.diaryTitle} · {st.collected.length}/{NOTES.length}</div>
          {QUESTS.map((q) => {
            const set = NOTES.filter((n) => n.questId === q.id)
            if (set.length === 0) return null
            return (
              <div key={q.id} className="diary-row">
                <div className="diary-perfume">{CARDS[q.id]?.bottle || q.perfume}</div>
                <div className="diary-notes">
                  {set.map((n) => (
                    <span key={n.id} className={st.collected.includes(n.id) ? 'note got' : 'note'}>
                      {n.icon} {n.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="diary-hint">{STR.ui.diaryHint}</div>
        </div>
      )}
    </>
  )
}
