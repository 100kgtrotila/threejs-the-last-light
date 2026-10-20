import type { Point2 } from '../world/layout.ts'
import type { SpatialShape } from '../world/spatial.ts'
import { shapesOverlap } from '../world/spatial.ts'

export function movePlayer(start: Point2, delta: Point2, radius: number, colliders: readonly SpatialShape[], boundary: { radiusX: number; radiusZ: number }): Point2 {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / (radius * 0.5)))
  const stepX = delta.x / steps
  const stepZ = delta.z / steps
  const position = { ...start }
  const canOccupy = (x: number, z: number): boolean => {
    if ((x / (boundary.radiusX - radius)) ** 2 + (z / (boundary.radiusZ - radius)) ** 2 > 1) return false
    return !colliders.some((collider) => shapesOverlap({ type: 'circle', x, z, radius }, collider))
  }
  for (let step = 0; step < steps; step += 1) {
    if (canOccupy(position.x + stepX, position.z)) position.x += stepX
    if (canOccupy(position.x, position.z + stepZ)) position.z += stepZ
  }
  return position
}
