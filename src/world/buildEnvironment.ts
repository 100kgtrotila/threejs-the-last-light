import * as THREE from 'three'
import type { WorldLayout } from './layout.ts'
import { createEnvironmentLayout, propFootprint, validateEnvironmentLayout } from './environmentLayout.ts'
import type { EnvironmentLayout } from './environmentLayout.ts'
import { buildStructure } from './buildLandmarks.ts'
import type { EnvironmentMaterials } from './buildLandmarks.ts'
import { buildNature } from './buildNature.ts'
import { buildTerrain, createTerrainSampler } from './terrain.ts'
import type { TerrainSampler } from './terrain.ts'
import { auditGeometry, validateScenePlacements } from './sceneValidation.ts'
import type { SpatialEntity } from './sceneValidation.ts'
import type { SpatialShape } from './spatial.ts'
import { disposeWorld, MeshLibrary } from './worldMeshes.ts'

function outlineShape(group: THREE.Group, shape: SpatialShape, color: THREE.ColorRepresentation, name: string, heightAt: TerrainSampler): void {
  const points: THREE.Vector3[] = []
  function point(x: number, z: number): void { points.push(new THREE.Vector3(x, heightAt(x, z) + 0.16, z)) }
  if (shape.type === 'circle') {
    for (let step = 0; step < 48; step += 1) {
      const angle = step / 48 * Math.PI * 2
      point(shape.x + Math.cos(angle) * shape.radius, shape.z + Math.sin(angle) * shape.radius)
    }
  } else if (shape.type === 'box') {
    point(shape.x - shape.halfX, shape.z - shape.halfZ)
    point(shape.x + shape.halfX, shape.z - shape.halfZ)
    point(shape.x + shape.halfX, shape.z + shape.halfZ)
    point(shape.x - shape.halfX, shape.z + shape.halfZ)
  } else {
    const angle = Math.atan2(shape.to.z - shape.from.z, shape.to.x - shape.from.x)
    for (let step = 0; step <= 20; step += 1) {
      const theta = angle + Math.PI / 2 + step / 20 * Math.PI
      point(shape.from.x + Math.cos(theta) * shape.radius, shape.from.z + Math.sin(theta) * shape.radius)
    }
    for (let step = 0; step <= 20; step += 1) {
      const theta = angle - Math.PI / 2 + step / 20 * Math.PI
      point(shape.to.x + Math.cos(theta) * shape.radius, shape.to.z + Math.sin(theta) * shape.radius)
    }
  }
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, depthTest: false }))
  line.name = name
  line.renderOrder = 5
  group.add(line)
}

function addDebug(root: THREE.Group, plan: EnvironmentLayout, entities: SpatialEntity[], issues: string[], heightAt: TerrainSampler): void {
  const debug = new THREE.Group()
  debug.name = 'debug:exclusions'
  root.add(debug)
  const axes = new THREE.AxesHelper(9)
  axes.position.y = 0.3
  debug.add(axes)
  for (const zone of plan.exclusions) outlineShape(debug, zone.shape, '#5ba2c2', `exclusion:${zone.id}`, heightAt)
  for (const entity of entities) {
    const invalid = issues.some((issue) => issue.includes(entity.id))
    outlineShape(debug, entity.footprint, invalid ? '#ff5454' : '#e7bd75', `collider:${entity.id}`, heightAt)
    if (invalid || !entity.id.startsWith('tree-') && !entity.id.startsWith('bush-') && !entity.id.startsWith('rock-')) {
      const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(entity.object), invalid ? '#ff5454' : '#c4c9a3')
      helper.name = `bounds:${entity.id}`
      debug.add(helper)
    }
  }
  for (const site of plan.artifactSites) {
    const marker = new THREE.AxesHelper(2.2)
    marker.position.set(site.position.x, 0.2, site.position.z)
    marker.name = `anchor:${site.id}`
    debug.add(marker)
  }
  // Diagnostics must remain legible through the production fog and foreground meshes.
  debug.traverse((object) => {
    if (!(object instanceof THREE.Line)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (material instanceof THREE.LineBasicMaterial) {
        material.fog = false
        material.depthTest = false
      }
    }
    object.renderOrder = 5
  })
}

export type EnvironmentWorld = {
  issues: string[]
  plan: EnvironmentLayout
  structures: ReadonlyMap<string, THREE.Group>
  occluders: readonly THREE.Object3D[]
  heightAt: TerrainSampler
  dispose(): void
}

export function buildEnvironment(scene: THREE.Scene, layout: WorldLayout, options: { debug: boolean }): EnvironmentWorld {
  const plan = createEnvironmentLayout(layout)
  const heightAt = createTerrainSampler(plan)
  const root = new THREE.Group()
  root.name = 'world:environment'
  scene.add(root)
  const meshes = new MeshLibrary()
  const material: EnvironmentMaterials = {
    stone: new THREE.MeshStandardMaterial({ color: '#737b7b', roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: '#939b94', roughness: 0.92 }),
    slate: new THREE.MeshStandardMaterial({ color: '#24343d', roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: '#111e26', roughness: 0.85 }),
    bark: new THREE.MeshStandardMaterial({ color: '#45403d', roughness: 1 }),
    foliage: new THREE.MeshStandardMaterial({ color: '#3a4638', roughness: 1, flatShading: true }),
    rock: new THREE.MeshStandardMaterial({ color: '#566267', roughness: 1, flatShading: true }),
    brass: new THREE.MeshStandardMaterial({ color: '#b29b68', metalness: 0.45, roughness: 0.6 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#bba77a', emissive: '#e4b563', emissiveIntensity: 0.6, roughness: 0.8 }),
  }
  buildTerrain(root, layout, plan.routes, heightAt)
  const entities: SpatialEntity[] = []
  const structures = new Map<string, THREE.Group>()
  function place(id: string, group: THREE.Group, footprint: SpatialShape, x: number, z: number, penetration: number): void {
    root.add(group)
    group.position.set(x, 0, z)
    group.updateWorldMatrix(true, true)
    const groundY = heightAt(x, z)
    let supportGap = Infinity
    const vertex = new THREE.Vector3()
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const position = object.geometry.getAttribute('position')
      for (let index = 0; index < position.count; index += 1) {
        vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld)
        supportGap = Math.min(supportGap, vertex.y - heightAt(vertex.x, vertex.z))
      }
    })
    group.position.y = -supportGap - penetration
    entities.push({ id, object: group, footprint, groundY, allowedPenetration: penetration + 0.01 })
  }
  for (const structure of plan.structures) {
    const group = buildStructure(structure, meshes, material)
    structures.set(structure.id, group)
    place(structure.id, group, structure.footprint, structure.footprint.x, structure.footprint.z, 0)
  }
  for (const prop of plan.props) {
    place(prop.id, buildNature(prop, meshes, material), propFootprint(prop), prop.position.x, prop.position.z, prop.kind === 'rock' ? 0.12 : 0.03)
  }
  const issues = [...validateEnvironmentLayout(plan), ...validateScenePlacements(root, entities, heightAt), ...auditGeometry(root)]
  if (options.debug) addDebug(root, plan, entities, issues, heightAt)
  return { issues, plan, structures, occluders: entities.map((entity) => entity.object), heightAt, dispose: () => { disposeWorld(root); structures.clear() } }
}
