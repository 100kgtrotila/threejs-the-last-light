import * as THREE from 'three'
import type { EnvironmentWorld } from '../buildEnvironment.ts'
import { PbrMaterialLibrary } from './PbrMaterialLibrary.ts'
import type { PbrSurface } from './PbrMaterialLibrary.ts'

export type PbrPilot = { ready: Promise<string[]>; dispose(): void }

/** Replace only selected bindings. Restore them before the world disposes shared originals. */
export function applyPbrPilot(scene: THREE.Scene, world: EnvironmentWorld, library: PbrMaterialLibrary): PbrPilot {
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  let disposed = false
  const lighthouse = world.structures.get('lighthouse')
  const tower = lighthouse?.getObjectByName('octagonal-tower')
  const foundation = lighthouse?.getObjectByName('tower-foundation')
  const stone = tower instanceof THREE.Mesh ? tower.material : undefined
  const trim = foundation instanceof THREE.Mesh ? foundation.material : undefined

  function bind(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial): void {
    original.set(mesh, mesh.material)
    mesh.material = material
  }
  async function structures(surface: PbrSurface, groups: readonly THREE.Group[]): Promise<void> {
    const [body, edging] = await Promise.all([library.get(surface), library.get(surface, true)])
    if (disposed) return
    for (const group of groups) group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      if (object.material === stone) bind(object, body)
      else if (object.material === trim) bind(object, edging)
    })
  }
  const graves = world.plan.structures.filter((placement) => placement.kind === 'grave')
    .flatMap((placement) => { const group = world.structures.get(placement.id); return group ? [group] : [] })
  const terrain = scene.getObjectByName('island-terrain')
  const tasks = [
    structures('masonry', lighthouse ? [lighthouse] : []),
    structures('grave', graves),
    library.get('terrain').then((material) => { if (!disposed && terrain instanceof THREE.Mesh) bind(terrain, material) }),
  ]
  return {
    ready: Promise.allSettled(tasks).then((results) => results.flatMap((result, index) => result.status === 'rejected' ? [`${['masonry', 'grave', 'terrain'][index]}: texture loading failed; original material retained`] : [])),
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const [mesh, material] of original) mesh.material = material
      original.clear()
      library.dispose()
    },
  }
}
