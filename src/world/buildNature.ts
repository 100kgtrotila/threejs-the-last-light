import * as THREE from 'three'
import type { EnvironmentMaterials } from './buildLandmarks.ts'
import type { PropPlacement } from './environmentLayout.ts'
import { MeshLibrary } from './worldMeshes.ts'

export function buildNature(prop: PropPlacement, meshes: MeshLibrary, material: EnvironmentMaterials): THREE.Group {
  const group = new THREE.Group()
  group.name = `prop:${prop.id}`
  if (prop.kind === 'tree') {
    meshes.cylinder(group, 'dead-trunk', material.bark, 0.12, 0.4, 5.8, [0, 2.9, 0], 7)
    const branches: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
      [[0, 2.6, 0], [1.65, 4.8, 0.3]],
      [[0, 3.4, 0], [-1.7, 5.4, 0.45]],
      [[0, 4.2, 0], [0.45, 6.8, -0.4]],
      [[0, 3.1, 0], [0.35, 4.7, -1.6]],
      [[1.05, 4.0, 0.2], [1.8, 5.2, 0.8]],
      [[-1.1, 4.7, 0.3], [-1.6, 5.9, -0.4]],
    ]
    for (const [start, end] of branches) {
      const a = new THREE.Vector3(...start)
      const b = new THREE.Vector3(...end)
      const direction = b.clone().sub(a)
      const branch = meshes.cylinder(group, 'dead-branch', material.bark, 0.035, 0.14, direction.length(), a.clone().add(b).multiplyScalar(0.5).toArray(), 5)
      branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    }
  } else if (prop.kind === 'bush') {
    meshes.stone(group, 'bush-center', material.foliage, [0, 0.35, 0], [0.7, 0.52, 0.65])
    meshes.stone(group, 'bush-side', material.foliage, [-0.4, 0.25, 0.05], [0.43, 0.38, 0.45])
    meshes.stone(group, 'bush-side', material.foliage, [0.38, 0.25, -0.12], [0.43, 0.36, 0.42])
  } else {
    const rock = meshes.stone(group, 'coastal-rock', material.rock, [0, 0, 0], [1, 0.65, 0.83])
    rock.rotation.set(0.1, 0.25, 0.16)
  }
  group.rotation.y = prop.yaw
  group.scale.setScalar(prop.scale)
  return group
}
