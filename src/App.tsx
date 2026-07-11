import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from './store/useAppStore'
import LandingScene from './scenes/LandingScene'
import DiveTransition from './scenes/DiveTransition'
import OceanScene from './scenes/OceanScene'

export default function App() {
  const phase = useAppStore(s => s.phase)

  return (
    <div style={{ width: '100%', height: '100%', background: '#000508' }}>
      <AnimatePresence mode="wait">
        {phase === 'landing' && (
          <motion.div key="landing" style={{ position: 'fixed', inset: 0 }}>
            <LandingScene />
          </motion.div>
        )}
        {phase === 'diving' && (
          <motion.div key="diving" style={{ position: 'fixed', inset: 0 }}>
            <DiveTransition />
          </motion.div>
        )}
        {phase === 'ocean' && (
          <motion.div
            key="ocean"
            style={{ position: 'fixed', inset: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            <OceanScene />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
