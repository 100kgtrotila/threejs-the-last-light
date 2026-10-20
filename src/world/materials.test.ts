import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { PbrMaterialLibrary } from './materials/PbrMaterialLibrary.ts'
import { applyPbrPilot } from './materials/pbrPilot.ts'
import { buildEnvironment } from './buildEnvironment.ts'
import { WORLD_LAYOUT } from './layout.ts'

describe('PBR pilot resource ownership', () => {
  it('caches concurrent material requests and shares correctly classified textures across variants', async () => {
    const load = vi.fn(async () => new THREE.Texture())
    const library = new PbrMaterialLibrary(load, 2)
    const [body, same, trim] = await Promise.all([library.get('masonry'), library.get('masonry'), library.get('masonry', true)])
    expect(body).toBe(same)
    expect(trim).not.toBe(body)
    expect(trim.map).toBe(body.map)
    expect(load).toHaveBeenCalledTimes(3)
    expect(body.map?.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(body.normalMap?.colorSpace).toBe(THREE.NoColorSpace)
    expect(body.roughnessMap?.colorSpace).toBe(THREE.NoColorSpace)
    expect(body.map?.wrapS).toBe(THREE.RepeatWrapping)
    expect(body.map?.anisotropy).toBe(2)
    expect(body.metalness).toBe(0)
    const disposed = vi.fn()
    body.map?.addEventListener('dispose', disposed)
    library.dispose()
    library.dispose()
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  it('disposes textures that finish loading after teardown', async () => {
    const pending: Array<(texture: THREE.Texture) => void> = []
    const library = new PbrMaterialLibrary(() => new Promise((resolve) => pending.push(resolve)))
    const request = library.get('grave').catch(() => null)
    library.dispose()
    const disposed = vi.fn()
    for (const resolve of pending) {
      const texture = new THREE.Texture()
      texture.addEventListener('dispose', disposed)
      resolve(texture)
    }
    expect(await request).toBeNull()
    expect(disposed).toHaveBeenCalledTimes(3)
  })
})

describe('PBR pilot scope', () => {
  it('changes only approved material bindings, preserving all geometry, transforms and world data', async () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    const plan = JSON.stringify(world.plan)
    const before = new Map<THREE.Mesh, { material: THREE.Material | THREE.Material[]; geometry: THREE.BufferGeometry; matrix: number[]; attributes: object }>()
    scene.updateMatrixWorld(true)
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) before.set(object, { material: object.material, geometry: object.geometry, matrix: object.matrixWorld.toArray(), attributes: { ...object.geometry.attributes } })
    })
    const pilot = applyPbrPilot(scene, world, new PbrMaterialLibrary(async () => new THREE.Texture()))
    expect(await pilot.ready).toEqual([])
    const terrain = scene.getObjectByName('island-terrain')
    if (!(terrain instanceof THREE.Mesh) || !(terrain.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing terrain fixture')
    // The regional tint belongs in the shader mask, never on the whole terrain.
    expect(terrain.material.color.getHex()).toBe(0xffffff)
    const approvedGroups = new Set(world.plan.structures.filter((placement) => placement.kind === 'lighthouse' || placement.kind === 'grave').map((placement) => world.structures.get(placement.id)))
    let changed = 0
    for (const [mesh, previous] of before) {
      expect(mesh.geometry).toBe(previous.geometry)
      expect(mesh.geometry.attributes).toEqual(previous.attributes)
      expect(mesh.matrixWorld.toArray()).toEqual(previous.matrix)
      if (mesh.material === previous.material) continue
      changed += 1
      let parent: THREE.Object3D | null = mesh
      while (parent && !approvedGroups.has(parent instanceof THREE.Group ? parent : undefined)) parent = parent.parent
      expect(mesh.name === 'island-terrain' || parent !== null).toBe(true)
    }
    expect(changed).toBeGreaterThan(30)
    expect(JSON.stringify(world.plan)).toBe(plan)
    pilot.dispose()
    for (const [mesh, previous] of before) expect(mesh.material).toBe(previous.material)
    world.dispose()
  })

  it('retains original surfaces when an asset family fails and safely tears down in-flight work', async () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    const tower = scene.getObjectByName('octagonal-tower')
    if (!(tower instanceof THREE.Mesh)) throw new Error('Missing tower fixture')
    const original = tower.material
    const pilot = applyPbrPilot(scene, world, new PbrMaterialLibrary(async () => { throw new Error('offline') }))
    expect(await pilot.ready).toHaveLength(3)
    expect(tower.material).toBe(original)
    pilot.dispose()
    const late = applyPbrPilot(scene, world, new PbrMaterialLibrary(async () => new THREE.Texture()))
    late.dispose()
    await late.ready
    expect(tower.material).toBe(original)
    world.dispose()
  })
})
