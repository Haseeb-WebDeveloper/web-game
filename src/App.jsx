import { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import InkOutline from './InkOutline.jsx'
import World from './World.jsx'
import Player from './Player.jsx'
import QuestMarkers from './QuestMarkers.jsx'
import GuideArrow from './GuideArrow.jsx'
import Atmosphere from './Atmosphere.jsx'
import Birds from './Birds.jsx'
import BloomFX from './BloomFX.jsx'
import Collectibles from './Collectibles.jsx'
import EndingCamera from './EndingCamera.jsx'
import IntroCamera from './IntroCamera.jsx'
import IntroOverlay from './IntroOverlay.jsx'
import NPCs from './NPCs.jsx'
import Dogs from './Dogs.jsx'
import Cats from './Cats.jsx'
import Pigeons from './Pigeons.jsx'
import Lanterns from './Lanterns.jsx'
import StreetLamps from './StreetLamps.jsx'
import HUD from './HUD.jsx'
import TouchControls from './TouchControls.jsx'

export default function App() {
  // Shared ref: World fills it with collision meshes, Player raycasts against them
  const collidersRef = useRef([])
  // Render at the display's REAL pixel density (crisp), cap 2 for perf.
  // Adaptive: back off slightly on weak devices, but never below 1 — pixelation reads as broken.
  const maxDpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1.5, 2)
  // Never drop below 1.25 (or the display's max if lower) — a fully-soft frame
  // reads as "blurry game" and is worse than a few lost fps.
  const minDpr = Math.min(1.25, maxDpr)
  const [dpr, setDpr] = useState(maxDpr)

  return (
    <>
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 500 }}
        dpr={dpr}
        gl={{ preserveDrawingBuffer: true }}
        style={{ background: 'linear-gradient(#7fcfc5, #dcf3ef)' }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(minDpr, d - 0.25))}
          onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
        />
        {/* All lighting + fog + the day-to-dusk shift live in Atmosphere */}
        <Atmosphere />
        <Birds />
        <Suspense fallback={null}>
          <World collidersRef={collidersRef} />
          <Player collidersRef={collidersRef} />
          <NPCs collidersRef={collidersRef} />
          <Dogs collidersRef={collidersRef} />
          <Cats collidersRef={collidersRef} />
          <Pigeons collidersRef={collidersRef} />
          <Collectibles />
          <Lanterns />
          <StreetLamps />
          <BloomFX />
          <IntroCamera />
          <EndingCamera />
          <QuestMarkers />
          <GuideArrow />
        </Suspense>
        <EffectComposer multisampling={8}>
          <InkOutline strength={1.0} color="#1a1a1a" />
          <Bloom mipmapBlur intensity={0.15} luminanceThreshold={0.95} />
          <Vignette eskil={false} offset={0.12} darkness={0.45} />
        </EffectComposer>
      </Canvas>
      <HUD />
      <TouchControls />
      <IntroOverlay />
      <Loader />
    </>
  )
}

// Loading screen — everything preloads behind it, then the game starts clean
function Loader() {
  const { progress, active } = useProgress()
  if (!active && progress >= 100) return null
  return (
    <div className="loader">
      <div className="loader-title">ROMA IN UN RESPIRO</div>
      <div className="loader-sub">una consegna alla volta</div>
      <div className="loader-bar"><div style={{ width: `${progress}%` }} /></div>
      <div className="loader-pct">{Math.round(progress)}%</div>
    </div>
  )
}
