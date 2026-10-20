import * as THREE from 'three'
import { buildEnvironment } from '../world/buildEnvironment.ts'
import type { EnvironmentWorld } from '../world/buildEnvironment.ts'
import { Gameplay } from './Gameplay.ts'
import { Atmosphere } from './Atmosphere.ts'
import type { AtmosphereConfig } from './Atmosphere.ts'
import { WORLD_LAYOUT } from '../world/layout.ts'
import { validateLayout } from '../world/validateLayout.ts'
import { showRenderFailure } from '../ui/renderFailure.ts'
import { PbrMaterialLibrary } from '../world/materials/PbrMaterialLibrary.ts'
import { applyEnvironmentMaterials } from '../world/materials/environmentMaterials.ts'
import type { EnvironmentMaterialHandle } from '../world/materials/environmentMaterials.ts'

export class Game {
  private readonly host: HTMLElement
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(65, 1, 0.1, 350)
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly resizeObserver: ResizeObserver
  private readonly world: EnvironmentWorld
  private readonly gameplay: Gameplay | null
  private readonly atmosphere: Atmosphere
  private readonly environmentMaterials: EnvironmentMaterialHandle
  private readonly listeners = new AbortController()
  private readonly reviewMode = import.meta.env.DEV && new URLSearchParams(location.search).has('view')
  private readonly sunlight: THREE.DirectionalLight
  private started = false
  private disposed = false
  private rendered = false
  private lastFrameTime: number | null = null
  private renderFailure: HTMLElement | null = null

  constructor(host: HTMLElement, options: { atmosphere?: Partial<AtmosphereConfig> } = {}) {
    this.host = host
    const layoutErrors = validateLayout(WORLD_LAYOUT)
    if (layoutErrors.length > 0) throw new Error(layoutErrors.join('; '))

    this.scene.background = new THREE.Color('#182b36')
    this.scene.fog = new THREE.Fog('#182b36', 100, 300)
    const ambient = new THREE.HemisphereLight('#b4c9df', '#28313a', 0.65)
    this.scene.add(ambient)
    const sunlight = new THREE.DirectionalLight('#d4e1ec', 2.5)
    this.sunlight = sunlight
    sunlight.position.set(-35, 55, 30)
    sunlight.castShadow = true
    sunlight.shadow.mapSize.set(2048, 2048)
    sunlight.shadow.camera.left = -53
    sunlight.shadow.camera.right = 53
    sunlight.shadow.camera.top = 50
    sunlight.shadow.camera.bottom = -50
    sunlight.shadow.camera.near = 1
    sunlight.shadow.camera.far = 150
    sunlight.shadow.normalBias = 0.035
    sunlight.shadow.bias = -0.00005
    this.scene.add(sunlight)

    this.world = buildEnvironment(this.scene, WORLD_LAYOUT, {
      debug: import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === '1',
    })
    this.host.dataset.spatialIssues = String(this.world.issues.length)
    if (this.world.issues.length > 0) console.error('World validation failed:', this.world.issues)

    this.scene.add(this.camera)
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    this.atmosphere = new Atmosphere(this.scene, this.camera, this.world, { moon: sunlight, ambient }, { reducedMotion: motion.matches, ...options.atmosphere })
    motion.addEventListener('change', (event) => this.atmosphere.setReducedMotion(event.matches), { signal: this.listeners.signal })
    this.gameplay = this.reviewMode ? null : new Gameplay(this.scene, this.camera, this.renderer.domElement, host, this.world, WORLD_LAYOUT, (snapshot) => this.atmosphere.setProgress(snapshot))
    this.environmentMaterials = applyEnvironmentMaterials(this.scene, this.world, new PbrMaterialLibrary(undefined, this.renderer.capabilities.getMaxAnisotropy()))
    void this.environmentMaterials.ready.then((failures) => {
      if (this.disposed) return
      this.host.dataset.materialsReady = 'true'
      if (failures.length > 0) console.warn('Environment materials:', failures.join('; '))
    })
    if (this.reviewMode) this.setReviewView()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      if (this.renderFailure || this.disposed) return
      this.renderer.setAnimationLoop(null)
      if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock()
      this.renderFailure = showRenderFailure(this.host, 'The graphics connection was lost. Reload the game to restore it. Current progress will restart.')
    }, { signal: this.listeners.signal })
  }

  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    this.host.append(this.renderer.domElement)
    this.resizeObserver.observe(this.host)
    this.resize()
    this.renderer.setAnimationLoop((time) => {
      const delta = this.lastFrameTime === null ? 0 : Math.min(0.1, (time - this.lastFrameTime) / 1000)
      this.lastFrameTime = time
      if (document.hidden || this.host.clientWidth === 0 || this.host.clientHeight === 0) return
      this.gameplay?.update(delta)
      this.atmosphere.update(delta, this.gameplay?.exploring ?? false)
      if (this.atmosphere.restored) this.gameplay?.finishRestoration()
      this.renderer.render(this.scene, this.camera)
      if (!this.rendered) {
        this.rendered = true
        this.host.dataset.sceneReady = 'true'
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.started = false
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.listeners.abort()
    this.gameplay?.dispose()
    this.atmosphere.dispose()
    this.environmentMaterials.dispose()
    this.world.dispose()
    this.sunlight.dispose()
    this.renderer.dispose()
    // This renderer/canvas will never be reused; release its context and engine-owned GPU caches too.
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    this.renderFailure?.remove()
    delete this.host.dataset.sceneReady
    delete this.host.dataset.spatialIssues
    delete this.host.dataset.renderFailed
    delete this.host.dataset.materialsReady
  }

  private resize(): void {
    const width = this.host.clientWidth
    const height = this.host.clientHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    if (this.reviewMode) this.setReviewView()
    this.renderer.setSize(width, height, false)
  }

  private setReviewView(): void {
    const view = new URLSearchParams(window.location.search).get('view')
    const { landmarks } = WORLD_LAYOUT
    switch (view) {
      case 'overview':
        {
          const scale = Math.max(1, 0.83 / this.camera.aspect)
          this.camera.position.set(44 * scale, 62 * scale, -3 + 58 * scale)
        }
        this.camera.lookAt(0, 0, -3)
        break
      case 'west':
        this.camera.position.set(-4, 1.7, -2)
        this.camera.lookAt(landmarks.cemetery.x, 2, landmarks.cemetery.z)
        break
      case 'east':
        this.camera.position.set(4, 1.7, 2)
        this.camera.lookAt(landmarks.grove.x, 2, landmarks.grove.z)
        break
      case 'dial':
        this.camera.position.set(13, 1.7, -10)
        this.camera.lookAt(landmarks.dial.x - 3, 3, landmarks.dial.z - 6)
        break
      case 'cemetery':
        this.camera.position.set(-12, 5, 11)
        this.camera.lookAt(-25, 1.8, -3)
        break
      case 'coast':
        this.camera.position.set(54, 13, 42)
        this.camera.lookAt(6, 0, -4)
        break
      default:
        this.camera.position.set(landmarks.landing.x, 1.7, landmarks.landing.z)
        this.camera.lookAt(landmarks.lighthouse.x, 4, landmarks.lighthouse.z)
    }
  }
}
