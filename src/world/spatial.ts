import type { Point2 } from './layout.ts'

export type CircleFootprint = { type: 'circle'; x: number; z: number; radius: number }
export type BoxFootprint = { type: 'box'; x: number; z: number; halfX: number; halfZ: number }
export type CapsuleFootprint = { type: 'capsule'; from: Point2; to: Point2; radius: number }
export type SpatialShape = CircleFootprint | BoxFootprint | CapsuleFootprint

export function distanceToSegment(point: Point2, from: Point2, to: Point2): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared))
  return Math.hypot(point.x - from.x - dx * t, point.z - from.z - dz * t)
}

function cross(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

function segmentDistance(a: Point2, b: Point2, c: Point2, d: Point2): number {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b))
}

function pointBoxDistance(point: Point2, box: BoxFootprint): number {
  return Math.hypot(Math.max(0, Math.abs(point.x - box.x) - box.halfX), Math.max(0, Math.abs(point.z - box.z) - box.halfZ))
}

function segmentBoxDistance(segment: CapsuleFootprint, box: BoxFootprint): number {
  if (pointBoxDistance(segment.from, box) === 0 || pointBoxDistance(segment.to, box) === 0) return 0
  const corners = [
    { x: box.x - box.halfX, z: box.z - box.halfZ },
    { x: box.x + box.halfX, z: box.z - box.halfZ },
    { x: box.x + box.halfX, z: box.z + box.halfZ },
    { x: box.x - box.halfX, z: box.z + box.halfZ },
  ]
  return Math.min(...corners.map((corner, index) => segmentDistance(segment.from, segment.to, corner, corners[(index + 1) % 4])))
}

export function shapeBounds(shape: SpatialShape): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (shape.type === 'capsule') return {
    minX: Math.min(shape.from.x, shape.to.x) - shape.radius,
    maxX: Math.max(shape.from.x, shape.to.x) + shape.radius,
    minZ: Math.min(shape.from.z, shape.to.z) - shape.radius,
    maxZ: Math.max(shape.from.z, shape.to.z) + shape.radius,
  }
  const halfX = shape.type === 'circle' ? shape.radius : shape.halfX
  const halfZ = shape.type === 'circle' ? shape.radius : shape.halfZ
  return { minX: shape.x - halfX, maxX: shape.x + halfX, minZ: shape.z - halfZ, maxZ: shape.z + halfZ }
}

export function shapesOverlap(a: SpatialShape, b: SpatialShape, clearance = 0): boolean {
  const left = shapeBounds(a)
  const right = shapeBounds(b)
  if (left.maxX + clearance <= right.minX || right.maxX + clearance <= left.minX || left.maxZ + clearance <= right.minZ || right.maxZ + clearance <= left.minZ) return false

  if (a.type === 'circle') {
    if (b.type === 'circle') return Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius + clearance
    if (b.type === 'box') return pointBoxDistance(a, b) < a.radius + clearance
    return distanceToSegment(a, b.from, b.to) < a.radius + b.radius + clearance
  }
  if (a.type === 'box') {
    if (b.type === 'circle') return shapesOverlap(b, a, clearance)
    if (b.type === 'box') return Math.abs(a.x - b.x) < a.halfX + b.halfX + clearance && Math.abs(a.z - b.z) < a.halfZ + b.halfZ + clearance
    return segmentBoxDistance(b, a) < b.radius + clearance
  }
  if (b.type !== 'capsule') return shapesOverlap(b, a, clearance)
  return segmentDistance(a.from, a.to, b.from, b.to) < a.radius + b.radius + clearance
}
