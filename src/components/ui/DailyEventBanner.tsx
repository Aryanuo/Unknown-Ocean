import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DailyEvent, getEventTimeRemaining } from '../../engine/events/dailyEvents'
import './DailyEventBanner.css'

interface Props { event: DailyEvent }

export function DailyEventBanner({ event }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(getEventTimeRemaining(event))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getEventTimeRemaining(event))
    }, 1000)
    return () => clearInterval(interval)
  }, [event])

  return (
    <motion.div
      className={`event-banner glass ${collapsed ? 'collapsed' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 1, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
      style={{ borderColor: `${event.color}44` }}
      id="daily-event-banner"
    >
      <button
        className="event-banner-toggle"
        onClick={() => setCollapsed(c => !c)}
        id="btn-toggle-event"
      >
        <span className="event-icon">{event.icon}</span>
        {!collapsed && (
          <>
            <div className="event-info">
              <div className="event-name text-cinematic">{event.name}</div>
              <div className="event-desc">{event.description}</div>
            </div>
            <div className="event-timer text-mono" style={{ color: event.color }}>
              <span className="event-timer-label">ENDS IN</span>
              <span className="event-timer-val">{timeLeft}</span>
            </div>
          </>
        )}
        <span className="event-chevron">{collapsed ? '▼' : '▲'}</span>
      </button>
    </motion.div>
  )
}
