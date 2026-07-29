export interface FrameBudgetTask {
  id: string
  priority: number
  run: (deadline: number) => boolean
}

const DEFAULT_BUDGET_MS = 4
const HARD_CAP_MS = 8

const tasks: FrameBudgetTask[] = []
let completedTasks = 0
let yieldedTasks = 0

export const frameBudgetQueue = {
  enqueue(task: FrameBudgetTask) {
    const existing = tasks.findIndex(item => item.id === task.id)
    if (existing >= 0) tasks.splice(existing, 1)
    tasks.push(task)
    tasks.sort((a, b) => b.priority - a.priority)
  },

  cancel(id: string) {
    const index = tasks.findIndex(task => task.id === id)
    if (index >= 0) tasks.splice(index, 1)
  },

  process(now = performance.now(), budgetMs = DEFAULT_BUDGET_MS) {
    const deadline = now + Math.min(Math.max(budgetMs, 0), HARD_CAP_MS)
    while (tasks.length > 0 && performance.now() < deadline) {
      const task = tasks.shift()!
      const complete = task.run(deadline)
      if (complete) {
        completedTasks++
      } else {
        yieldedTasks++
        tasks.push(task)
        tasks.sort((a, b) => b.priority - a.priority)
      }
    }
  },

  getStats() {
    return { depth: tasks.length, completed: completedTasks, yielded: yieldedTasks }
  },

  clear() {
    tasks.length = 0
    completedTasks = 0
    yieldedTasks = 0
  },
}
