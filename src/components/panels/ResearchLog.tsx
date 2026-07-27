import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore, EQUIPMENT_UPGRADES, EquipmentType } from '../../store/usePlayerStore'
import './Panel.css'

interface Props { onClose: () => void }

export function ResearchLog({ onClose }: Props) {
  const {
    discoveries, playerName, totalDistance, photosCapture, depth,
    researchPoints, equipmentLevel, upgradeEquipment
  } = usePlayerStore()

  const [tab, setTab] = useState<'log' | 'upgrades'>('log')
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null)

  const sorted = [...discoveries].sort((a, b) => b.timestamp - a.timestamp)

  const handleUpgrade = (type: EquipmentType) => {
    const success = upgradeEquipment(type)
    if (success) {
      setPurchaseNotice(`Upgraded ${type.toUpperCase()} system!`)
      setTimeout(() => setPurchaseNotice(null), 2500)
    }
  }

  return (
    <motion.div
      className="panel-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      id="panel-research-log"
    >
      <motion.div
        className="panel glass wide-panel"
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -60, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="panel-title text-cinematic">Research Log & Station</h2>
            <div className="panel-tabs">
              <button
                className={`panel-tab-btn ${tab === 'log' ? 'active' : ''}`}
                onClick={() => setTab('log')}
              >
                Discoveries
              </button>
              <button
                className={`panel-tab-btn ${tab === 'upgrades' ? 'active' : ''}`}
                onClick={() => setTab('upgrades')}
              >
                Equipment Upgrades
              </button>
            </div>
          </div>
          <button className="panel-close" onClick={onClose} id="btn-close-log">✕</button>
        </div>

        <div className="panel-researcher">
          <div className="researcher-avatar">🔬</div>
          <div style={{ flex: 1 }}>
            <div className="researcher-name">{playerName}</div>
            <div className="researcher-title text-mono">Marine Researcher</div>
          </div>
          <div className="rp-display-badge">
            <span className="rp-icon">💎</span>
            <span className="rp-amount">{researchPoints.toLocaleString()}</span>
            <span className="rp-unit text-mono">RP</span>
          </div>
        </div>

        <div className="panel-stats-row">
          <div className="panel-stat-box">
            <div className="psb-val">{discoveries.length}</div>
            <div className="psb-label text-mono">SPECIES</div>
          </div>
          <div className="panel-stat-box">
            <div className="psb-val">{Math.round(totalDistance / 100)}</div>
            <div className="psb-label text-mono">KM TRAVELED</div>
          </div>
          <div className="panel-stat-box">
            <div className="psb-val">{photosCapture}</div>
            <div className="psb-label text-mono">PHOTOS</div>
          </div>
          <div className="panel-stat-box">
            <div className="psb-val">{depth.toLocaleString()}</div>
            <div className="psb-label text-mono">MAX DEPTH</div>
          </div>
        </div>

        {purchaseNotice && (
          <div className="purchase-notice-banner text-mono">
            ✅ {purchaseNotice}
          </div>
        )}

        {tab === 'log' ? (
          <>
            <div className="panel-section-label text-mono">DISCOVERIES & LOGS</div>

            {discoveries.length === 0 ? (
              <div className="panel-empty">
                <div className="panel-empty-icon">🔬</div>
                <p>No discoveries yet. Click on a creature and choose <strong>Scan</strong> to earn Research Points (RP) and unlock equipment upgrades.</p>
              </div>
            ) : (
              <div className="panel-list">
                {sorted.map(d => (
                  <div key={d.id} className="discovery-item">
                    <div className="di-top">
                      <span className="di-name">{d.name}</span>
                      {d.isFirstEver && <span className="di-first">WORLD FIRST</span>}
                      {d.dna?.rarity && (
                        <span className={`di-rarity-tag ${d.dna.rarity}`}>
                          {d.dna.rarity.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="di-meta text-mono">
                      <span>{d.speciesId}</span>
                      <span>{d.biome}</span>
                      <span>{d.depth}m</span>
                      <span>{new Date(d.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="panel-section-label text-mono">SUBMERSIBLE UPGRADES</div>
            <div className="upgrades-grid">
              {(['sonar', 'camera', 'lights', 'pressure'] as EquipmentType[]).map((type) => {
                const currentLvl = equipmentLevel[type] ?? 0
                const allUpgrades = EQUIPMENT_UPGRADES[type]
                const currentItem = allUpgrades[currentLvl]
                const nextItem = allUpgrades[currentLvl + 1]

                return (
                  <div key={type} className="upgrade-card">
                    <div className="uc-header">
                      <span className="uc-icon">
                        {type === 'sonar' && '📡'}
                        {type === 'camera' && '📷'}
                        {type === 'lights' && '💡'}
                        {type === 'pressure' && '🛡️'}
                      </span>
                      <div className="uc-title-block">
                        <div className="uc-type text-mono">{type.toUpperCase()} SYSTEM</div>
                        <div className="uc-name">{currentItem.name}</div>
                      </div>
                      <div className="uc-level-badge text-mono">LVL {currentLvl}</div>
                    </div>

                    <div className="uc-desc">{currentItem.description}</div>
                    <div className="uc-effect text-mono">EFFECT: {currentItem.effect}</div>

                    <div className="uc-footer">
                      {nextItem ? (
                        <button
                          className={`upgrade-btn ${researchPoints >= nextItem.cost ? 'affordable' : 'locked'}`}
                          onClick={() => handleUpgrade(type)}
                          disabled={researchPoints < nextItem.cost}
                        >
                          <span>UPGRADE ({nextItem.name})</span>
                          <span className="cost-tag">{nextItem.cost} RP</span>
                        </button>
                      ) : (
                        <div className="max-level-tag text-mono">MAXIMUM LEVEL REACHED</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
