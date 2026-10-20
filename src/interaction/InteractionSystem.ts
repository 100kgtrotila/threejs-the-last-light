import * as THREE from 'three'

export type InteractionTarget = { id: string; object: THREE.Object3D; prompt: string; enabled: () => boolean; interact: () => void }

function visibleInWorld(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

export function selectTarget(camera: THREE.PerspectiveCamera, targets: readonly InteractionTarget[], occluders: readonly THREE.Object3D[], maxDistance: number): InteractionTarget | null {
  camera.updateWorldMatrix(true, false)
  occluders.forEach((object) => object.updateWorldMatrix(true, true))
  const ray = new THREE.Raycaster()
  ray.layers.enable(1)
  ray.far = maxDistance
  ray.setFromCamera(new THREE.Vector2(), camera)
  const hit = ray.intersectObjects([...occluders], true).find((intersection) => visibleInWorld(intersection.object))
  if (!hit) return null
  let object: THREE.Object3D | null = hit.object
  while (object) {
    const target = targets.find((candidate) => candidate.object === object)
    if (target) return target.enabled() ? target : null
    object = object.parent
  }
  return null
}

export class InteractionSystem {
  private readonly camera: THREE.PerspectiveCamera
  private readonly occluders: readonly THREE.Object3D[]
  private readonly targets: InteractionTarget[] = []
  private readonly highlight = new THREE.Box3Helper(new THREE.Box3(), '#f0d18b')
  private selected: InteractionTarget | null = null

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, occluders: readonly THREE.Object3D[]) {
    this.camera = camera
    this.occluders = occluders
    this.highlight.name = 'interaction-highlight'
    this.highlight.visible = false
    scene.add(this.highlight)
  }

  register(target: InteractionTarget): void { this.targets.push(target) }

  update(): InteractionTarget | null {
    this.selected = selectTarget(this.camera, this.targets, this.occluders, 2.5)
    this.highlight.visible = this.selected !== null
    if (this.selected) this.highlight.box.setFromObject(this.selected.object, true)
    return this.selected
  }

  activate(): void { this.update()?.interact() }

  clear(): void {
    this.selected = null
    this.highlight.visible = false
  }

  dispose(): void {
    this.clear()
    this.highlight.removeFromParent()
    this.highlight.geometry.dispose()
    if (Array.isArray(this.highlight.material)) this.highlight.material.forEach((material) => material.dispose())
    else this.highlight.material.dispose()
    this.targets.length = 0
  }
}
