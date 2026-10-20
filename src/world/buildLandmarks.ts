import * as THREE from 'three'
import type { StructurePlacement } from './environmentLayout.ts'
import { MeshLibrary } from './worldMeshes.ts'

export type EnvironmentMaterials = Record<'stone' | 'trim' | 'slate' | 'dark' | 'bark' | 'foliage' | 'rock' | 'brass' | 'lamp', THREE.MeshStandardMaterial>

function buildLighthouse(group: THREE.Group, meshes: MeshLibrary, material: EnvironmentMaterials): void {
  meshes.cylinder(group, 'tower-foundation', material.trim, 4.3, 4.3, 0.6, [0, 0.3, 0])
  const tower = meshes.cylinder(group, 'octagonal-tower', material.stone, 3, 3, 17, [0, 9.1, 0])
  tower.rotation.y = -Math.PI / 8
  for (const y of [0.8, 7.1, 12.4, 17.5]) meshes.cylinder(group, 'masonry-course', material.trim, 3.12, 3.12, 0.18, [0, y, 0])

  for (let side = 0; side < 4; side += 1) {
    const angle = Math.PI / 4 + side * Math.PI / 2
    const buttress = new THREE.Group()
    buttress.position.set(Math.sin(angle) * 3.15, 0, Math.cos(angle) * 3.15)
    buttress.rotation.y = angle
    group.add(buttress)
    meshes.box(buttress, 'buttress-foot', material.trim, [0.8, 0.9, 1.6], [0, 0.45, 0])
    meshes.box(buttress, 'buttress-column', material.stone, [0.62, 9.4, 0.8], [0, 5.1, -0.15])
    meshes.spire(buttress, 'buttress-pinnacle', material.slate, 0.5, 1.8, [0, 9.8, -0.15], 4)
  }
  for (let side = 0; side < 4; side += 1) {
    const angle = side * Math.PI / 2
    for (const y of [4.2, 9.2, 14.1]) {
      const window = new THREE.Group()
      window.position.set(Math.sin(angle) * 2.79, y, Math.cos(angle) * 2.79)
      window.rotation.y = angle
      group.add(window)
      meshes.arch(window, 'pointed-window-frame', material.trim, 1.05, 2.15, 0.22, [0, 0, 0])
      meshes.arch(window, 'pointed-window-inset', material.dark, 0.73, 1.8, 0.035, [0, 0.13, 0.13])
      meshes.box(window, 'window-mullion', material.stone, [0.065, 1.42, 0.06], [0, 0.86, 0.18])
      meshes.box(window, 'window-sill', material.trim, [1.24, 0.15, 0.4], [0, 0, 0.08])
    }
  }
  const entrance = new THREE.Group()
  entrance.name = 'lighthouse-entrance'
  group.add(entrance)
  meshes.arch(entrance, 'entrance-surround', material.trim, 1.9, 3.1, 0.35, [0, 0.6, 2.85])
  meshes.arch(entrance, 'entrance-door', material.dark, 1.48, 2.7, 0.12, [0, 0.67, 3.08])
  meshes.box(entrance, 'door-seam', material.brass, [0.035, 2.05, 0.025], [0, 1.72, 3.15])

  meshes.cylinder(group, 'lantern-balcony', material.trim, 3.65, 3.3, 0.4, [0, 17.8, 0])
  meshes.cylinder(group, 'lantern-base', material.slate, 2.9, 2.9, 0.3, [0, 18.15, 0])
  meshes.cylinder(group, 'lantern-light', material.lamp, 1.45, 1.45, 2.1, [0, 19.35, 0])
  for (let side = 0; side < 8; side += 1) {
    const angle = side * Math.PI / 4
    meshes.box(group, 'lantern-frame', material.dark, [0.17, 2.7, 0.17], [Math.sin(angle) * 2.55, 19.65, Math.cos(angle) * 2.55])
    const rail = meshes.box(group, 'balcony-rail', material.dark, [2.5, 0.12, 0.13], [Math.sin(angle) * 3.25, 18.8, Math.cos(angle) * 3.25])
    rail.rotation.y = angle
    meshes.box(group, 'balcony-post', material.trim, [0.23, 0.9, 0.23], [Math.sin(angle) * 3.48, 18.45, Math.cos(angle) * 3.48])
  }
  meshes.cylinder(group, 'lantern-cornice', material.trim, 3.2, 3.2, 0.25, [0, 21.05, 0])
  meshes.spire(group, 'gothic-spire', material.slate, 3.6, 4.8, [0, 21.175, 0])
  meshes.box(group, 'spire-finial', material.dark, [0.1, 1.25, 0.1], [0, 26.5, 0])
}

function buildMausoleum(group: THREE.Group, meshes: MeshLibrary, material: EnvironmentMaterials, variant: number): void {
  meshes.box(group, 'mausoleum-foundation', material.trim, [4, 0.3, 5.2], [0, 0.15, 0])
  meshes.box(group, 'mausoleum-walls', material.stone, [3.7, 3.5, 4.8], [0, 2.05, 0])
  for (const x of [-1.7, 1.7]) {
    for (const z of [-2.3, 2.3]) {
      meshes.box(group, 'corner-pilaster', material.trim, [0.4, 3.6, 0.4], [x, 2.1, z])
      meshes.spire(group, 'mausoleum-pinnacle', material.slate, 0.32, 0.9, [x, 4.0, z], 4)
    }
  }
  const roofShape = new THREE.Shape()
  roofShape.moveTo(-2.2, 0)
  roofShape.lineTo(2.2, 0)
  roofShape.lineTo(0, 1.5 + variant * 0.25)
  roofShape.closePath()
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 5.4, bevelEnabled: false })
  roof.translate(0, 0, -2.7)
  meshes.mesh(group, 'mausoleum-gable', roof, material.slate, [0, 3.8, 0])
  meshes.arch(group, 'mausoleum-door-frame', material.trim, 1.8, 2.9, 0.24, [0, 0.3, 2.48])
  meshes.arch(group, 'mausoleum-door', material.dark, 1.4, 2.5, 0.03, [0, 0.4, 2.62])
  meshes.cross(group, 'mausoleum-cross', material.trim, 0.65, 0.9, 0.14, 0.14, 0.15, [0, 5.05 + variant * 0.25, 0])
}

function buildGrave(group: THREE.Group, meshes: MeshLibrary, material: EnvironmentMaterials, variant: number): void {
  meshes.box(group, 'grave-base', material.trim, [1.2, 0.16, 1.1], [0, 0.08, 0])
  if (variant === 0) {
    meshes.arch(group, 'pointed-headstone', material.stone, 0.85, 1.5, 0.23, [0, 0.16, -0.15])
    meshes.box(group, 'headstone-inset', material.dark, [0.46, 0.5, 0.025], [0, 0.82, -0.02])
  } else if (variant === 1) {
    meshes.cross(group, 'grave-cross', material.stone, 1, 1.7, 0.22, 0.23, 0.25, [0, 0.16, -0.1])
  } else {
    meshes.box(group, 'grave-pillar', material.stone, [0.56, 1.25, 0.56], [0, 0.785, 0])
    meshes.spire(group, 'grave-obelisk', material.trim, 0.43, 0.65, [0, 1.41, 0], 4)
  }
}

export function buildStructure(placement: StructurePlacement, meshes: MeshLibrary, material: EnvironmentMaterials): THREE.Group {
  const group = new THREE.Group()
  group.name = `structure:${placement.id}`
  switch (placement.kind) {
    case 'lighthouse': buildLighthouse(group, meshes, material); break
    case 'mausoleum': buildMausoleum(group, meshes, material, placement.variant); break
    case 'grave': buildGrave(group, meshes, material, placement.variant); break
    case 'altar':
      meshes.cylinder(group, 'artifact-site-base', material.trim, 1.2, 1.25, 0.2, [0, 0.1, 0])
      meshes.cylinder(group, 'empty-site-pedestal', material.stone, 0.62, 0.85, 0.85, [0, 0.625, 0], placement.variant === 2 ? 6 : 8)
      meshes.cylinder(group, 'empty-site-rim', material.trim, 0.82, 0.82, 0.18, [0, 1.14, 0])
      meshes.cylinder(group, 'empty-site-socket', material.dark, 0.49, 0.49, 0.025, [0, 1.2425, 0], 16)
      if (placement.variant === 1) meshes.arch(group, 'site-memorial', material.stone, 1.0, 1.9, 0.23, [0, 0.2, -0.78])
      break
    case 'landing':
      meshes.cylinder(group, 'landing-stonework', material.trim, 3.3, 3.3, 0.18, [0, 0.09, 0], 16)
      for (const x of [-2.6, 2.6]) meshes.box(group, 'landing-mooring-post', material.bark, [0.25, 1.4, 0.25], [x, 0.7, 1.2])
      break
    case 'dial':
      meshes.cylinder(group, 'stone-dial-base', material.trim, 1.55, 1.6, 0.35, [0, 0.175, 0])
      meshes.cylinder(group, 'stone-dial-face', material.stone, 1.25, 1.4, 0.5, [0, 0.6, 0])
      break
  }
  return group
}
