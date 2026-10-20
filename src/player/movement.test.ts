import { describe, expect, it } from 'vitest'
import { movementDelta } from './movement.ts'

describe('movement integration', () => {
  it('travels the same distance at 30 and 60 updates per second', () => {
    for (const frames of [30, 60]) {
      let distance = 0
      for (let frame = 0; frame < frames; frame += 1) distance += -movementDelta(0, -1, 0, false, 1 / frames).z
      expect(distance).toBeCloseTo(3.4)
    }
  })
  it('normalizes diagonals, rotates with camera yaw, and runs faster', () => {
    const diagonal = movementDelta(1, -1, 0, false, 0.1)
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(0.34)
    expect(movementDelta(0, -1, Math.PI / 2, false, 0.1).x).toBeCloseTo(-0.34)
    expect(movementDelta(0, -1, 0, true, 0.1).z).toBeCloseTo(-0.58)
  })
})
