import * as THREE from 'three'
import { expect, it } from 'vitest'
import { buildEnvironment } from '../world/buildEnvironment.ts'
import { WORLD_LAYOUT } from '../world/layout.ts'
import { selectTarget } from './InteractionSystem.ts'

it('allows activation when aiming at the center seam of the lighthouse entrance', () => {
  const scene = new THREE.Scene()
  const world = buildEnvironment(scene, WORLD_LAYOUT, { debug: false })
  try {
    const object = world.structures.get('lighthouse')?.getObjectByName('lighthouse-entrance')
    if (!object) throw new Error('Missing lighthouse entrance interaction assembly')
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 1.7, -22.2)
    camera.lookAt(0, 1.72, -23.85)
    const target = { id: 'beacon', object, prompt: 'Activate', enabled: () => true, interact: () => undefined }
    expect(selectTarget(camera, [target], world.occluders, 2.5)?.id).toBe('beacon')
  } finally { world.dispose() }
})
