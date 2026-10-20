import * as THREE from 'three'
import type { Corridor, WorldLayout } from './layout.ts'
import type { EnvironmentLayout } from './environmentLayout.ts'
import { distanceToSegment } from './spatial.ts'

export type TerrainSampler = (x: number, z: number) => number

function naturalTerrainHeight(x: number, z: number): number {
  const radius = Math.hypot(x / 45, z / 35)
  const edge = Math.max(0, Math.min(1, (radius - 0.8) / 0.2))
  return edge * edge * (3 - 2 * edge) * (0.9 + Math.sin(x * 0.32 + z * 0.18) * 0.25)
}

export function createTerrainSampler(plan: EnvironmentLayout): TerrainSampler {
  return (x, z) => {
    let naturalBlend = 1
    for (const structure of plan.structures) {
      const shape = structure.footprint
      const distance = shape.type === 'circle'
        ? Math.max(0, Math.hypot(x - shape.x, z - shape.z) - shape.radius)
        : Math.hypot(Math.max(0, Math.abs(x - shape.x) - shape.halfX), Math.max(0, Math.abs(z - shape.z) - shape.halfZ))
      naturalBlend = Math.min(naturalBlend, THREE.MathUtils.smoothstep(distance, 0.65, 2))
    }
    return naturalTerrainHeight(x, z) * naturalBlend
  }
}

export function buildTerrain(root: THREE.Group, layout: WorldLayout, routes: readonly Corridor[], heightAt: TerrainSampler): void {
  const segments = 192
  const rings = 42
  const positions: number[] = [0, heightAt(0, 0), 0]
  const colors: number[] = []
  const indices: number[] = []
  const grass = new THREE.Color('#394640')
  const dirt = new THREE.Color('#756f61')
  const color = new THREE.Color()
  function addColor(x: number, z: number): void {
    const pathDistance = Math.min(...routes.map((route) => distanceToSegment({ x, z }, route.from, route.to) - route.width / 2))
    const pathBlend = THREE.MathUtils.smoothstep(pathDistance + Math.sin(x * 2 + z) * 0.08, -0.18, 0.3)
    color.copy(dirt).lerp(grass, pathBlend).multiplyScalar(0.94 + Math.sin(x * 2.3 + z * 1.7) * 0.045)
    colors.push(color.r, color.g, color.b)
  }
  addColor(0, 0)
  for (let ring = 1; ring <= rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2
      const coast = 1 + Math.sin(angle * 5) * 0.025 + Math.cos(angle * 9) * 0.015
      const x = Math.cos(angle) * layout.visibleBoundary.radiusX * coast * ring / rings
      const z = Math.sin(angle) * layout.visibleBoundary.radiusZ * coast * ring / rings
      positions.push(x, heightAt(x, z), z)
      addColor(x, z)
    }
  }
  for (let segment = 0; segment < segments; segment += 1) indices.push(0, 1 + (segment + 1) % segments, 1 + segment)
  for (let ring = 1; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const inner = 1 + (ring - 1) * segments + segment
      const nextInner = 1 + (ring - 1) * segments + (segment + 1) % segments
      const outer = inner + segments
      const nextOuter = nextInner + segments
      indices.push(inner, nextInner, outer, nextInner, nextOuter, outer)
    }
  }
  const groundGeometry = new THREE.BufferGeometry()
  groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  groundGeometry.setIndex(indices)
  groundGeometry.computeVertexNormals()
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  ground.name = 'island-terrain'
  ground.receiveShadow = true
  root.add(ground)

  const cliffVertices: number[] = []
  for (let segment = 0; segment < segments; segment += 1) {
    const a = (1 + (rings - 1) * segments + segment) * 3
    const b = (1 + (rings - 1) * segments + (segment + 1) % segments) * 3
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2]
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2]
    const angleA = segment / segments * Math.PI * 2
    const angleB = (segment + 1) / segments * Math.PI * 2
    const ledgeA = 1 + Math.sin(angleA * 13) * 0.025
    const ledgeB = 1 + Math.sin(angleB * 13) * 0.025
    const midA = [ax * ledgeA, -1.8 + Math.sin(angleA * 7) * 0.35, az * ledgeA]
    const midB = [bx * ledgeB, -1.8 + Math.sin(angleB * 7) * 0.35, bz * ledgeB]
    const bottomA = [ax * 1.025, -5.6, az * 1.025]
    const bottomB = [bx * 1.025, -5.6, bz * 1.025]
    cliffVertices.push(ax, ay, az, bx, by, bz, ...midA, bx, by, bz, ...midB, ...midA)
    cliffVertices.push(...midA, ...midB, ...bottomA, ...midB, ...bottomB, ...bottomA)
  }
  const cliffGeometry = new THREE.BufferGeometry()
  cliffGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cliffVertices, 3))
  cliffGeometry.computeVertexNormals()
  const cliff = new THREE.Mesh(cliffGeometry, new THREE.MeshStandardMaterial({ color: '#343d40', roughness: 1 }))
  cliff.name = 'coastal-cliffs'
  cliff.castShadow = true
  cliff.receiveShadow = true
  root.add(cliff)

  const oceanGeometry = new THREE.PlaneGeometry(650, 650, 160, 160)
  oceanGeometry.rotateX(-Math.PI / 2)
  const oceanPositions = oceanGeometry.getAttribute('position')
  for (let index = 0; index < oceanPositions.count; index += 1) {
    const x = oceanPositions.getX(index)
    const z = oceanPositions.getZ(index)
    oceanPositions.setY(index, Math.sin(x * 0.28 + z * 0.17) * 0.13 + Math.sin(z * 0.4 - x * 0.08) * 0.07)
  }
  oceanGeometry.computeVertexNormals()
  const ocean = new THREE.Mesh(oceanGeometry, new THREE.MeshStandardMaterial({ color: '#102c3a', metalness: 0.3, roughness: 0.48 }))
  ocean.name = 'dark-ocean'
  ocean.position.y = -4.1
  root.add(ocean)
}
