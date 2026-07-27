import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
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
import { Hero } from '../components/ocean3d/Hero'
import { BubbleTrail } from '../components/ocean3d/BubbleTrail'
import { Terrain3D } from '../components/ocean3d/Terrain3D'
import { CreatureManager } from '../components/ocean3d/CreatureManager'
import { MysteryManager } from '../components/ocean3d/MysteryManager'
import { EventCreature3D } from '../components/ocean3d/EventCreature3D'
import { EventObject3D, EventObjectType } from '../components/ocean3d/EventObject3D'
import { UnderwaterAtmosphere } from '../components/ocean3d/UnderwaterAtmosphere'
import './OceanScene.css'

// ── Pre-allocated colour reusables ────────────────────────────────────────────
const _fogColor  = new Color()
const _targetFog = new Color()

// ── Environment scene with smooth fog transitions ─────────────────────────────
interface EnvSceneProps {
  biome: BiomeType
  onScanCreature: (id: string, speciesId: string, name: string, dna: any, wx: number, wy: number, wz: number) => void
  onDiscovery: (d: Discovery) => void
  onInvestigateMystery: (m: MysteryInstance) => void
  discoveredMysteryIds: Set<string>
  onEventObjectInteract: (rp: number, label: string) => void
}

const EnvironmentScene = React.memo(function EnvironmentScene({ biome, onScanCreature, onDiscovery, onInvestigateMystery, discoveredMysteryIds, onEventObjectInteract }: EnvSceneProps) {
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

      <Environment preset="city" />

      <Hero />
      <BubbleTrail />
      <Terrain3D />
      <CreatureManager onScanCreature={onScanCreature} onDiscovery={onDiscovery} />
      <MysteryManager onInvestigate={onInvestigateMystery} discoveredMysteryIds={discoveredMysteryIds} />

      {/* Dynamic Event Mega-Creature (Leviathan / Giant Squid) */}
      {(worldEffect?.spawnOverride === 'leviathan' || worldEffect?.spawnOverride === 'squid') && (
        <EventCreature3D
          type={worldEffect.spawnOverride}
          eventName={dailyEvent.name}
          scanned={false}
          onScan={onScanCreature}
        />
      )}

      {/* Dynamic Event World Object (Portal / Crater / Temple) */}
      {(worldEffect?.spawnOverride === 'portal' || worldEffect?.spawnOverride === 'crater') && (
        <EventObject3D
          type={worldEffect.spawnOverride as EventObjectType}
          onInteract={(rp) => onEventObjectInteract(rp, dailyEvent.name)}
        />
      )}
      {dailyEvent?.type === 'awakening' && (
        <EventObject3D
          type="temple"
          onInteract={(rp) => onEventObjectInteract(rp, dailyEvent.name)}
        />
      )}

      <UnderwaterAtmosphere />
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

  const [currentBiome, setLocalBiome]    = useState<BiomeType>('coral')
  const [openPanel, setOpenPanel]        = useState<'log' | 'encyclopedia' | 'photo' | 'stats' | 'missions' | null>(null)
  const [photoMode, setPhotoMode]        = useState(false)

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
        <EnvironmentScene
          biome={currentBiome}
          onScanCreature={handleScanCreature}
          onDiscovery={handleDiscovery}
          onInvestigateMystery={handleInvestigateMystery}
          discoveredMysteryIds={discoveredMysteryIds}
          onEventObjectInteract={handleEventObjectInteract}
        />

        {/* ── Post Processing ─────────────────────────────────────────────── */}
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
          <Vignette
            offset={0.25}
            darkness={0.7}
            eskil={false}
          />
        </EffectComposer>
      </Canvas>

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
            currentBiome={currentBiome}
          />
          <DailyEventBanner event={dailyEvent} />
          <SonarMinimap />
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
