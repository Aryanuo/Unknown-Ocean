import { useEffect, useState } from 'react'
import { generationProfiler, GenerationProfilerSnapshot, GenerationStage } from '../../engine/performance/generationProfiler'

const rows: Array<[GenerationStage, string]> = [
  ['terrain', 'Terrain'],
  ['creatures', 'Creatures'],
  ['decor', 'Decor'],
  ['atmosphere', 'Atmosphere'],
  ['shaders', 'Shaders'],
  ['other', 'Other'],
]

function ms(value: number) {
  return `${value.toFixed(2)} ms`
}

export function GenerationProfilerOverlay() {
  const [snapshot, setSnapshot] = useState<GenerationProfilerSnapshot>(() => generationProfiler.snapshot())

  useEffect(() => {
    const id = window.setInterval(() => setSnapshot(generationProfiler.snapshot()), 250)
    return () => window.clearInterval(id)
  }, [])

  return (
    <aside
      aria-label="Generation profiler"
      style={{
        position: 'fixed', top: 12, right: 12, zIndex: 1000, width: 348,
        padding: 12, color: '#dff7ff', background: 'rgba(0, 13, 24, 0.9)',
        border: '1px solid rgba(85, 214, 255, 0.45)', borderRadius: 8,
        font: '12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
      }}
    >
      <strong style={{ color: '#7ee7ff' }}>GENERATION PROFILER</strong>
      <div style={{ marginTop: 8, color: '#9db8c4' }}>Largest single task this frame</div>
      {rows.map(([stage, label]) => (
        <div key={stage} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{label.padEnd(12, '.')}</span>
          <span style={{ color: snapshot.stages[stage].frameMaxMs > 8 ? '#ff8f8f' : '#dff7ff' }}>
            {ms(snapshot.stages[stage].frameMaxMs)}
          </span>
        </div>
      ))}
      <hr style={{ border: 0, borderTop: '1px solid rgba(126, 231, 255, 0.2)' }} />
      <div>Longest observed: <b>{snapshot.longestTaskStage}</b> {ms(snapshot.longestTaskMs)}</div>
      <div>Queue: {snapshot.queueDepth} pending · {snapshot.completedQueueTasks} done · {snapshot.yieldedQueueTasks} yielded</div>
      <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 11 }}>
        <thead style={{ color: '#8eacb8' }}>
          <tr><th align="left">Stage</th><th align="right">Last</th><th align="right">Max</th><th align="right">Obj</th><th align="right">Alloc</th><th align="right">Renders</th></tr>
        </thead>
        <tbody>
          {rows.map(([stage, label]) => {
            const item = snapshot.stages[stage]
            return <tr key={stage}><td>{label}</td><td align="right">{ms(item.lastMs)}</td><td align="right">{ms(item.maxMs)}</td><td align="right">{item.objects}</td><td align="right">{item.allocations}</td><td align="right">{item.renders}</td></tr>
          })}
        </tbody>
      </table>
    </aside>
  )
}
