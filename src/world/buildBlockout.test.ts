import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildBlockout } from './buildBlockout.ts'
import { WORLD_LAYOUT } from './layout.ts'

describe('static world blockout', () => {
  it('places each landmark group at its authored anchor', () => {
    const scene = new THREE.Scene()
    const world = buildBlockout(scene, WORLD_LAYOUT, { debug: false })

    for (const [id, anchor] of Object.entries(WORLD_LAYOUT.landmarks)) {
      const group = scene.getObjectByName(`landmark:${id}`)
      expect(group?.position.x).toBe(anchor.x)
      expect(group?.position.z).toBe(anchor.z)
    }

    world.dispose()
  })

  it('grounds landmark geometry and keeps the dial and lighthouse masses separate', () => {
    const scene = new THREE.Scene()
    const world = buildBlockout(scene, WORLD_LAYOUT, { debug: false })
    scene.updateMatrixWorld(true)

    for (const id of Object.keys(WORLD_LAYOUT.landmarks)) {
      const group = scene.getObjectByName(`landmark:${id}`)
      expect(group).toBeDefined()
      const bounds = new THREE.Box3().setFromObject(group!)
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01)
      expect(bounds.min.y).toBeLessThanOrEqual(0.06)
    }

    const dial = scene.getObjectByName('landmark:dial')
    const lighthouse = scene.getObjectByName('landmark:lighthouse')
    expect(new THREE.Box3().setFromObject(dial!).intersectsBox(new THREE.Box3().setFromObject(lighthouse!))).toBe(false)

    world.dispose()
  })

  it('adds inspection helpers only in debug mode and removes owned scene content on dispose', () => {
    const scene = new THREE.Scene()
    const world = buildBlockout(scene, WORLD_LAYOUT, { debug: true })

    expect(scene.getObjectByName('debug:axes')).toBeDefined()
    expect(scene.getObjectByName('debug:boundary')).toBeDefined()
    expect(scene.getObjectByName('debug:landmark:lighthouse')).toBeDefined()
    expect(scene.getObjectByName('debug:corridor:central')).toBeDefined()

    world.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
