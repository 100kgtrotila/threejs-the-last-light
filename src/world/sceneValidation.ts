import * as THREE from 'three'
import { distanceToSegment, shapesOverlap } from './spatial.ts'
import type { SpatialShape } from './spatial.ts'
import type { TerrainSampler } from './terrain.ts'

export type SpatialEntity = {
  id: string
  object: THREE.Object3D
  footprint: SpatialShape
  groundY: number
  allowedPenetration: number
}

export function validateScenePlacements(root: THREE.Object3D, entities: readonly SpatialEntity[], heightAt?: TerrainSampler): string[] {
  root.updateWorldMatrix(true, true)
  const issues: string[] = []
  const bounds = entities.map((entity) => new THREE.Box3().setFromObject(entity.object))
  entities.forEach((entity, index) => {
    let contact = Infinity
    let outsideCollider = false
    const vertex = new THREE.Vector3()
    entity.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const position = object.geometry.getAttribute('position')
      for (let offset = 0; offset < position.count; offset += 1) {
        vertex.fromBufferAttribute(position, offset).applyMatrix4(object.matrixWorld)
        contact = Math.min(contact, vertex.y - (heightAt ? heightAt(vertex.x, vertex.z) : entity.groundY))
        const shape = entity.footprint
        const inside = shape.type === 'circle'
          ? Math.hypot(vertex.x - shape.x, vertex.z - shape.z) <= shape.radius + 0.03
          : shape.type === 'box'
            ? Math.abs(vertex.x - shape.x) <= shape.halfX + 0.03 && Math.abs(vertex.z - shape.z) <= shape.halfZ + 0.03
            : distanceToSegment({ x: vertex.x, z: vertex.z }, shape.from, shape.to) <= shape.radius + 0.03
        if (!inside) outsideCollider = true
      }
    })
    if (contact > 0.01) issues.push(`${entity.id} is floating by ${contact.toFixed(3)} units`)
    if (contact < -entity.allowedPenetration - 0.03) issues.push(`${entity.id} penetrates the ground beyond its allowed support contact`)
    if (outsideCollider) issues.push(`${entity.id} has geometry outside its collider`)
    for (let other = index + 1; other < entities.length; other += 1) {
      // Box3 only selects candidate pairs. Authored circle/box shapes decide collider conflicts.
      if (bounds[index].intersectsBox(bounds[other]) && shapesOverlap(entity.footprint, entities[other].footprint)) {
        issues.push(`${entity.id} collider conflicts with ${entities[other].id}`)
      }
    }
  })
  return issues
}

export function auditGeometry(root: THREE.Object3D): string[] {
  const issues: string[] = []
  const visited = new Set<THREE.BufferGeometry>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || visited.has(object.geometry)) return
    const geometry = object.geometry
    visited.add(geometry)
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    if (!position) return
    const label = object.name || 'unnamed mesh'
    if (!normal || normal.count !== position.count) issues.push(`${label}: missing or inconsistent normals`)
    for (let index = 0; index < position.count; index += 1) {
      if (![position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite)) {
        issues.push(`${label}: nonfinite vertex`)
        break
      }
    }
    if (normal) {
      for (let index = 0; index < normal.count; index += 1) {
        const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index))
        if (!Number.isFinite(length) || Math.abs(length - 1) > 0.01) {
          issues.push(`${label}: invalid vertex normal`)
          break
        }
      }
    }
    const indexAttribute = geometry.getIndex()
    const count = indexAttribute ? indexAttribute.count : position.count
    const triangles = new Set<string>()
    let degenerate = false
    let duplicate = false
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const edge = new THREE.Vector3()
    const cross = new THREE.Vector3()
    for (let offset = 0; offset < count; offset += 3) {
      const indices = [0, 1, 2].map((step) => indexAttribute ? indexAttribute.getX(offset + step) : offset + step)
      a.fromBufferAttribute(position, indices[0])
      b.fromBufferAttribute(position, indices[1])
      c.fromBufferAttribute(position, indices[2])
      cross.subVectors(b, a).cross(edge.subVectors(c, a))
      if (cross.lengthSq() < 1e-14) degenerate = true
      const key = [a, b, c].map((vertex) => [vertex.x, vertex.y, vertex.z].map((value) => value.toFixed(6)).join(',')).sort().join('|')
      if (triangles.has(key)) duplicate = true
      triangles.add(key)
    }
    if (degenerate) issues.push(`${label}: degenerate triangle`)
    if (duplicate) issues.push(`${label}: duplicate triangle`)
  })
  return issues
}
