import type { Corridor, Point2, SymbolId, WorldLayout } from './layout.ts'
import { shapeBounds, shapesOverlap } from './spatial.ts'
import type { BoxFootprint, CircleFootprint, SpatialShape } from './spatial.ts'

export type StructurePlacement = {
  id: string
  kind: 'lighthouse' | 'mausoleum' | 'grave' | 'altar' | 'landing' | 'dial'
  footprint: CircleFootprint | BoxFootprint
  variant: number
}
export type PropPlacement = { id: string; kind: 'tree' | 'bush' | 'rock'; position: Point2; radius: number; scale: number; yaw: number }
export type ReservedZone = { id: string; shape: SpatialShape }
export type ArtifactSite = { id: SymbolId; position: Point2 }
export type EnvironmentLayout = {
  seed: number
  boundary: { radiusX: number; radiusZ: number }
  structures: StructurePlacement[]
  props: PropPlacement[]
  exclusions: ReservedZone[]
  routes: Corridor[]
  artifactSites: ArtifactSite[]
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function propFootprint(prop: PropPlacement): CircleFootprint {
  return { type: 'circle', x: prop.position.x, z: prop.position.z, radius: prop.radius }
}

export function createEnvironmentLayout(world: WorldLayout, seed = 7419): EnvironmentLayout {
  const { landmarks } = world
  const lighthouseBase = world.footprints.find((footprint) => footprint.id === 'lighthouse-base')
  if (!lighthouseBase) throw new Error('The lighthouse requires an authored base footprint')
  const artifactSites: ArtifactSite[] = [
    { id: 'wave', position: { ...landmarks.shore } },
    { id: 'grave', position: { ...landmarks.cemetery } },
    { id: 'thorn', position: { ...landmarks.grove } },
  ]
  const structures: StructurePlacement[] = [
    { id: 'lighthouse', kind: 'lighthouse', footprint: { type: 'circle', ...landmarks.lighthouse, radius: lighthouseBase.radius }, variant: 0 },
    { id: 'landing', kind: 'landing', footprint: { type: 'circle', ...landmarks.landing, radius: 3.3 }, variant: 0 },
    { id: 'dial', kind: 'dial', footprint: { type: 'circle', ...landmarks.dial, radius: 1.6 }, variant: 0 },
    ...artifactSites.map((site, variant): StructurePlacement => ({ id: `site-${site.id}`, kind: 'altar', footprint: { type: 'circle', ...site.position, radius: 1.25 }, variant })),
    { id: 'mausoleum-north', kind: 'mausoleum', footprint: { type: 'box', x: -30, z: -8, halfX: 2.3, halfZ: 2.8 }, variant: 0 },
    { id: 'mausoleum-south', kind: 'mausoleum', footprint: { type: 'box', x: -30, z: 4, halfX: 2.3, halfZ: 2.8 }, variant: 1 },
  ]
  for (const [row, z] of [-6, 2, -10, 6].entries()) {
    for (const [column, x] of [-25, -21, -17].entries()) {
      structures.push({ id: `grave-${row}-${column}`, kind: 'grave', footprint: { type: 'box', x, z, halfX: 0.7, halfZ: 0.65 }, variant: (row + column) % 3 })
    }
  }
  const routes = world.corridors.map((route) => ({ ...route, from: { ...route.from }, to: { ...route.to } }))
  routes.push(
    { id: 'cemetery-approach', from: { x: -16, z: -2 }, to: { x: -19, z: -2 }, width: 2.6 },
    { id: 'grove-approach', from: { x: 16, z: 2 }, to: { x: 19, z: 2 }, width: 2.6 },
    { id: 'lighthouse-approach', from: { x: 0, z: -20 }, to: { x: 0, z: -21.7 }, width: 1.5 },
  )
  const exclusions: ReservedZone[] = [
    ...routes.map((route): ReservedZone => ({ id: `path-${route.id}`, shape: { type: 'capsule', from: route.from, to: route.to, radius: route.width / 2 + 0.6 } })),
    ...structures.map((structure): ReservedZone => ({ id: structure.id, shape: structure.footprint })),
    { id: 'cemetery-grounds', shape: { type: 'box', x: -24, z: -2, halfX: 11, halfZ: 11 } },
    { id: 'lighthouse-grounds', shape: { type: 'circle', ...landmarks.lighthouse, radius: 6 } },
    ...artifactSites.map((site): ReservedZone => ({ id: `artifact-${site.id}`, shape: { type: 'circle', ...site.position, radius: 3.4 } })),
  ]
  const plan: EnvironmentLayout = { seed, boundary: world.safeBoundary, structures, props: [], exclusions, routes, artifactSites }
  const random = seededRandom(seed)
  for (const kind of ['tree', 'bush', 'rock'] as const) {
    const count = kind === 'tree' ? 26 : kind === 'bush' ? 42 : 32
    let accepted = 0
    for (let attempt = 0; accepted < count && attempt < 12000; attempt += 1) {
      const grove = kind === 'tree' && accepted < 9
      const position = grove
        ? { x: 16 + random() * 18, z: -12 + random() * 29 }
        : { x: (random() * 2 - 1) * 40, z: (random() * 2 - 1) * 30 }
      const scale = 0.8 + random() * 0.5
      const radius = (kind === 'tree' ? 2.15 : kind === 'bush' ? 0.85 : 1.05) * scale
      const normalized = (position.x / (plan.boundary.radiusX - radius)) ** 2 + (position.z / (plan.boundary.radiusZ - radius)) ** 2
      if (normalized >= 1 || (kind === 'rock' && normalized < 0.53)) continue
      const candidate: PropPlacement = { id: `${kind}-${accepted}`, kind, position, radius, scale, yaw: random() * Math.PI * 2 }
      const shape = propFootprint(candidate)
      if (exclusions.some((zone) => shapesOverlap(shape, zone.shape, 0.3))) continue
      if (plan.props.some((prop) => shapesOverlap(shape, propFootprint(prop), 0.35))) continue
      plan.props.push(candidate)
      accepted += 1
    }
    if (accepted !== count) throw new Error(`Could only place ${accepted}/${count} ${kind} props with seed ${seed}`)
  }
  return plan
}

export function validateEnvironmentLayout(plan: EnvironmentLayout): string[] {
  const issues: string[] = []
  for (const prop of plan.props) {
    const shape = propFootprint(prop)
    if ((prop.position.x / (plan.boundary.radiusX - prop.radius)) ** 2 + (prop.position.z / (plan.boundary.radiusZ - prop.radius)) ** 2 >= 1) issues.push(`${prop.id} leaves the safe island boundary`)
    for (const zone of plan.exclusions) {
      if (shapesOverlap(shape, zone.shape, 0.3)) issues.push(`${prop.id} intrudes into ${zone.id}`)
    }
  }
  for (let index = 0; index < plan.props.length; index += 1) {
    for (const other of plan.props.slice(index + 1)) {
      if (shapesOverlap(propFootprint(plan.props[index]), propFootprint(other), 0.35)) issues.push(`${plan.props[index].id} conflicts with ${other.id}`)
    }
  }
  for (let index = 0; index < plan.structures.length; index += 1) {
    const structure = plan.structures[index]
    const bounds = shapeBounds(structure.footprint)
    const corners = [[bounds.minX, bounds.minZ], [bounds.minX, bounds.maxZ], [bounds.maxX, bounds.minZ], [bounds.maxX, bounds.maxZ]]
    if (corners.some(([x, z]) => (x / plan.boundary.radiusX) ** 2 + (z / plan.boundary.radiusZ) ** 2 >= 1)) issues.push(`${structure.id} footprint leaves the safe island boundary`)
    // The landing is a traversable support surface; other structures must leave routes clear.
    if (structure.kind !== 'landing') {
      for (const route of plan.routes) {
        if (shapesOverlap(structure.footprint, { type: 'capsule', from: route.from, to: route.to, radius: route.width / 2 }, 0.2)) issues.push(`${structure.id} blocks path-${route.id}`)
      }
    }
    for (const other of plan.structures.slice(index + 1)) {
      if (shapesOverlap(plan.structures[index].footprint, other.footprint, 0.1)) issues.push(`${plan.structures[index].id} conflicts with ${other.id}`)
    }
  }
  return issues
}
