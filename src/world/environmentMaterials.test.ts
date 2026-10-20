import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { PbrMaterialLibrary } from './materials/PbrMaterialLibrary.ts'
import { applyEnvironmentMaterials } from './materials/environmentMaterials.ts'
import { buildEnvironment } from './buildEnvironment.ts'
import { WORLD_LAYOUT } from './layout.ts'

function snapshotAttributes(geometry: THREE.BufferGeometry): Record<string, number[]> {
  return Object.fromEntries(Object.keys(geometry.attributes).map((name) => [name, Array.from(geometry.getAttribute(name).array)]))
}

describe('complete environment materials', () => {
  it('textures architectural, natural, wooden and metal surfaces without changing geometry or spatial data', async () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: true })
    const plan = JSON.stringify(world.plan)
    const before = new Map<THREE.Mesh, { material: THREE.Material | THREE.Material[]; geometry: THREE.BufferGeometry; attributes: object; matrix: number[] }>()
    scene.updateMatrixWorld(true)
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) before.set(object, { material: object.material, geometry: object.geometry, attributes: snapshotAttributes(object.geometry), matrix: object.matrixWorld.toArray() })
    })
    const load = vi.fn(async () => new THREE.Texture())
    const materials = applyEnvironmentMaterials(scene, world, new PbrMaterialLibrary(load))
    expect(await materials.ready).toEqual([])
    for (const name of ['mausoleum-walls', 'dead-trunk', 'dead-branch', 'entrance-door', 'mausoleum-door', 'landing-mooring-post', 'balcony-rail', 'coastal-rock', 'coastal-cliffs', 'island-terrain', 'stone-dial-face']) {
      const mesh = scene.getObjectByName(name)
      if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing ${name}`)
      expect(mesh.material, name).not.toBe(before.get(mesh)?.material)
    }
    for (const name of ['dark-ocean', 'pointed-window-inset', 'headstone-inset', 'empty-site-socket', 'lantern-light', 'bush-center']) {
      const mesh = scene.getObjectByName(name)
      if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing ${name}`)
      expect(mesh.material, name).toBe(before.get(mesh)?.material)
    }
    for (const [mesh, saved] of before) {
      expect(mesh.geometry).toBe(saved.geometry)
      expect(snapshotAttributes(mesh.geometry)).toEqual(saved.attributes)
      expect(mesh.matrixWorld.toArray()).toEqual(saved.matrix)
    }
    expect(JSON.stringify(world.plan)).toBe(plan)
    expect(load).toHaveBeenCalledTimes(21)
    materials.dispose()
    for (const [mesh, saved] of before) expect(mesh.material).toBe(saved.material)
    world.dispose()
  })

  it('shares the packed rust roughness/metalness map and caches stone variants', async () => {
    const load = vi.fn(async () => new THREE.Texture())
    const library = new PbrMaterialLibrary(load)
    const metal = await library.get('iron')
    expect(metal.metalness).toBe(1)
    expect(metal.metalnessMap).toBe(metal.roughnessMap)
    expect(metal.metalnessMap?.colorSpace).toBe(THREE.NoColorSpace)
    const stone = await library.get('rock')
    const grave = await library.get('grave')
    expect(stone.map).toBe(grave.map)
    expect(load).toHaveBeenCalledTimes(6)
    library.dispose()
  })

  it('keeps the original bark if a bark map fails while other surfaces still load', async () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    const trunk = scene.getObjectByName('dead-trunk')
    if (!(trunk instanceof THREE.Mesh)) throw new Error('Missing trunk fixture')
    const original = trunk.material
    const materials = applyEnvironmentMaterials(scene, world, new PbrMaterialLibrary(async (url) => {
      if (url.includes('bark_willow_nor_gl')) throw new Error('offline')
      return new THREE.Texture()
    }))
    const failures = await materials.ready
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('bark')
    expect(trunk.material).toBe(original)
    const tower = scene.getObjectByName('octagonal-tower')
    if (!(tower instanceof THREE.Mesh) || !(tower.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing tower fixture')
    expect(tower.material.map).not.toBeNull()
    materials.dispose()
    world.dispose()
  })

  it('does not resurrect material bindings or retain late textures after early teardown', async () => {
    const scene = new THREE.Scene()
    const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
    const trunk = scene.getObjectByName('dead-trunk')
    if (!(trunk instanceof THREE.Mesh)) throw new Error('Missing trunk fixture')
    const original = trunk.material
    const disposed = vi.fn()
    const materials = applyEnvironmentMaterials(scene, world, new PbrMaterialLibrary(async () => {
      const texture = new THREE.Texture()
      texture.addEventListener('dispose', disposed)
      return texture
    }))
    materials.dispose()
    materials.dispose()
    await materials.ready
    expect(trunk.material).toBe(original)
    expect(disposed).toHaveBeenCalledTimes(21)
    world.dispose()
  })
})
