export type GenerationStage =
  | 'terrain'
  | 'creatures'
  | 'decor'
  | 'atmosphere'
  | 'shaders'
  | 'other'

export interface StageMetrics {
  lastMs: number
  totalMs: number
  maxMs: number
  count: number
  objects: number
  allocations: number
  renders: number
  frameMaxMs: number
}

export interface GenerationProfilerSnapshot {
  frame: number
  frameStartedAt: number
  longestTaskMs: number
  longestTaskStage: GenerationStage
  queueDepth: number
  completedQueueTasks: number
  yieldedQueueTasks: number
  stages: Record<GenerationStage, StageMetrics>
}

const stageNames: GenerationStage[] = ['terrain', 'creatures', 'decor', 'atmosphere', 'shaders', 'other']

function createMetrics(): StageMetrics {
  return {
    lastMs: 0,
    totalMs: 0,
    maxMs: 0,
    count: 0,
    objects: 0,
    allocations: 0,
    renders: 0,
    frameMaxMs: 0,
  }
}

const metrics = {} as Record<GenerationStage, StageMetrics>
for (const stage of stageNames) metrics[stage] = createMetrics()

let frame = 0
let frameStartedAt = 0
let longestTaskMs = 0
let longestTaskStage: GenerationStage = 'other'
let queueDepth = 0
let completedQueueTasks = 0
let yieldedQueueTasks = 0

export const generationProfiler = {
  beginFrame(now = performance.now()) {
    frame++
    frameStartedAt = now
    longestTaskMs = 0
    longestTaskStage = 'other'
    for (const stage of stageNames) metrics[stage].frameMaxMs = 0
  },

  measure<T>(stage: GenerationStage, work: () => T): T {
    const startedAt = performance.now()
    try {
      return work()
    } finally {
      this.record(stage, performance.now() - startedAt)
    }
  },

  record(stage: GenerationStage, elapsedMs: number, objects = 0, allocations = 0, renders = 0) {
    const target = metrics[stage]
    target.lastMs = elapsedMs
    target.totalMs += elapsedMs
    target.count++
    target.maxMs = Math.max(target.maxMs, elapsedMs)
    target.frameMaxMs = Math.max(target.frameMaxMs, elapsedMs)
    target.objects += objects
    target.allocations += allocations
    target.renders += renders

    if (elapsedMs > longestTaskMs) {
      longestTaskMs = elapsedMs
      longestTaskStage = stage
    }
  },

  addCounts(stage: GenerationStage, objects = 0, allocations = 0, renders = 0) {
    const target = metrics[stage]
    target.objects += objects
    target.allocations += allocations
    target.renders += renders
  },

  setQueueStats(depth: number, completed: number, yielded: number) {
    queueDepth = depth
    completedQueueTasks = completed
    yieldedQueueTasks = yielded
  },

  snapshot(): GenerationProfilerSnapshot {
    const stages = {} as Record<GenerationStage, StageMetrics>
    for (const stage of stageNames) stages[stage] = { ...metrics[stage] }
    return {
      frame,
      frameStartedAt,
      longestTaskMs,
      longestTaskStage,
      queueDepth,
      completedQueueTasks,
      yieldedQueueTasks,
      stages,
    }
  },

  reset() {
    frame = 0
    frameStartedAt = 0
    longestTaskMs = 0
    longestTaskStage = 'other'
    queueDepth = 0
    completedQueueTasks = 0
    yieldedQueueTasks = 0
    for (const stage of stageNames) metrics[stage] = createMetrics()
  },
}
