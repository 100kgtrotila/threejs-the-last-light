import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Atmosphere } from './Atmosphere.ts'
import { buildEnvironment } from '../world/buildEnvironment.ts'
import { WORLD_LAYOUT } from '../world/layout.ts'
import { createWorldColliders } from '../physics/worldColliders.ts'
import { selectTarget } from '../interaction/InteractionSystem.ts'
import { auditGeometry } from '../world/sceneValidation.ts'

function fixture() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
  const moon = new THREE.DirectionalLight(), ambient = new THREE.HemisphereLight()
  scene.add(moon, ambient)
  const atmosphere = new Atmosphere(scene, camera, world, { moon, ambient })
  return { scene, camera, world, atmosphere }
}

describe('atmosphere scene integration', () => {
  it('keeps every atmosphere mesh free of invalid normals and degenerate triangles', () => {
    const f = fixture()
    try { expect(auditGeometry(f.scene)).toEqual([]) }
    finally { f.atmosphere.dispose(); f.world.dispose() }
  })
  it('keeps layout, collider data, roots, and interaction geometry stable while animating', () => {
    const f = fixture()
    try {
      const before = JSON.stringify(createWorldColliders(f.world.plan))
      const entrance = f.world.structures.get('lighthouse')?.getObjectByName('lighthouse-entrance')
      if (!entrance) throw new Error('Missing entrance')
      const matrix = entrance.matrixWorld.clone()
      f.camera.position.set(0, 1.7, -22.2)
      f.camera.lookAt(0, 1.72, -23.85)
      f.atmosphere.update(1)
      f.scene.updateMatrixWorld(true)
      expect(entrance.matrixWorld.equals(matrix)).toBe(true)
      expect(JSON.stringify(createWorldColliders(f.world.plan))).toBe(before)
      const target = { id: 'entrance', object: entrance, prompt: '', enabled: () => true, interact: () => undefined }
      expect(selectTarget(f.camera, [target], f.world.occluders, 2.5)?.id).toBe('entrance')
      expect(f.world.issues).toEqual([])
    } finally { f.atmosphere.dispose(); f.world.dispose() }
  })

  it('adds no shadow-casting effect lights and restores borrowed resources on disposal', () => {
    const f = fixture()
    const effect = f.scene.getObjectByName('atmosphere')
    expect(effect).toBeDefined()
    effect?.traverse((object) => { if (object instanceof THREE.Light) expect(object.castShadow).toBe(false) })
    f.atmosphere.dispose()
    f.atmosphere.dispose()
    expect(f.scene.getObjectByName('atmosphere')).toBeUndefined()
    expect(f.scene.getObjectByName('wind-pivot')).toBeUndefined()
    expect(f.world.issues).toEqual([])
    f.world.dispose()
  })

  it('mounts the lighthouse lantern beside the front window with its light inside the glass', () => {
    const f = fixture()
    try {
      const lighthouse = f.world.structures.get('lighthouse')
      const lantern = f.scene.getObjectByName('lantern:lighthouse')
      const glass = f.scene.getObjectByName('lantern-glass')
      if (!lighthouse || !lantern || !(glass instanceof THREE.Mesh)) throw new Error('Missing lighthouse lantern assembly')
      const light = lantern.children.find((object): object is THREE.PointLight => object instanceof THREE.PointLight)
      if (!light) throw new Error('Missing lighthouse lantern light')
      expect(lantern.position.x - lighthouse.position.x).toBeLessThan(-0.6)
      expect(lantern.position.y).toBeLessThan(4.15)
      expect(lantern.position.z - lighthouse.position.z).toBeGreaterThan(2.9)
      expect(light.position.toArray()).toEqual(glass.position.toArray())
      expect(lantern.getObjectByName('lantern-bracket')).toBeDefined()
    } finally { f.atmosphere.dispose(); f.world.dispose() }
  })

  it('calms fog and completes the timed restoration only after the gameplay event', () => {
    const f = fixture()
    try {
      if (!(f.scene.fog instanceof THREE.FogExp2)) throw new Error('Missing atmospheric fog')
      const density = f.scene.fog.density
      f.atmosphere.update(8)
      expect(f.atmosphere.restored).toBe(false)
      f.atmosphere.setProgress({ phase: 'completed', collected: ['wave', 'thorn', 'grave'], puzzleProgress: 3 })
      f.atmosphere.update(3)
      expect(f.atmosphere.restored).toBe(false)
      f.atmosphere.update(4)
      expect(f.atmosphere.restored).toBe(true)
      expect(f.scene.fog.density).toBeLessThan(density)
    } finally { f.atmosphere.dispose(); f.world.dispose() }
  })

  it('keeps reduced-motion cameras and vegetation still and disables lightning', () => {
    const f = fixture()
    try {
      f.atmosphere.setReducedMotion(true)
      const view = f.camera.matrixWorld.clone()
      f.atmosphere.setProgress({ phase: 'completed', collected: ['wave', 'thorn', 'grave'], puzzleProgress: 3 })
      f.atmosphere.update(18.08)
      expect(f.camera.matrixWorld.equals(view)).toBe(true)
      f.scene.traverse((object) => { if (object.name === 'wind-pivot') expect(object.rotation.z).toBeCloseTo(0) })
    } finally { f.atmosphere.dispose(); f.world.dispose() }
  })

  it('does not consume the one-shot apparition outside a narrow camera frustum', () => {
    const f = fixture()
    try {
      const ghost = f.scene.getObjectByName('keeper-apparition')
      if (!ghost) throw new Error('Missing apparition')
      f.camera.aspect = 0.5
      f.camera.updateProjectionMatrix()
      f.camera.position.set(ghost.position.x, ghost.position.y + 1.6, ghost.position.z + 10)
      f.camera.rotation.y = THREE.MathUtils.degToRad(35)
      f.atmosphere.setProgress({ phase: 'exploration', collected: ['wave'], puzzleProgress: 0 })
      f.atmosphere.update(1)
      expect(ghost.visible).toBe(false)
      f.camera.rotation.y = 0
      f.atmosphere.update(1)
      expect(ghost.visible).toBe(true)
    } finally { f.atmosphere.dispose(); f.world.dispose() }
  })
})
