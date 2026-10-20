import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { selectTarget } from './InteractionSystem.ts'

function fixture(z: number) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial())
  object.position.z = z
  object.updateMatrixWorld(true)
  return { id: String(z), object, prompt: 'Inspect', enabled: () => true, interact: () => undefined }
}

describe('raycast interaction', () => {
  it('selects the nearest visible target within reach', () => {
    const camera = new THREE.PerspectiveCamera()
    const near = fixture(-1.4), far = fixture(-2.2)
    expect(selectTarget(camera, [far, near], [far.object, near.object], 2.5)?.id).toBe(near.id)
    near.object.geometry.dispose(); far.object.geometry.dispose()
    near.object.material.dispose(); far.object.material.dispose()
  })
  it('rejects targets behind solid geometry or beyond maximum reach', () => {
    const camera = new THREE.PerspectiveCamera()
    const target = fixture(-2.2), wall = fixture(-1)
    expect(selectTarget(camera, [target], [target.object, wall.object], 2.5)).toBeNull()
    expect(selectTarget(camera, [target], [target.object], 1)).toBeNull()
    target.object.geometry.dispose(); wall.object.geometry.dispose()
    target.object.material.dispose(); wall.object.material.dispose()
  })
  it('ignores hidden collected objects and never selects disabled targets', () => {
    const camera = new THREE.PerspectiveCamera()
    const near = fixture(-1), far = fixture(-2)
    near.object.visible = false
    expect(selectTarget(camera, [near, far], [near.object, far.object], 2.5)?.id).toBe(far.id)
    far.enabled = () => false
    expect(selectTarget(camera, [near, far], [near.object, far.object], 2.5)).toBeNull()
    near.object.geometry.dispose(); far.object.geometry.dispose()
    near.object.material.dispose(); far.object.material.dispose()
  })
})
