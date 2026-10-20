import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WORLD_LAYOUT } from './layout.ts'
import { buildEnvironment } from './buildEnvironment.ts'
import { auditGeometry, validateScenePlacements } from './sceneValidation.ts'
import { disposeWorld, MeshLibrary } from './worldMeshes.ts'

describe('environment geometry', () => {
  it('builds grounded, separated entities with valid geometry and three empty artifact sites', () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: true })
    expect(world.issues).toEqual([])
    expect(scene.getObjectByName('structure:lighthouse')).toBeDefined()
    expect(scene.getObjectByName('structure:mausoleum-north')).toBeDefined()
    expect(scene.getObjectByName('structure:site-wave')).toBeDefined()
    expect(scene.getObjectByName('debug:exclusions')).toBeDefined()
    expect(auditGeometry(scene)).toEqual([])
    world.dispose()
    expect(scene.children).toHaveLength(0)
  })

  it('updates world matrices and does not confuse overlapping bounds with overlapping circles', () => {
    const root = new THREE.Group()
    const material = new THREE.MeshBasicMaterial()
    const first = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), material)
    const second = first.clone()
    first.position.set(0, 0.5, 0)
    second.position.set(1.6, 0.5, 1.6)
    root.add(first, second)
    expect(validateScenePlacements(root, [
      { id: 'a', object: first, footprint: { type: 'circle', x: 0, z: 0, radius: 1 }, groundY: 0, allowedPenetration: 0.02 },
      { id: 'b', object: second, footprint: { type: 'circle', x: 1.6, z: 1.6, radius: 1 }, groundY: 0, allowedPenetration: 0.02 },
    ])).toEqual([])
    first.geometry.dispose()
    material.dispose()
  })

  it('allows deliberate ground embedding and reports a floating prop', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
    root.add(mesh)
    mesh.position.y = 0.45
    const entity = { id: 'stone', object: mesh, footprint: { type: 'circle' as const, x: 0, z: 0, radius: 1 }, groundY: 0, allowedPenetration: 0.1 }
    expect(validateScenePlacements(root, [entity])).toEqual([])
    mesh.position.y = 1
    expect(validateScenePlacements(root, [entity]).some((issue) => issue.includes('floating'))).toBe(true)
    mesh.geometry.dispose()
    mesh.material.dispose()
  })

  it('reports degenerate and duplicated triangles', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0,
    ], 3))
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
    const issues = auditGeometry(mesh)
    expect(issues.some((issue) => issue.includes('degenerate'))).toBe(true)
    expect(issues.some((issue) => issue.includes('duplicate triangle'))).toBe(true)
    geometry.dispose()
    mesh.material.dispose()
  })

  it('reports geometry extending beyond its authored collider', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4), new THREE.MeshBasicMaterial())
    mesh.position.y = 0.5
    root.add(mesh)
    expect(validateScenePlacements(root, [{
      id: 'undersized', object: mesh, footprint: { type: 'circle', x: 0, z: 0, radius: 1 }, groundY: 0, allowedPenetration: 0,
    }]).some((issue) => issue.includes('outside its collider'))).toBe(true)
    mesh.geometry.dispose()
    mesh.material.dispose()
  })

  it('uses one cross silhouette without duplicated cap area at its joint', () => {
    const group = new THREE.Group()
    const mesh = new MeshLibrary().cross(group, 'cross', new THREE.MeshBasicMaterial(), 1, 2, 0.2, 0.2, 0.2, [0, 0, 0])
    const position = mesh.geometry.getAttribute('position')
    const normal = mesh.geometry.getAttribute('normal')
    let area = 0
    for (let index = 0; index < position.count; index += 3) {
      if (normal.getZ(index) < 0.99) continue
      const ax = position.getX(index), ay = position.getY(index)
      const bx = position.getX(index + 1), by = position.getY(index + 1)
      const cx = position.getX(index + 2), cy = position.getY(index + 2)
      area += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2
    }
    expect(area).toBeCloseTo(0.56, 5)
    disposeWorld(group)
  })

  it('supports the entire lighthouse foundation on the rendered terrain', () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    scene.updateMatrixWorld(true)
    const terrain = scene.getObjectByName('island-terrain')
    const foundation = scene.getObjectByName('tower-foundation')
    if (!(terrain instanceof THREE.Mesh) || !(foundation instanceof THREE.Mesh)) throw new Error('Missing terrain fixture')
    const position = foundation.geometry.getAttribute('position')
    const ray = new THREE.Raycaster()
    const vertex = new THREE.Vector3()
    for (let index = 0; index < position.count; index += 1) {
      if (position.getY(index) > -0.29) continue
      vertex.fromBufferAttribute(position, index).applyMatrix4(foundation.matrixWorld)
      ray.set(new THREE.Vector3(vertex.x, 50, vertex.z), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObject(terrain)[0]
      expect(hit).toBeDefined()
      expect(Math.abs(vertex.y - hit.point.y)).toBeLessThan(0.03)
    }
    world.dispose()
  })

  it('embeds the actual rotated rock geometry rather than its approximate bounding box', () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    scene.updateMatrixWorld(true)
    const terrain = scene.getObjectByName('island-terrain')
    const rock = scene.getObjectByName('prop:rock-31')
    if (!(terrain instanceof THREE.Mesh) || !rock) throw new Error('Missing rock fixture')
    const ray = new THREE.Raycaster()
    const vertex = new THREE.Vector3()
    let gap = Infinity
    rock.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const position = object.geometry.getAttribute('position')
      for (let index = 0; index < position.count; index += 1) {
        vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld)
        ray.set(new THREE.Vector3(vertex.x, 50, vertex.z), new THREE.Vector3(0, -1, 0))
        const hit = ray.intersectObject(terrain)[0]
        if (hit) gap = Math.min(gap, vertex.y - hit.point.y)
      }
    })
    expect(gap).toBeLessThan(0)
    expect(gap).toBeGreaterThan(-0.16)
    world.dispose()
  })

  it('keeps the lighthouse lantern and roof connected to their supporting masonry', () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    scene.updateMatrixWorld(true)
    for (const [lowerName, upperName] of [
      ['octagonal-tower', 'lantern-balcony'],
      ['lantern-balcony', 'lantern-base'],
      ['lantern-cornice', 'gothic-spire'],
    ]) {
      const lower = scene.getObjectByName(lowerName)
      const upper = scene.getObjectByName(upperName)
      if (!lower || !upper) throw new Error('Missing lighthouse assembly')
      expect(new THREE.Box3().setFromObject(upper, true).min.y - new THREE.Box3().setFromObject(lower, true).max.y).toBeLessThanOrEqual(0.001)
    }
    world.dispose()
  })
})
