import { describe, expect, it } from 'vitest'
import { movePlayer } from './collision.ts'
import { shapesOverlap } from '../world/spatial.ts'

const boundary = { radiusX: 43, radiusZ: 33 }
describe('player collision', () => {
  it('moves freely through open ground', () => {
    const position = movePlayer({ x: 0, z: 0 }, { x: 2, z: -3 }, 0.35, [], boundary)
    expect(position.x).toBeCloseTo(2)
    expect(position.z).toBeCloseTo(-3)
  })

  it('cannot tunnel through a thin grave or wall during a long displacement', () => {
    const wall = { type: 'box' as const, x: 0, z: 0, halfX: 3, halfZ: 0.14 }
    const position = movePlayer({ x: 0, z: 3 }, { x: 0, z: -10 }, 0.35, [wall], boundary)
    expect(position.z).toBeGreaterThanOrEqual(0.49)
    expect(shapesOverlap({ type: 'circle', ...position, radius: 0.35 }, wall)).toBe(false)
  })

  it('slides along a building and stops outside a round rock', () => {
    const position = movePlayer({ x: -2, z: 0 }, { x: 3, z: 2 }, 0.35, [
      { type: 'box', x: 0, z: 0, halfX: 1, halfZ: 4 },
    ], boundary)
    expect(position.x).toBeLessThanOrEqual(-1.35)
    expect(position.z).toBeCloseTo(2)
    const stopped = movePlayer({ x: 0, z: 3 }, { x: 0, z: -4 }, 0.35, [{ type: 'circle', x: 0, z: 0, radius: 1 }], boundary)
    expect(stopped.z).toBeGreaterThanOrEqual(1.35)
  })

  it('keeps the whole player inside the safe island ellipse at diagonal edges', () => {
    const position = movePlayer({ x: 30, z: 15 }, { x: 40, z: 40 }, 0.35, [], boundary)
    expect((position.x / 42.65) ** 2 + (position.z / 32.65) ** 2).toBeLessThanOrEqual(1)
  })
})
