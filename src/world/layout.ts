export type Point2 = { x: number; z: number }
export type SymbolId = 'wave' | 'thorn' | 'grave'
export type LandmarkId =
  | 'landing'
  | 'shore'
  | 'cemetery'
  | 'grove'
  | 'dial'
  | 'lighthouse'

export type Footprint = {
  id: string
  center: Point2
  radius: number
  solid: boolean
}

export type Corridor = {
  id: string
  from: Point2
  to: Point2
  width: number
}

export type WorldLayout = {
  visibleBoundary: { radiusX: number; radiusZ: number }
  safeBoundary: { radiusX: number; radiusZ: number }
  playerRadius: number
  clearance: number
  landmarks: Record<LandmarkId, Point2>
  footprints: Footprint[]
  corridors: Corridor[]
}

export const WORLD_LAYOUT: WorldLayout = {
  visibleBoundary: { radiusX: 45, radiusZ: 35 },
  safeBoundary: { radiusX: 43, radiusZ: 33 },
  playerRadius: 0.35,
  clearance: 0.2,
  landmarks: {
    landing: { x: 0, z: 26 },
    shore: { x: -10, z: 23 },
    cemetery: { x: -22, z: -2 },
    grove: { x: 22, z: 2 },
    dial: { x: 7, z: -17 },
    lighthouse: { x: 0, z: -27 },
  },
  footprints: [
    { id: 'lighthouse-base', center: { x: 0, z: -27 }, radius: 4, solid: true },
    { id: 'grove-tree', center: { x: 25, z: 5 }, radius: 1, solid: true },
    { id: 'cemetery-stone', center: { x: -24, z: -6 }, radius: 0.8, solid: true },
  ],
  corridors: [
    { id: 'central', from: { x: 0, z: 26 }, to: { x: 0, z: -20 }, width: 4 },
    { id: 'west', from: { x: 0, z: -2 }, to: { x: -16, z: -2 }, width: 4 },
    { id: 'east', from: { x: 0, z: 2 }, to: { x: 16, z: 2 }, width: 4 },
    { id: 'shore', from: { x: 0, z: 26 }, to: { x: -7, z: 23 }, width: 4 },
  ],
}
