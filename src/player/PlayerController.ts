import * as THREE from 'three'
import type { Point2 } from '../world/layout.ts'
import type { SpatialShape } from '../world/spatial.ts'
import type { TerrainSampler } from '../world/terrain.ts'
import { movePlayer } from '../physics/collision.ts'
import { movementDelta } from './movement.ts'

type ControllerOptions = {
  canvas: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  spawn: Point2
  colliders: readonly SpatialShape[]
  boundary: { radiusX: number; radiusZ: number }
  floorHeight: TerrainSampler
  onActiveChange(active: boolean): void
  onInteract(): void
  onFlashlightChange(enabled: boolean): void
  onError(message: string): void
}

export class PlayerController {
  private readonly options: ControllerOptions
  private readonly listeners = new AbortController()
  private readonly keys = new Set<string>()
  private readonly flashlight = new THREE.SpotLight('#fff1d4', 50, 25, Math.PI / 7, 0.4, 1.5)
  private readonly flashlightTarget = new THREE.Object3D()
  private positionValue: Point2
  private yaw = 0
  private pitch = 0
  private disposed = false

  constructor(options: ControllerOptions) {
    this.options = options
    this.positionValue = { ...options.spawn }
    this.flashlight.position.set(0.12, -0.12, -0.15)
    this.flashlightTarget.position.set(0, 0, -1)
    this.flashlight.target = this.flashlightTarget
    options.camera.add(this.flashlight, this.flashlightTarget)
    this.syncCamera()
    const signal = this.listeners.signal
    document.addEventListener('pointerlockchange', () => {
      this.keys.clear()
      options.onActiveChange(this.active)
    }, { signal })
    document.addEventListener('pointerlockerror', () => options.onError('Mouse capture failed. Click Resume to try again.'), { signal })
    document.addEventListener('mousemove', (event) => {
      if (!this.active) return
      this.yaw -= event.movementX * 0.002
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.002, -1.45, 1.45)
      this.syncCamera()
    }, { signal })
    document.addEventListener('keydown', (event) => {
      if (!this.active) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'Escape'].includes(event.code)) event.preventDefault()
      this.keys.add(event.code)
      if (event.repeat) return
      if (event.code === 'KeyE') options.onInteract()
      if (event.code === 'KeyF') {
        this.flashlight.visible = !this.flashlight.visible
        options.onFlashlightChange(this.flashlight.visible)
      }
      if (event.code === 'Escape') this.release()
    }, { signal })
    document.addEventListener('keyup', (event) => this.keys.delete(event.code), { signal })
    window.addEventListener('blur', () => this.release(), { signal })
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release() }, { signal })
  }

  get active(): boolean { return !this.disposed && document.pointerLockElement === this.options.canvas }
  get position(): Readonly<Point2> { return this.positionValue }

  async requestLock(): Promise<void> {
    if (this.disposed) return
    try { await this.options.canvas.requestPointerLock() }
    catch { this.options.onError('Mouse capture is unavailable. Use a desktop browser and click Resume to try again.') }
  }

  release(): void {
    this.keys.clear()
    if (document.pointerLockElement === this.options.canvas) document.exitPointerLock()
  }

  update(deltaSeconds: number): void {
    if (!this.active) return
    const strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
    const forward = Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'))
    if (strafe === 0 && forward === 0) return
    const delta = movementDelta(strafe, forward, this.yaw, this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), deltaSeconds)
    this.positionValue = movePlayer(this.positionValue, delta, 0.35, this.options.colliders, this.options.boundary)
    this.syncCamera()
  }

  dispose(): void {
    if (this.disposed) return
    this.listeners.abort()
    this.release()
    this.disposed = true
    this.flashlight.removeFromParent()
    this.flashlightTarget.removeFromParent()
    this.flashlight.dispose()
  }

  private syncCamera(): void {
    this.options.camera.position.set(this.positionValue.x, this.options.floorHeight(this.positionValue.x, this.positionValue.z) + 1.7, this.positionValue.z)
    this.options.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }
}
