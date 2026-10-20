import * as THREE from 'three'
import type { EnvironmentWorld } from '../buildEnvironment.ts'
import { PbrMaterialLibrary } from './PbrMaterialLibrary.ts'
import type { PbrSurface } from './PbrMaterialLibrary.ts'

export type EnvironmentMaterialHandle = { ready: Promise<string[]>; dispose(): void }

/** Bind by authored material role and explicit mesh names; never modify effect materials. */
export function applyEnvironmentMaterials(scene: THREE.Scene, world: EnvironmentWorld, library: PbrMaterialLibrary): EnvironmentMaterialHandle {
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  const bindings = new Map<string, { surface: PbrSurface; trim: boolean; meshes: THREE.Mesh[] }>()
  const lighthouse = world.structures.get('lighthouse')
  const tower = lighthouse?.getObjectByName('octagonal-tower')
  const base = lighthouse?.getObjectByName('tower-foundation')
  const stone = tower instanceof THREE.Mesh ? tower.material : null
  const edging = base instanceof THREE.Mesh ? base.material : null
  let disposed = false
  function schedule(mesh: THREE.Mesh, surface: PbrSurface, trim = false): void {
    const key = `${surface}:${trim}`
    const group = bindings.get(key)
    if (group) group.meshes.push(mesh)
    else bindings.set(key, { surface, trim, meshes: [mesh] })
  }
  for (const placement of world.plan.structures) {
    const group = world.structures.get(placement.id)
    group?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      if (object.name === 'entrance-door' || object.name === 'mausoleum-door' || object.name === 'landing-mooring-post') schedule(object, 'wood')
      else if (['balcony-rail', 'lantern-frame', 'spire-finial', 'door-seam'].includes(object.name)) schedule(object, 'iron')
      else if (object.material === stone || object.material === edging) {
        const surface = placement.kind === 'grave' ? (placement.variant === 1 ? 'rock' : 'grave') : placement.kind === 'lighthouse' || placement.kind === 'mausoleum' ? 'masonry' : 'rock'
        schedule(object, surface, object.material === edging)
      } else if (['buttress-pinnacle', 'mausoleum-pinnacle', 'gothic-spire', 'mausoleum-gable', 'lantern-base'].includes(object.name)) schedule(object, 'slate')
    })
  }
  const root = scene.getObjectByName('world:environment')
  root?.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (object.name === 'dead-trunk' || object.name === 'dead-branch') schedule(object, 'bark')
    else if (object.name === 'coastal-rock' || object.name === 'coastal-cliffs') schedule(object, 'rock')
  })
  function bind(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial): void {
    original.set(mesh, mesh.material)
    mesh.material = material
  }
  const tasks: { name: string; promise: Promise<void> }[] = [...bindings].map(([name, group]) => ({
    name,
    promise: library.get(group.surface, group.trim).then((material) => { if (!disposed) for (const mesh of group.meshes) bind(mesh, material) }),
  }))
  const terrain = scene.getObjectByName('island-terrain')
  tasks.push({ name: 'ground', promise: library.getGround().then((material) => { if (!disposed && terrain instanceof THREE.Mesh) bind(terrain, material) }) })
  return {
    ready: Promise.allSettled(tasks.map((task) => task.promise)).then((results) => results.flatMap((result, index) => result.status === 'rejected' ? [`${tasks[index].name}: texture loading failed; original material retained`] : [])),
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const [mesh, material] of original) mesh.material = material
      original.clear()
      library.dispose()
    },
  }
}
