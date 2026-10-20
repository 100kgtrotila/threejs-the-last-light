import { describe, expect, it } from 'vitest'
import { WORLD_LAYOUT } from './layout.ts'
import { validateLayout } from './validateLayout.ts'

describe('world layout', () => {
  it('keeps the authored landmarks and solid footprints clear of reserved routes', () => {
    expect(validateLayout(WORLD_LAYOUT)).toEqual([])
  })

  it('reports a landmark placed outside the safe island boundary', () => {
    const layout = structuredClone(WORLD_LAYOUT)
    layout.landmarks.grove = { x: 44, z: 2 }

    expect(validateLayout(layout)).toContain(
      'Landmark grove is outside the safe island boundary',
    )
  })

  it('reports overlapping solid footprints by their IDs', () => {
    const layout = structuredClone(WORLD_LAYOUT)
    layout.footprints.push({
      id: 'crowded-rock',
      center: { x: 25.5, z: 5 },
      radius: 1,
      solid: true,
    })

    expect(validateLayout(layout)).toContain(
      'Solid footprints grove-tree and crowded-rock overlap',
    )
  })

  it('reports a solid footprint blocking a reserved corridor', () => {
    const layout = structuredClone(WORLD_LAYOUT)
    layout.footprints.push({
      id: 'fallen-wall',
      center: { x: 0, z: 0 },
      radius: 1,
      solid: true,
    })

    expect(validateLayout(layout)).toContain(
      'Solid footprint fallen-wall blocks corridor central',
    )
  })

  it('reports a corridor that leaves the safe island boundary', () => {
    const layout = structuredClone(WORLD_LAYOUT)
    layout.corridors[0].to = { x: 43, z: 0 }

    expect(validateLayout(layout)).toContain(
      'Corridor central leaves the safe island boundary',
    )
  })
})
