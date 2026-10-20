import * as THREE from 'three'
import { buildBlockout } from '../world/buildBlockout.ts'
import { WORLD_LAYOUT } from '../world/layout.ts'
import { validateLayout } from '../world/validateLayout.ts'

export class Game {
  private readonly host: HTMLElement
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(65, 1, 0.1, 350)
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly resizeObserver: ResizeObserver
  private readonly world: { dispose(): void }
  private started = false
  private rendered = false

  constructor(host: HTMLElement) {
    this.host = host
    const layoutErrors = validateLayout(WORLD_LAYOUT)
    if (layoutErrors.length > 0) throw new Error(layoutErrors.join('; '))

    this.scene.background = new THREE.Color('#283b43')
    this.scene.add(new THREE.HemisphereLight('#d6dcd7', '#394f48', 2.2))
    const sunlight = new THREE.DirectionalLight('#f4e7c8', 2.3)
    sunlight.position.set(-20, 35, 12)
    this.scene.add(sunlight)

    this.world = buildBlockout(this.scene, WORLD_LAYOUT, {
      debug: import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === '1',
    })

    this.setReviewView()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.resizeObserver = new ResizeObserver(() => this.resize())
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.host.append(this.renderer.domElement)
    this.resizeObserver.observe(this.host)
    this.resize()
    this.renderer.setAnimationLoop(() => {
      if (this.host.clientWidth === 0 || this.host.clientHeight === 0) return
      this.renderer.render(this.scene, this.camera)
      if (!this.rendered) {
        this.rendered = true
        this.host.dataset.sceneReady = 'true'
      }
    })
  }

  dispose(): void {
    if (!this.started) return
    this.started = false
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.world.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    delete this.host.dataset.sceneReady
  }

  private resize(): void {
    const width = this.host.clientWidth
    const height = this.host.clientHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.setReviewView()
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
      default:
        this.camera.position.set(landmarks.landing.x, 1.7, landmarks.landing.z)
        this.camera.lookAt(landmarks.lighthouse.x, 4, landmarks.lighthouse.z)
    }
  }
}
