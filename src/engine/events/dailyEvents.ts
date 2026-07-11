export interface DailyEvent {
  id: string
  name: string
  description: string
  icon: string
  color: string
  endsAt: number // timestamp
  type: 'migration' | 'awakening' | 'bloom' | 'hunt' | 'portal' | 'meteor' | 'eclipse' | 'choir'
}

const EVENTS: Omit<DailyEvent, 'endsAt'>[] = [
  {
    id: 'leviathan',
    name: 'Leviathan Migration',
    description: 'A mythical whale crosses the ocean. Race to photograph it before it disappears.',
    icon: '🐋',
    color: '#0077b6',
    type: 'migration',
  },
  {
    id: 'temple',
    name: 'Temple Awakening',
    description: 'An ancient temple rises from the seafloor. A hidden chamber has opened — for 24 hours only.',
    icon: '🏛️',
    color: '#ffd60a',
    type: 'awakening',
  },
  {
    id: 'bloom',
    name: 'Glowing Bloom',
    description: 'Millions of bioluminescent jellyfish fill the ocean. Everything glows blue.',
    icon: '✨',
    color: '#90e0ef',
    type: 'bloom',
  },
  {
    id: 'squid',
    name: 'Giant Squid Hunt',
    description: 'A rare giant squid has surfaced. Only visible for 24 hours. Will you find it?',
    icon: '🦑',
    color: '#c77dff',
    type: 'hunt',
  },
  {
    id: 'portal',
    name: 'Abyss Portal',
    description: 'A crack in the ocean floor has opened revealing an unknown biome. It closes at midnight.',
    icon: '🌀',
    color: '#023e8a',
    type: 'portal',
  },
  {
    id: 'meteor',
    name: 'Meteor Impact',
    description: 'A glowing meteor crashed beneath the waves. New species have appeared near the impact site.',
    icon: '☄️',
    color: '#ff4d00',
    type: 'meteor',
  },
  {
    id: 'eclipse',
    name: 'Lunar Eclipse',
    description: 'The ocean lighting has shifted. Rare nocturnal creatures have emerged from the deep.',
    icon: '🌑',
    color: '#5b2d8e',
    type: 'eclipse',
  },
  {
    id: 'choir',
    name: 'Whale Choir',
    description: 'The ocean is filled with an ancient whale song. Navigate by sound.',
    icon: '🎵',
    color: '#1b4332',
    type: 'choir',
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
