import type { Point2, WorldLayout } from './layout.ts'

function pointToSegmentDistance(point: Point2, start: Point2, end: Point2): number {
  const deltaX = end.x - start.x
  const deltaZ = end.z - start.z
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) / lengthSquared))
  return Math.hypot(point.x - start.x - projection * deltaX, point.z - start.z - projection * deltaZ)
}

function insideEllipse(point: Point2, radiusX: number, radiusZ: number): boolean {
  if (radiusX <= 0 || radiusZ <= 0) return false
  return (point.x / radiusX) ** 2 + (point.z / radiusZ) ** 2 <= 1
}

export function validateLayout(layout: WorldLayout): string[] {
  const errors: string[] = []
  const { radiusX, radiusZ } = layout.safeBoundary

  for (const [id, position] of Object.entries(layout.landmarks)) {
    if (!insideEllipse(position, radiusX, radiusZ)) {
      errors.push(`Landmark ${id} is outside the safe island boundary`)
    }
  }

  for (const corridor of layout.corridors) {
    const inset = corridor.width / 2 + layout.playerRadius + layout.clearance
    if (
      !insideEllipse(corridor.from, radiusX - inset, radiusZ - inset) ||
      !insideEllipse(corridor.to, radiusX - inset, radiusZ - inset)
    ) {
      errors.push(`Corridor ${corridor.id} leaves the safe island boundary`)
    }
  }

  const solidFootprints = layout.footprints.filter((footprint) => footprint.solid)
  for (const footprint of solidFootprints) {
    if (!insideEllipse(footprint.center, radiusX - footprint.radius, radiusZ - footprint.radius)) {
      errors.push(`Solid footprint ${footprint.id} is outside the safe island boundary`)
    }

    for (const corridor of layout.corridors) {
      const requiredDistance = footprint.radius + corridor.width / 2 + layout.playerRadius + layout.clearance
      if (pointToSegmentDistance(footprint.center, corridor.from, corridor.to) < requiredDistance) {
        errors.push(`Solid footprint ${footprint.id} blocks corridor ${corridor.id}`)
      }
    }
  }

  for (let first = 0; first < solidFootprints.length; first += 1) {
    for (let second = first + 1; second < solidFootprints.length; second += 1) {
      const left = solidFootprints[first]
      const right = solidFootprints[second]
      if (Math.hypot(left.center.x - right.center.x, left.center.z - right.center.z) < left.radius + right.radius + layout.clearance) {
        errors.push(`Solid footprints ${left.id} and ${right.id} overlap`)
      }
    }
  }

  return errors
}
