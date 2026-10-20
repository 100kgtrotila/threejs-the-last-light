import * as THREE from 'three'
import type { EnvironmentMaterials } from './buildLandmarks.ts'
import type { PropPlacement } from './environmentLayout.ts'
import { MeshLibrary } from './worldMeshes.ts'

export function buildNature(prop: PropPlacement, meshes: MeshLibrary, material: EnvironmentMaterials): THREE.Group {
  const group = new THREE.Group()
  group.name = `prop:${prop.id}`
  if (prop.kind === 'tree') {
    const trunk = meshes.cylinder(group, 'dead-trunk', material.bark, 0.09, 0.4, 1, [0, 2.9, 0], 8)
    trunk.scale.y = 5.8
    const branches: { path: [THREE.Vector3Tuple, THREE.Vector3Tuple, THREE.Vector3Tuple]; radii: [number, number, number] }[] = [
      { path: [[0, 2.05, 0], [0.45, 2.38, 0.08], [1.9, 2.68, 0.3]], radii: [0.15, 0.09, 0.035] },
      { path: [[0, 2.8, 0], [-0.42, 3.12, 0.12], [-2.0, 3.38, 0.48]], radii: [0.15, 0.09, 0.035] },
      { path: [[0, 3.42, 0], [0.34, 3.76, -0.12], [1.35, 4.42, -0.52]], radii: [0.12, 0.075, 0.03] },
      { path: [[0, 3.96, 0], [-0.34, 4.23, -0.08], [-1.48, 4.92, -0.5]], radii: [0.12, 0.075, 0.03] },
      { path: [[0, 4.5, 0], [0.24, 4.84, 0.12], [0.72, 5.72, 0.34]], radii: [0.12, 0.075, 0.03] },
      { path: [[0, 2.44, 0], [-0.22, 2.78, -0.48], [-0.9, 3.42, -1.48]], radii: [0.12, 0.075, 0.03] },
      { path: [[0, 3.1, 0], [0.22, 3.46, 0.42], [0.55, 4.08, 1.68]], radii: [0.12, 0.075, 0.03] },
    ]
    for (const branch of branches) {
      addTaperedSegment(group, meshes, material.bark, 'dead-branch', branch.path[0], branch.path[1], branch.radii[0], branch.radii[1])
      addTaperedSegment(group, meshes, material.bark, 'dead-branch', branch.path[1], branch.path[2], branch.radii[1], branch.radii[2])
    }
    const twigs: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
      [[0.72, 2.44, 0.13], [0.82, 2.88, 0.18]],
      [[-0.72, 3.18, 0.25], [-1.05, 3.53, 0.3]],
      [[0.62, 3.94, -0.24], [0.92, 4.22, -0.38]],
      [[-0.75, 4.58, -0.3], [-0.92, 4.92, -0.44]],
      [[0.36, 3.68, 0.92], [0.55, 3.94, 1.1]],
    ]
    for (const [start, end] of twigs) addTaperedSegment(group, meshes, material.bark, 'dead-twig', start, end, 0.05, 0.018)
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

function addTaperedSegment(
  parent: THREE.Group,
  meshes: MeshLibrary,
  material: THREE.Material,
  name: string,
  start: THREE.Vector3Tuple,
  end: THREE.Vector3Tuple,
  baseRadius: number,
  tipRadius: number,
): THREE.Mesh {
  const from = new THREE.Vector3(...start)
  const to = new THREE.Vector3(...end)
  const direction = to.clone().sub(from)
  const length = direction.length()
  const mesh = meshes.cylinder(parent, name, material, tipRadius, baseRadius, 1, from.clone().add(to).multiplyScalar(0.5).toArray(), 6)
  mesh.scale.y = length
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return mesh
}
