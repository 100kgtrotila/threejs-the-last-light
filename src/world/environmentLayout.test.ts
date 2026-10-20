import { describe, expect, it } from 'vitest'
import { WORLD_LAYOUT } from './layout.ts'
import { createEnvironmentLayout, validateEnvironmentLayout } from './environmentLayout.ts'
import { shapesOverlap } from './spatial.ts'

describe('environment placement', () => {
  it('reproduces prop positions from a seed and changes them for a different seed', () => {
    const first = createEnvironmentLayout(WORLD_LAYOUT, 7419)
    expect(createEnvironmentLayout(WORLD_LAYOUT, 7419).props).toEqual(first.props)
    expect(createEnvironmentLayout(WORLD_LAYOUT, 7420).props).not.toEqual(first.props)
    expect(first.props.filter((prop) => prop.kind === 'tree')).toHaveLength(26)
    expect(first.props.filter((prop) => prop.kind === 'bush')).toHaveLength(42)
    expect(first.props.filter((prop) => prop.kind === 'rock')).toHaveLength(32)
  })

  it('keeps generated props out of paths, structures, graves, and artifact clearings', () => {
    const plan = createEnvironmentLayout(WORLD_LAYOUT, 7419)
    expect(validateEnvironmentLayout(plan)).toEqual([])
    expect(plan.artifactSites).toHaveLength(3)
    expect(plan.structures.filter((item) => item.kind === 'mausoleum')).toHaveLength(2)
  })

  it('reports a tree moved into a protected graveyard', () => {
    const plan = createEnvironmentLayout(WORLD_LAYOUT, 7419)
    plan.props[0].position = { x: -22, z: -6 }
    expect(validateEnvironmentLayout(plan).some((issue) => issue.includes(plan.props[0].id) && issue.includes('cemetery'))).toBe(true)
  })

  it('reports a building occupying a reserved navigation corridor', () => {
    const plan = createEnvironmentLayout(WORLD_LAYOUT, 7419)
    const building = plan.structures.find((structure) => structure.id === 'mausoleum-north')
    if (!building || building.footprint.type !== 'box') throw new Error('Missing mausoleum fixture')
    building.footprint.x = 0
    building.footprint.z = 0
    expect(validateEnvironmentLayout(plan).some((issue) => issue.includes('mausoleum-north') && issue.includes('path-central'))).toBe(true)
  })

  it('rejects a structure whose footprint extends beyond the island support area', () => {
    const plan = createEnvironmentLayout(WORLD_LAYOUT, 7419)
    const building = plan.structures.find((structure) => structure.id === 'mausoleum-north')
    if (!building || building.footprint.type !== 'box') throw new Error('Missing mausoleum fixture')
    building.footprint.x = 42
    expect(validateEnvironmentLayout(plan).some((issue) => issue.includes('mausoleum-north') && issue.includes('boundary'))).toBe(true)
  })

  it('uses precise circles after broad bounds overlap', () => {
    expect(shapesOverlap(
      { type: 'circle', x: 0, z: 0, radius: 1 },
      { type: 'circle', x: 1.6, z: 1.6, radius: 1 },
    )).toBe(false)
    expect(shapesOverlap(
      { type: 'circle', x: 0, z: 0, radius: 1 },
      { type: 'box', x: 1.8, z: 1.8, halfX: 1, halfZ: 1 },
    )).toBe(false)
  })

  it('detects a circle crossing the diagonal edge of a reserved route', () => {
    expect(shapesOverlap(
      { type: 'circle', x: 5, z: 5.8, radius: 0.5 },
      { type: 'capsule', from: { x: 0, z: 0 }, to: { x: 10, z: 10 }, radius: 0.5 },
    )).toBe(true)
  })
})
