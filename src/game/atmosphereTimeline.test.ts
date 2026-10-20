import { describe, expect, it } from 'vitest'
import { AtmosphereClock, lightningAt } from './atmosphereTimeline.ts'
import type { GameSnapshot } from './GameState.ts'

const exploring: GameSnapshot = { phase: 'exploration', collected: [], puzzleProgress: 0 }
const collected: GameSnapshot = { ...exploring, collected: ['wave'] }
const completed: GameSnapshot = { phase: 'completed', collected: ['wave', 'thorn', 'grave'], puzzleProgress: 3 }

describe('atmosphere timing', () => {
  it('produces the same restoration at 30 and 60 frames per second', () => {
    const slow = new AtmosphereClock(), fast = new AtmosphereClock()
    for (let i = 0; i < 120; i++) slow.update(1 / 30, completed, false)
    for (let i = 0; i < 240; i++) fast.update(1 / 60, completed, false)
    expect(slow.restoration).toBeCloseTo(fast.restoration, 8)
    expect(slow.restoration).toBeGreaterThan(0)
    expect(slow.restoration).toBeLessThan(1)
  })

  it('never restores before activation and finishes exactly once without drifting', () => {
    const clock = new AtmosphereClock()
    clock.update(10, exploring, false)
    expect(clock.restoration).toBe(0)
    clock.update(3, completed, false)
    expect(clock.restoration).toBeGreaterThan(0)
    clock.update(4, completed, false)
    expect(clock.restoration).toBe(1)
    clock.update(100, completed, false)
    expect(clock.restoration).toBe(1)
    expect(clock.lightning).toBe(0)
  })

  it('shows the apparition once after collection and only when its sightline is eligible', () => {
    const clock = new AtmosphereClock()
    clock.update(1, exploring, true)
    expect(clock.ghostOpacity).toBe(0)
    clock.update(1, collected, false)
    expect(clock.ghostOpacity).toBe(0)
    clock.update(1, collected, true)
    expect(clock.ghostOpacity).toBeGreaterThan(0)
    clock.update(6, collected, true)
    expect(clock.ghostOpacity).toBe(0)
    clock.update(1, collected, true)
    expect(clock.ghostOpacity).toBe(0)
  })

  it('freezes apparition age while paused and removes it on restoration', () => {
    const clock = new AtmosphereClock()
    clock.update(1, collected, true)
    const opacity = clock.ghostOpacity
    clock.update(3, collected, false, false)
    expect(clock.ghostOpacity).toBe(opacity)
    clock.update(0.1, completed, false)
    expect(clock.ghostOpacity).toBe(0)
  })

  it('keeps lightning occasional, bounded, and disabled for reduced motion', () => {
    expect(lightningAt(0)).toBe(0)
    expect(lightningAt(18.08)).toBeGreaterThan(0.9)
    expect(lightningAt(19)).toBe(0)
    const clock = new AtmosphereClock({ reducedMotion: true })
    clock.update(18.08, exploring, false)
    expect(clock.lightning).toBe(0)
  })
})
