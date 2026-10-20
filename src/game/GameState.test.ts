import { describe, expect, it } from 'vitest'
import { GameState } from './GameState.ts'

describe('ritual progression', () => {
  it('rejects puzzle input and activation during exploration', () => {
    const state = new GameState()
    expect(state.enterDial('wave').result).toBe('locked')
    expect(state.activateBeacon().result).toBe('locked')
    expect(state.snapshot()).toEqual({ phase: 'exploration', collected: [], puzzleProgress: 0 })
  })

  it('collects each symbol once in any order and unlocks the puzzle after the third', () => {
    for (const order of [ ['grave', 'wave', 'thorn'], ['thorn', 'grave', 'wave'], ['wave', 'thorn', 'grave'] ] as const) {
      const state = new GameState()
      state.collect(order[0])
      expect(state.collect(order[0]).result).toBe('duplicate')
      state.collect(order[1])
      expect(state.snapshot().phase).toBe('exploration')
      state.collect(order[2])
      expect(state.snapshot().phase).toBe('puzzle')
      expect(state.snapshot().collected).toHaveLength(3)
    }
  })

  it('resets a wrong dial sequence without losing collected symbols', () => {
    const state = new GameState()
    state.collect('wave'); state.collect('thorn'); state.collect('grave')
    state.enterDial('wave')
    expect(state.enterDial('grave').result).toBe('incorrect')
    expect(state.snapshot()).toEqual({ phase: 'puzzle', collected: ['wave', 'thorn', 'grave'], puzzleProgress: 0 })
  })

  it('requires the complete ritual before activation and keeps completion terminal', () => {
    const state = new GameState()
    state.collect('wave'); state.collect('thorn'); state.collect('grave')
    state.enterDial('wave'); state.enterDial('thorn')
    expect(state.activateBeacon().result).toBe('locked')
    expect(state.enterDial('grave').snapshot.phase).toBe('activation')
    expect(state.activateBeacon().snapshot.phase).toBe('completed')
    expect(state.activateBeacon().result).toBe('alreadyCompleted')
    expect(state.enterDial('wave').snapshot.phase).toBe('completed')
  })

  it('returns snapshots that cannot mutate the internal collection', () => {
    const state = new GameState()
    state.collect('wave')
    const symbols = state.snapshot().collected
    Reflect.set(symbols, 0, 'grave')
    expect(state.snapshot().collected).toEqual(['wave'])
  })
})
