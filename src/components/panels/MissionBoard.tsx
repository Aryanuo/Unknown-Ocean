import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '../../store/usePlayerStore'
import './Panel.css'

interface Props {
  onClose: () => void
}

export function MissionBoard({ onClose }: Props) {
  const { dailyMissions, initDailyMissions, claimMissionReward, researchPoints } = usePlayerStore()

  useEffect(() => {
    initDailyMissions()
  }, [initDailyMissions])

  return (
    <motion.div
      className="panel-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      id="panel-mission-board"
    >
      <motion.div
        className="panel glass"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <h2 className="panel-title text-cinematic">Daily Research Directive</h2>
            <div className="global-subtitle text-mono" style={{ textAlign: 'left', marginTop: '2px' }}>
              RENEWED DAILY • EXPEDITION OBJECTIVES
            </div>
          </div>
          <button className="panel-close" onClick={onClose} id="btn-close-missions">
            ✕
          </button>
        </div>

        <div className="rp-display-badge" style={{ alignSelf: 'flex-start' }}>
          <span className="rp-icon">💎</span>
          <span className="rp-amount">{researchPoints.toLocaleString()}</span>
          <span className="rp-unit text-mono">RP BALANCE</span>
        </div>

        <div className="panel-section-label text-mono">ACTIVE OBJECTIVES</div>

        <div className="mission-list">
          {dailyMissions.map((m) => {
            const progressPercent = Math.min(100, (m.progress / m.target) * 100)

            return (
              <div
                key={m.id}
                className={`mission-card ${m.completed ? 'completed' : ''} ${m.claimed ? 'claimed' : ''}`}
              >
                <div className="mc-header">
                  <span className="mc-title">{m.title}</span>
                  <span className="mc-rp-badge text-mono">+{m.rewardRP} RP</span>
                </div>
                <div className="mc-desc">{m.description}</div>

                <div className="mc-progress-wrapper">
                  <div className="mc-progress-bar">
                    <div
                      className="mc-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mc-progress-text text-mono">
                    {m.category === 'depth'
                      ? `${m.progress.toLocaleString()}m / ${m.target.toLocaleString()}m`
                      : m.category === 'travel'
                      ? `${m.progress}km / ${m.target}km`
                      : `${m.progress} / ${m.target}`}
                  </div>
                </div>

                <div className="mc-footer">
                  {m.claimed ? (
                    <div className="claimed-tag text-mono">✓ REWARD CLAIMED</div>
                  ) : m.completed ? (
                    <button
                      className="claim-btn text-mono"
                      onClick={() => claimMissionReward(m.id)}
                    >
                      CLAIM {m.rewardRP} RP
                    </button>
                  ) : (
                    <div className="in-progress-tag text-mono">IN PROGRESS</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
