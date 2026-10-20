import { describe, expect, it } from 'vitest'
import { createEnvironmentLayout } from '../world/environmentLayout.ts'
import { WORLD_LAYOUT } from '../world/layout.ts'
import { movePlayer } from './collision.ts'
import { createWorldColliders } from './worldColliders.ts'

const plan = createEnvironmentLayout(WORLD_LAYOUT)
const colliders = createWorldColliders(plan)

describe('authored world collision integration', () => {
  it('preserves every reserved navigation route for a player with radius 0.35', () => {
    for (const route of plan.routes) {
      const end = movePlayer(route.from, { x: route.to.x - route.from.x, z: route.to.z - route.from.z }, 0.35, colliders, plan.boundary)
      expect(end.x, route.id).toBeCloseTo(route.to.x)
      expect(end.z, route.id).toBeCloseTo(route.to.z)
    }
  })

  it('blocks passage through actual lighthouse, mausoleum, grave, and rock placements', () => {
    const structures = plan.structures.filter((structure) => ['lighthouse', 'mausoleum', 'grave'].includes(structure.kind))
    const obstacles = [
      ...structures.map((structure) => ({ id: structure.id, shape: structure.footprint })),
      ...plan.props.filter((prop) => prop.kind === 'rock').map((prop) => ({ id: prop.id, shape: { type: 'circle' as const, ...prop.position, radius: prop.radius } })),
    ]
    for (const { id, shape } of obstacles) {
      const depth = shape.type === 'circle' ? shape.radius : shape.halfZ
      const start = { x: shape.x, z: shape.z + depth + 0.5 }
      const end = movePlayer(start, { x: 0, z: -(depth * 2 + 1) }, 0.35, colliders, plan.boundary)
      expect(end.z, id).toBeGreaterThanOrEqual(shape.z + depth + 0.35)
    }
  })
})
