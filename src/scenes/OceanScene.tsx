import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Color, FogExp2, MathUtils, Vector2 } from 'three'
import { usePlayerStore, Discovery, DiscoveredMystery } from '../store/usePlayerStore'
import { useWorldStore } from '../store/useWorldStore'
import { getBiomeAt, BIOMES, BiomeType } from '../engine/procedural/biomeGenerator'
import { MysteryInstance } from '../engine/procedural/mysteryGenerator'
import { HUD } from '../components/ui/HUD'
import { DailyEventBanner } from '../components/ui/DailyEventBanner'
import { SonarMinimap } from '../components/ui/SonarMinimap'
import { InvestigationHUD } from '../components/ui/InvestigationHUD'
import { ScanHUD, ScanState } from '../components/ui/ScanHUD'
import { ResearchLog } from '../components/panels/ResearchLog'
import { Encyclopedia } from '../components/panels/Encyclopedia'
import { PhotoMode } from '../components/panels/PhotoMode'
import { CommunityStats } from '../components/panels/CommunityStats'
import { MissionBoard } from '../components/panels/MissionBoard'
import { ResearchBase } from '../components/panels/ResearchBase'
import { Hero } from '../components/ocean3d/Hero'
import { BubbleTrail } from '../components/ocean3d/BubbleTrail'
import { Terrain3D } from '../components/ocean3d/Terrain3D'
import { CreatureManager } from '../components/ocean3d/CreatureManager'
import { MysteryManager } from '../components/ocean3d/MysteryManager'
import { EventCreature3D } from '../components/ocean3d/EventCreature3D'
import { EventObject3D, EventObjectType } from '../components/ocean3d/EventObject3D'
import { UnderwaterAtmosphere } from '../components/ocean3d/UnderwaterAtmosphere'
import { BiomeDecor } from '../components/ocean3d/BiomeDecor'
import { ArtefactManager } from '../components/ocean3d/ArtefactManager'
import { ArtifactPulse3D } from '../components/ocean3d/ArtifactPulse3D'
import { Waypoint3D } from '../components/ocean3d/Waypoint3D'
import { ArtifactSignalHUD } from '../components/ui/ArtifactSignalHUD'
import { GenerationProfilerOverlay } from '../components/ui/GenerationProfilerOverlay'
import { generationProfiler } from '../engine/performance/generationProfiler'
import { frameBudgetQueue } from '../engine/performance/frameBudgetQueue'
import './OceanScene.css'

// ── Pre-allocated colour reusables ────────────────────────────────────────────
const _fogColor  = new Color()
const _targetFog = new Color()

// ── Progressive startup ────────────────────────────────────────────────────────
// Stage changes are driven by animation frames so the first frame contains only
// the controllable submarine. Expensive systems are mounted in later frames.
function useProgressiveStartup() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    let frame = 0
    let raf = 0
    const advance = () => {
      frame++
      if (frame <= 7) setStage(frame)
      if (frame < 7) raf = requestAnimationFrame(advance)
    }
    raf = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(raf)
  }, [])

  return stage
}

function GenerationProfilerHost() {
  useFrame(() => {
    generationProfiler.beginFrame()
    frameBudgetQueue.process()
    const queueStats = frameBudgetQueue.getStats()
    generationProfiler.setQueueStats(queueStats.depth, queueStats.completed, queueStats.yielded)
  }, -100)
  return null
}

function ShaderWarmupProbe({ children }: { children: React.ReactNode }) {
  const mountedAt = performance.now()
  useEffect(() => {
    generationProfiler.record('shaders', performance.now() - mountedAt, 1, 0, 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{children}</>
}

// ── Environment scene with smooth fog transitions ─────────────────────────────
interface EnvSceneProps {
  biome: BiomeType
  startupStage: number
  onScanCreature: (id: string, speciesId: string, name: string, dna: any, wx: number, wy: number, wz: number) => void
  onDiscovery: (d: Discovery) => void
  onInvestigateMystery: (m: MysteryInstance) => void
  discoveredMysteryIds: Set<string>
  onEventObjectInteract: (rp: number, label: string) => void
  onArtefactToast: (msg: string) => void
}

const EnvironmentScene = React.memo(function EnvironmentScene({ biome, startupStage, onScanCreature, onDiscovery, onInvestigateMystery, discoveredMysteryIds, onEventObjectInteract, onArtefactToast }: EnvSceneProps) {
  const { scene } = useThree()
  const biomeConf = BIOMES[biome] || BIOMES.open
  const fogRef    = useRef<FogExp2 | null>(null)
  const dailyEvent = useWorldStore((s) => s.dailyEvent)
  const worldEffect = dailyEvent?.worldEffect

  const lightMult = worldEffect?.lightingMult ?? 1.0

  // Initialise fog once
  useEffect(() => {
    const fog = new FogExp2(biomeConf.fogColor, biomeConf.fogDensity * 0.5)
    scene.fog = fog
    scene.background = new Color(biomeConf.fogColor)
    fogRef.current = fog
  }, []) // eslint-disable-line

  useFrame((state, delta) => {
    if (!fogRef.current) return

    const conf = BIOMES[biome] || BIOMES.open

    // Read depth directly from camera Y (no prop needed)
    const depth = Math.abs(state.camera.position.y)
    const depthMod = MathUtils.clamp(depth / 3000, 0, 1.5)
    const targetDensity = conf.fogDensity * 0.5 * (1 + depthMod * 0.6)

    _targetFog.set(conf.fogColor)
    _fogColor.set(fogRef.current.color.getHex())

    fogRef.current.color.lerp(_targetFog, MathUtils.clamp(1.5 * delta, 0, 1))
    fogRef.current.density = MathUtils.lerp(fogRef.current.density, targetDensity, 1.5 * delta)
    ;(scene.background as Color)?.lerp(_targetFog, MathUtils.clamp(1.5 * delta, 0, 1))
  })

  return (
    <>
      <ambientLight
        intensity={biomeConf.lightIntensity * 0.25 * lightMult}
        color={biomeConf.ambientColor}
      />
      <directionalLight
        position={[80, 300, 60]}
        intensity={biomeConf.lightIntensity * 0.5 * lightMult}
        color={biomeConf.lightColor}
        castShadow={false}
      />
      <directionalLight
        position={[0, -200, -100]}
        intensity={0.08 * lightMult}
        color="#003d6b"
      />
      <hemisphereLight
        args={[biomeConf.lightColor, '#000814', biomeConf.lightIntensity * 0.15 * lightMult]}
      />

      {/* Stage 0: first frame is immediately controllable. */}
      <Hero />
      {startupStage >= 1 && <BubbleTrail />}
      {startupStage >= 1 && <Terrain3D />}
      {startupStage >= 2 && <CreatureManager onScanCreature={onScanCreature} onDiscovery={onDiscovery} />}
      {startupStage >= 3 && <UnderwaterAtmosphere biome={biome} />}
      {startupStage >= 4 && <MysteryManager onInvestigate={onInvestigateMystery} discoveredMysteryIds={discoveredMysteryIds} />}
      {startupStage >= 5 && <ArtefactManager onCollectToast={onArtefactToast} />}
      {startupStage >= 6 && <BiomeDecor biome={biome} />}

      {/* Dynamic event content is intentionally delayed until core control is live. */}
      {startupStage >= 6 && (worldEffect?.spawnOverride === 'leviathan' || worldEffect?.spawnOverride === 'squid') && (
        <EventCreature3D
          type={worldEffect.spawnOverride}
          eventName={dailyEvent.name}
          scanned={false}
          onScan={onScanCreature}
        />
      )}
      {startupStage >= 6 && (worldEffect?.spawnOverride === 'portal' || worldEffect?.spawnOverride === 'crater') && (
        <EventObject3D
          type={worldEffect.spawnOverride as EventObjectType}
          onInteract={(rp) => onEventObjectInteract(rp, dailyEvent.name)}
        />
      )}
      {startupStage >= 6 && dailyEvent?.type === 'awakening' && (
        <EventObject3D
          type="temple"
          onInteract={(rp) => onEventObjectInteract(rp, dailyEvent.name)}
        />
      )}

      {startupStage >= 2 && <ArtifactPulse3D />}
      {startupStage >= 2 && <Waypoint3D />}
    </>
  )
})

// ═════════════════════════════════════════════════════════════════════════════
// Root scene component
// ═════════════════════════════════════════════════════════════════════════════
export default function OceanScene() {
  // Only subscribe to stable / rarely-changing store values
  const addDiscovery            = usePlayerStore(s => s.addDiscovery)
  const addDiscoveredMystery    = usePlayerStore(s => s.addDiscoveredMystery)
  const addResearchPoints       = usePlayerStore(s => s.addResearchPoints)
  const playerName              = usePlayerStore(s => s.playerName)
  const discoveredMysteries     = usePlayerStore(s => s.discoveredMysteries)
  const { setCurrentBiome, dailyEvent }  = useWorldStore()
  const startupStage = useProgressiveStartup()

  const [currentBiome, setLocalBiome]    = useState<BiomeType>('coral')
  const [openPanel, setOpenPanel]        = useState<'log' | 'encyclopedia' | 'photo' | 'stats' | 'missions' | null>(null)
  const [photoMode, setPhotoMode]        = useState(false)
  const [showBase, setShowBase]          = useState(false)
  // Dev-only diagnostics overlays (backtick = R3F stats, P = generation profiler)
  const [showStats, setShowStats]        = useState(false)
  const [showGenerationProfiler, setShowGenerationProfiler] = useState(false)

  // Scan state managed at the top level so ScanHUD can read it
  const [scanState, setScanState]        = useState<ScanState>({ phase: 'idle' })
  const [logToast, setLogToast]          = useState<string | null>(null)

  // Ref to canvas DOM element for PhotoMode
  const canvasDomRef = useRef<HTMLCanvasElement | null>(null)

  // Mystery investigation state
  const [investigatingMystery, setInvestigatingMystery] = useState<MysteryInstance | null>(null)
  const [investigationIsNew, setInvestigationIsNew]     = useState(false)
  const [investigationRP, setInvestigationRP]           = useState(0)

  // Stable set of discovered mystery ids for 3D objects to check
  const discoveredMysteryIds = useMemo(
    () => new Set(discoveredMysteries.map(m => m.id)),
    [discoveredMysteries]
  )

  // Coords/depth are read via refs — updated through a non-rendering subscription
  // so that frequent player movement doesn't trigger React re-renders
  const coordsRef = useRef(usePlayerStore.getState().coords)
  const depthRef  = useRef(usePlayerStore.getState().depth)

  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state) => {
      coordsRef.current = state.coords
      depthRef.current  = state.depth
    })
    return unsub
  }, [])

  // ── Development diagnostic toggles ─────────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === '`') setShowStats(prev => !prev)
      if (e.key.toLowerCase() === 'p') setShowGenerationProfiler(prev => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── B key toggles Research Base ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'b' || e.key === 'B') && !e.repeat) {
        setShowBase(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Stable biome check: interval only started once, reads coords via ref ──
  useEffect(() => {
    let prevBiome: BiomeType = 'coral'
    const id = setInterval(() => {
      const c = coordsRef.current
      const d = depthRef.current
      const b = getBiomeAt(c.x, c.y, d) as BiomeType
      if (b !== prevBiome) {
        prevBiome = b
        setLocalBiome(b)
        setCurrentBiome(b)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [setCurrentBiome]) // setCurrentBiome is stable (Zustand)

  // ── Scan flow ──────────────────────────────────────────────────────────────
  const handleScanCreature = useCallback((
    id: string, speciesId: string, name: string, dna: any,
    wx: number, wy: number, wz: number,
  ) => {
    setScanState({
      phase: 'selected',
      id, speciesId, name, dna,
      wx, wy, wz,
    })
  }, [])

  const handleScanStart = useCallback(() => {
    setScanState(prev => prev.phase === 'selected' ? { ...prev, phase: 'scanning', progress: 0 } : prev)
  }, [])

  const handleScanComplete = useCallback((d: Discovery) => {
    addDiscovery(d)
    setScanState(prev => ({ ...prev, phase: 'result', discovery: d }))
    // Small toast notification
    setLogToast('New species added to Research Log')
    setTimeout(() => setLogToast(null), 4000)
  }, [addDiscovery])

  const handleScanDismiss = useCallback(() => {
    setScanState({ phase: 'idle' })
  }, [])

  const handleDiscovery = useCallback((d: Discovery) => {
    // Legacy path kept for compatibility – routes through same store call
    addDiscovery(d)
  }, [addDiscovery])

  // ── Mystery investigation flow ────────────────────────────────────────────
  const handleInvestigateMystery = useCallback((m: MysteryInstance) => {
    const isNew = !discoveredMysteries.some(d => d.id === m.id)
    const rpReward = m.def.rpReward
    setInvestigatingMystery(m)
    setInvestigationIsNew(isNew)
    setInvestigationRP(rpReward)
  }, [discoveredMysteries])

  const handleInvestigationClose = useCallback(() => {
    if (investigatingMystery) {
      const coords = usePlayerStore.getState().coords
      const depth  = usePlayerStore.getState().depth
      const dm: DiscoveredMystery = {
        id: investigatingMystery.id,
        type: investigatingMystery.def.type,
        name: investigatingMystery.def.name,
        timestamp: Date.now(),
        depth,
        coords,
        artifactCollected: !!investigatingMystery.def.artifactName && investigationIsNew,
      }
      addDiscoveredMystery(dm)
      if (investigationIsNew) addResearchPoints(investigationRP)
      setLogToast(`Mystery logged: ${investigatingMystery.def.name}`)
      setTimeout(() => setLogToast(null), 4000)
    }
    setInvestigatingMystery(null)
  }, [investigatingMystery, investigationIsNew, investigationRP, addDiscoveredMystery, addResearchPoints])

  // ── Event Object Interaction (portal/crater/temple RP reward) ────────────
  const eventObjectInteractedRef = useRef(false)
  const handleEventObjectInteract = useCallback((rp: number, label: string) => {
    // One-time RP reward per event
    if (eventObjectInteractedRef.current) return
    eventObjectInteractedRef.current = true
    addResearchPoints(rp)
    setLogToast(`✨ ${label} — +${rp} RP`)
    setTimeout(() => setLogToast(null), 5000)
  }, [addResearchPoints])

  return (
    <div className="ocean-root">
      <Canvas
        ref={(el) => {
          if (el) canvasDomRef.current = el
        }}
        camera={{ position: [0, -20, 42], fov: 62 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          preserveDrawingBuffer: true,
        }}
        dpr={[1, 1.5]}
        frameloop="always"
      >
        <GenerationProfilerHost />
        <EnvironmentScene
          biome={currentBiome}
          startupStage={startupStage}
          onScanCreature={handleScanCreature}
          onDiscovery={handleDiscovery}
          onInvestigateMystery={handleInvestigateMystery}
          discoveredMysteryIds={discoveredMysteryIds}
          onEventObjectInteract={handleEventObjectInteract}
          onArtefactToast={(msg) => {
            setLogToast(msg)
            setTimeout(() => setLogToast(null), 5000)
          }}
        />

        {/* ── Dev FPS Stats (backtick to toggle) ─────────────────────── */}
        {import.meta.env.DEV && showStats && <Stats />}

        {/* Compile post-processing only after the playable world is visible. */}
        {startupStage >= 7 && (
          <ShaderWarmupProbe>
            <EffectComposer multisampling={0} enableNormalPass={false}>
              <Bloom
                luminanceThreshold={0.45}
                luminanceSmoothing={0.85}
                intensity={1.8}
                mipmapBlur
                radius={0.6}
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={new Vector2(0.0005, 0.0005)}
                radialModulation={false}
                modulationOffset={0}
              />
              <Vignette offset={0.25} darkness={0.7} eskil={false} />
            </EffectComposer>
          </ShaderWarmupProbe>
        )}
      </Canvas>

      {import.meta.env.DEV && showGenerationProfiler && <GenerationProfilerOverlay />}

      {/* ── Cockpit overlay ─────────────────────────────────────────────── */}
      <div className="cockpit-frame" id="cockpit-frame" />

      {!photoMode && (
        <>
          <HUD
            onOpenLog={() => setOpenPanel('log')}
            onOpenEncyclopedia={() => setOpenPanel('encyclopedia')}
            onOpenStats={() => setOpenPanel('stats')}
            onOpenMissions={() => setOpenPanel('missions')}
            onPhotoMode={() => setPhotoMode(true)}
            onOpenBase={() => setShowBase(true)}
            currentBiome={currentBiome}
          />
          <DailyEventBanner event={dailyEvent} />
          <SonarMinimap />
          <ArtifactSignalHUD />
        </>
      )}

      {/* Scan HUD – always rendered so it can track scan progress */}
      <ScanHUD
        scanState={scanState}
        playerName={playerName}
        onScanStart={handleScanStart}
        onScanComplete={handleScanComplete}
        onDismiss={handleScanDismiss}
      />

      {/* Log toast */}
      {logToast && (
        <div className="log-toast" id="log-toast">
          <span>🔬</span> {logToast}
        </div>
      )}

      {photoMode && (
        <PhotoMode
          canvasRef={canvasDomRef}
          onClose={() => setPhotoMode(false)}
        />
      )}

      {openPanel === 'log'          && <ResearchLog    onClose={() => setOpenPanel(null)} />}
      {openPanel === 'encyclopedia' && <Encyclopedia   onClose={() => setOpenPanel(null)} />}
      {openPanel === 'stats'        && <CommunityStats onClose={() => setOpenPanel(null)} />}
      {openPanel === 'missions'     && <MissionBoard   onClose={() => setOpenPanel(null)} />}

      {/* Research Base (B key) */}
      {showBase && <ResearchBase onClose={() => setShowBase(false)} />}

      {/* Mystery Investigation HUD */}
      {investigatingMystery && (
        <InvestigationHUD
          mystery={investigatingMystery}
          isNew={investigationIsNew}
          rpGained={investigationRP}
          onClose={handleInvestigationClose}
        />
      )}
    </div>
  )
}
