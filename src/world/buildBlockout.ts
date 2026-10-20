import * as THREE from 'three'
import type { LandmarkId, Point2, WorldLayout } from './layout.ts'

type BlockoutOptions = { debug: boolean }

function addMesh(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3Tuple,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...position)
  group.add(mesh)
  return mesh
}

function addPath(group: THREE.Group, from: Point2, to: Point2, width: number, height: number, material: THREE.Material): void {
  const deltaX = to.x - from.x
  const deltaZ = to.z - from.z
  const length = Math.hypot(deltaX, deltaZ)
  const path = addMesh(
    group,
    'path',
    new THREE.BoxGeometry(width, 0.035, length),
    material,
    [(from.x + to.x) / 2, height, (from.z + to.z) / 2],
  )
  path.rotation.y = Math.atan2(deltaX, deltaZ)
}

function addTree(group: THREE.Group, x: number, z: number, height: number, material: THREE.Material): void {
  addMesh(group, 'tree-trunk', new THREE.CylinderGeometry(0.2, 0.48, height, 7), material, [x, height / 2, z])
  const branch = addMesh(group, 'tree-branch', new THREE.CylinderGeometry(0.08, 0.16, height * 0.48, 5), material, [x + 0.45, height * 0.66, z])
  branch.rotation.z = -0.65
}

function createLandmarkGroup(root: THREE.Group, id: LandmarkId, anchor: Point2): THREE.Group {
  const group = new THREE.Group()
  group.name = `landmark:${id}`
  group.position.set(anchor.x, 0, anchor.z)
  root.add(group)
  return group
}

function addDebugOverlay(root: THREE.Group, landmarkGroups: Record<LandmarkId, THREE.Group>, layout: WorldLayout): void {
  const debug = new THREE.Group()
  debug.name = 'debug:overlay'
  root.add(debug)

  const axes = new THREE.AxesHelper(10)
  axes.name = 'debug:axes'
  axes.position.y = 0.15
  debug.add(axes)

  const boundaryPoints: THREE.Vector3[] = []
  for (let index = 0; index < 96; index += 1) {
    const angle = index / 96 * Math.PI * 2
    boundaryPoints.push(new THREE.Vector3(
      Math.cos(angle) * layout.safeBoundary.radiusX,
      0.16,
      Math.sin(angle) * layout.safeBoundary.radiusZ,
    ))
  }
  const boundary = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(boundaryPoints),
    new THREE.LineBasicMaterial({ color: '#e0d27b' }),
  )
  boundary.name = 'debug:boundary'
  debug.add(boundary)

  for (const corridor of layout.corridors) {
    const deltaX = corridor.to.x - corridor.from.x
    const deltaZ = corridor.to.z - corridor.from.z
    const length = Math.hypot(deltaX, deltaZ)
    if (length === 0) continue
    const offsetX = -deltaZ / length * corridor.width / 2
    const offsetZ = deltaX / length * corridor.width / 2
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(corridor.from.x + offsetX, 0.2, corridor.from.z + offsetZ),
        new THREE.Vector3(corridor.to.x + offsetX, 0.2, corridor.to.z + offsetZ),
        new THREE.Vector3(corridor.to.x - offsetX, 0.2, corridor.to.z - offsetZ),
        new THREE.Vector3(corridor.from.x - offsetX, 0.2, corridor.from.z - offsetZ),
      ]),
      new THREE.LineBasicMaterial({ color: '#92d9d0' }),
    )
    outline.name = `debug:corridor:${corridor.id}`
    debug.add(outline)
  }

  for (const [id, group] of Object.entries(landmarkGroups)) {
    const bounds = new THREE.Box3().setFromObject(group)
    const helper = new THREE.Box3Helper(bounds, '#e8b06b')
    helper.name = `debug:landmark:${id}`
    debug.add(helper)

    const marker = addMesh(
      debug,
      `debug:anchor:${id}`,
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#f2d38b' }),
      [group.position.x, 0.28, group.position.z],
    )
    marker.renderOrder = 1
  }

  for (const footprint of layout.footprints.filter((item) => item.solid)) {
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 32 }, (_, index) => {
          const angle = index / 32 * Math.PI * 2
          return new THREE.Vector3(
            footprint.center.x + Math.cos(angle) * footprint.radius,
            0.18,
            footprint.center.z + Math.sin(angle) * footprint.radius,
          )
        }),
      ),
      new THREE.LineBasicMaterial({ color: '#f06a68' }),
    )
    ring.name = `debug:footprint:${footprint.id}`
    debug.add(ring)
  }
}

export function buildBlockout(scene: THREE.Scene, layout: WorldLayout, options: BlockoutOptions): { dispose(): void } {
  const root = new THREE.Group()
  root.name = 'world:blockout'
  scene.add(root)

  const groundMaterial = new THREE.MeshStandardMaterial({ color: '#506455', roughness: 1 })
  const cliffMaterial = new THREE.MeshStandardMaterial({ color: '#39443e', roughness: 1 })
  const pathMaterial = new THREE.MeshStandardMaterial({ color: '#8b8670', roughness: 1 })
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#777b74', roughness: 1 })
  const darkStoneMaterial = new THREE.MeshStandardMaterial({ color: '#484e50', roughness: 1 })
  const woodMaterial = new THREE.MeshStandardMaterial({ color: '#3e3432', roughness: 1 })

  const water = addMesh(root, 'water', new THREE.PlaneGeometry(230, 230), new THREE.MeshBasicMaterial({ color: '#243d45' }), [0, -2.05, 0])
  water.rotation.x = -Math.PI / 2

  const cliff = addMesh(root, 'island-cliff', new THREE.CylinderGeometry(1, 1, 2, 80, 1, true), cliffMaterial, [0, -1, 0])
  cliff.scale.set(layout.visibleBoundary.radiusX, 1, layout.visibleBoundary.radiusZ)
  const ground = addMesh(root, 'island-ground', new THREE.CircleGeometry(1, 80), groundMaterial, [0, 0, 0])
  ground.rotation.x = -Math.PI / 2
  ground.scale.set(layout.visibleBoundary.radiusX, layout.visibleBoundary.radiusZ, 1)

  layout.corridors.forEach((corridor, index) => {
    addPath(root, corridor.from, corridor.to, corridor.width, 0.04 + index * 0.012, pathMaterial)
  })

  const landmarkGroups: Record<LandmarkId, THREE.Group> = {
    landing: createLandmarkGroup(root, 'landing', layout.landmarks.landing),
    shore: createLandmarkGroup(root, 'shore', layout.landmarks.shore),
    cemetery: createLandmarkGroup(root, 'cemetery', layout.landmarks.cemetery),
    grove: createLandmarkGroup(root, 'grove', layout.landmarks.grove),
    dial: createLandmarkGroup(root, 'dial', layout.landmarks.dial),
    lighthouse: createLandmarkGroup(root, 'lighthouse', layout.landmarks.lighthouse),
  }

  const landing = landmarkGroups.landing
  addMesh(landing, 'landing-platform', new THREE.CylinderGeometry(4, 4, 0.12, 24), stoneMaterial, [0, 0.06, 0])
  addMesh(landing, 'landing-marker', new THREE.BoxGeometry(0.28, 1.6, 0.28), darkStoneMaterial, [3, 0.8, 0])

  const shore = landmarkGroups.shore
  addMesh(shore, 'shore-marker', new THREE.CylinderGeometry(1.8, 2.2, 0.22, 10), stoneMaterial, [0, 0.11, 0])
  addMesh(shore, 'shore-post-left', new THREE.BoxGeometry(0.25, 1.5, 0.25), woodMaterial, [-2.6, 0.75, -0.8])
  addMesh(shore, 'shore-post-right', new THREE.BoxGeometry(0.25, 1.2, 0.25), woodMaterial, [2.6, 0.6, -0.8])

  const cemetery = landmarkGroups.cemetery
  addMesh(cemetery, 'cemetery-plinth', new THREE.BoxGeometry(3, 0.3, 2), darkStoneMaterial, [0, 0.15, 0])
  for (const x of [-3, 0, 3]) {
    for (const z of [-4, 4]) {
      addMesh(cemetery, 'grave-marker', new THREE.BoxGeometry(0.9, 1.3, 0.28), stoneMaterial, [x, 0.65, z])
    }
  }

  const grove = landmarkGroups.grove
  addTree(grove, 3, 3, 5.4, woodMaterial)
  addTree(grove, -2, 4, 4.4, woodMaterial)
  addTree(grove, 4, -4, 4.9, woodMaterial)

  const dial = landmarkGroups.dial
  addMesh(dial, 'dial-plinth', new THREE.CylinderGeometry(1.6, 1.9, 0.7, 12), stoneMaterial, [0, 0.35, 0])
  addMesh(dial, 'dial-face', new THREE.CylinderGeometry(1.35, 1.35, 0.08, 12), darkStoneMaterial, [0, 0.74, 0])

  const lighthouse = landmarkGroups.lighthouse
  addMesh(lighthouse, 'lighthouse-base', new THREE.CylinderGeometry(4, 4, 0.8, 16), darkStoneMaterial, [0, 0.4, 0])
  addMesh(lighthouse, 'lighthouse-shaft', new THREE.CylinderGeometry(2.4, 3.2, 17, 12), stoneMaterial, [0, 9.3, 0])
  addMesh(lighthouse, 'lighthouse-lantern', new THREE.CylinderGeometry(2.7, 2.7, 1.5, 12), darkStoneMaterial, [0, 18.55, 0])
  addMesh(lighthouse, 'lighthouse-roof', new THREE.ConeGeometry(3.2, 3, 12), darkStoneMaterial, [0, 20.8, 0])
  addMesh(lighthouse, 'lighthouse-door', new THREE.BoxGeometry(1.45, 2.3, 0.14), woodMaterial, [0, 1.15, 3.25])

  root.updateMatrixWorld(true)
  if (options.debug) addDebugOverlay(root, landmarkGroups, layout)

  return {
    dispose(): void {
      root.removeFromParent()
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry)
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
          objectMaterials.forEach((material) => materials.add(material))
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
    },
  }
}
