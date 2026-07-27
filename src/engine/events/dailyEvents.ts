export type WorldEffectType = 'migration' | 'awakening' | 'bloom' | 'hunt' | 'portal' | 'meteor' | 'eclipse' | 'choir'

export interface EventWorldEffect {
  particleColor?: string
  lightingMult?: number
  spawnOverride?: 'leviathan' | 'squid' | 'crater' | 'portal'
  glowMultiplier?: number
  spawnRateMultiplier?: number
}

export interface DailyEvent {
  id: string
  name: string
  description: string
  icon: string
  color: string
  endsAt: number // timestamp
  type: WorldEffectType
  worldEffect: EventWorldEffect
}

const EVENTS: Omit<DailyEvent, 'endsAt'>[] = [
  {
    id: 'leviathan',
    name: 'Leviathan Migration',
    description: 'A mythical whale crosses the ocean. Race to photograph it before it disappears.',
    icon: '🐋',
    color: '#0077b6',
    type: 'migration',
    worldEffect: {
      spawnOverride: 'leviathan',
      particleColor: '#00b4d8',
      lightingMult: 1.1,
      spawnRateMultiplier: 1.3,
    },
  },
  {
    id: 'temple',
    name: 'Temple Awakening',
    description: 'An ancient temple rises from the seafloor. A hidden chamber has opened — for 24 hours only.',
    icon: '🏛️',
    color: '#ffd60a',
    type: 'awakening',
    worldEffect: {
      spawnOverride: 'portal',
      particleColor: '#ffe066',
      glowMultiplier: 1.8,
    },
  },
  {
    id: 'bloom',
    name: 'Glowing Bloom',
    description: 'Millions of bioluminescent jellyfish fill the ocean. Everything glows cyan and gold.',
    icon: '✨',
    color: '#90e0ef',
    type: 'bloom',
    worldEffect: {
      particleColor: '#00ffff',
      glowMultiplier: 2.5,
      spawnRateMultiplier: 2.0,
    },
  },
  {
    id: 'squid',
    name: 'Giant Squid Hunt',
    description: 'A rare giant squid has surfaced. Only visible for 24 hours. Will you find it?',
    icon: '🦑',
    color: '#c77dff',
    type: 'hunt',
    worldEffect: {
      spawnOverride: 'squid',
      particleColor: '#e0aaff',
      lightingMult: 0.85,
    },
  },
  {
    id: 'portal',
    name: 'Abyss Portal',
    description: 'A crack in the ocean floor has opened revealing an unknown anomaly. It closes at midnight.',
    icon: '🌀',
    color: '#023e8a',
    type: 'portal',
    worldEffect: {
      spawnOverride: 'portal',
      particleColor: '#7209b7',
      glowMultiplier: 2.0,
      lightingMult: 0.7,
    },
  },
  {
    id: 'meteor',
    name: 'Meteor Impact',
    description: 'A glowing meteor crashed beneath the waves. Rare species have appeared near the site.',
    icon: '☄️',
    color: '#ff4d00',
    type: 'meteor',
    worldEffect: {
      spawnOverride: 'crater',
      particleColor: '#ff7043',
      glowMultiplier: 2.2,
    },
  },
  {
    id: 'eclipse',
    name: 'Lunar Eclipse',
    description: 'The ocean lighting has shifted into deep shadow. Rare nocturnal creatures have emerged.',
    icon: '🌑',
    color: '#5b2d8e',
    type: 'eclipse',
    worldEffect: {
      lightingMult: 0.35,
      particleColor: '#b5179e',
      glowMultiplier: 3.0,
      spawnRateMultiplier: 1.5,
    },
  },
  {
    id: 'choir',
    name: 'Whale Choir',
    description: 'The ocean is filled with an ancient whale song. Navigate by acoustic signatures.',
    icon: '🎵',
    color: '#1b4332',
    type: 'choir',
    worldEffect: {
      spawnOverride: 'leviathan',
      particleColor: '#52b788',
      lightingMult: 1.0,
      spawnRateMultiplier: 1.6,
    },
  },
]

export function getDailyEvent(): DailyEvent {
  const today = new Date()
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const event = EVENTS[dayIndex % EVENTS.length]

  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  return { ...event, endsAt: endOfDay.getTime() }
}

export function getEventTimeRemaining(event: DailyEvent): string {
  const remaining = event.endsAt - Date.now()
  if (remaining <= 0) return '00:00:00'
  const h = Math.floor(remaining / 3600000).toString().padStart(2, '0')
  const m = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}
