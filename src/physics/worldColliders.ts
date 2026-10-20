import type { EnvironmentLayout } from '../world/environmentLayout.ts'
import type { SpatialShape } from '../world/spatial.ts'

export function createWorldColliders(plan: EnvironmentLayout): SpatialShape[] {
  return [
    ...plan.structures.filter((structure) => structure.kind !== 'landing').map((structure) => structure.footprint),
    ...plan.props.filter((prop) => prop.kind !== 'bush').map((prop): SpatialShape => ({
      type: 'circle', x: prop.position.x, z: prop.position.z,
      radius: prop.kind === 'tree' ? 0.42 * prop.scale : prop.radius,
    })),
  ]
}
