import * as THREE from 'three'
import type { EnvironmentWorld } from '../world/buildEnvironment.ts'
import type { GameSnapshot } from './GameState.ts'
import { AtmosphereClock, smoothProgress } from './atmosphereTimeline.ts'
import { animateOcean } from './oceanAnimation.ts'
import { disposeWorld, MeshLibrary } from '../world/worldMeshes.ts'

export type AtmosphereConfig = {
  fogDensity: number
  beamSpeed: number
  ocean: boolean
  wind: boolean
  lanterns: boolean
  lightning: boolean
  apparition: boolean
  reducedMotion: boolean
}

export const ATMOSPHERE_CONFIG: Readonly<AtmosphereConfig> = {
  fogDensity: 0.0175, beamSpeed: 0.22, ocean: true, wind: true,
  lanterns: true, lightning: true, apparition: true, reducedMotion: false,
}

type Lighting = { moon: THREE.DirectionalLight; ambient: THREE.HemisphereLight }
type WindBranch = { pivot: THREE.Group; mesh: THREE.Mesh; parent: THREE.Object3D; position: THREE.Vector3; phase: number }
type Lantern = { light: THREE.PointLight; material: THREE.MeshStandardMaterial; phase: number }

export class Atmosphere {
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly world: EnvironmentWorld
  private readonly lighting: Lighting
  private readonly config: AtmosphereConfig
  private readonly clock: AtmosphereClock
  private readonly root = new THREE.Group()
  private readonly skyDome: THREE.Mesh
  private readonly fog = new THREE.FogExp2('#1d2d39', 0.0175)
  private readonly sky = new THREE.Color('#101c28')
  private readonly clearSky = new THREE.Color('#263744')
  private readonly flashSky = new THREE.Color('#708693')
  private readonly beamPivot = new THREE.Group()
  private readonly beamLight = new THREE.SpotLight('#eddfb4', 0, 100, 0.12, 0.65, 1.3)
  private readonly beamMaterial = new THREE.MeshBasicMaterial({ color: '#c8dbe0', transparent: true, opacity: 0.02, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexColors: true })
  private readonly ghost = new THREE.Group()
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({ color: '#9ec7d3', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  private readonly ghostFace = new THREE.MeshBasicMaterial({ color: '#13232e', transparent: true, opacity: 0, depthWrite: false })
  private readonly branches: WindBranch[] = []
  private readonly bushes: { object: THREE.Object3D; yaw: number; phase: number }[] = []
  private readonly lanterns: Lantern[] = []
  private readonly direction = new THREE.Vector3()
  private readonly projected = new THREE.Vector3()
  private readonly ray = new THREE.Raycaster()
  private readonly hits: THREE.Intersection[] = []
  private readonly occluders: THREE.Object3D[]
  private readonly cameraStart = new THREE.Vector3()
  private readonly cameraRotation = new THREE.Quaternion()
  private readonly endingPosition = new THREE.Vector3()
  private readonly endingRotation = new THREE.Quaternion()
  private readonly previousFog: THREE.Scene['fog']
  private readonly previousBackground: THREE.Scene['background']
  private readonly previousMoon: number
  private readonly previousAmbient: number
  private readonly oceanAnimation: ReturnType<typeof animateOcean> | null
  private readonly lamp: THREE.MeshStandardMaterial | null
  private readonly lampIntensity: number
  private snapshot: GameSnapshot = { phase: 'exploration', collected: [], puzzleProgress: 0 }
  private ending = false
  private disposed = false

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: EnvironmentWorld, lighting: Lighting, options: Partial<AtmosphereConfig> = {}) {
    this.scene = scene
    this.camera = camera
    this.world = world
    this.lighting = lighting
    this.config = { ...ATMOSPHERE_CONFIG, ...options }
    this.clock = new AtmosphereClock(this.config)
    this.occluders = [...world.occluders]
    this.previousFog = scene.fog
    this.previousBackground = scene.background
    this.previousMoon = lighting.moon.intensity
    this.previousAmbient = lighting.ambient.intensity
    scene.fog = this.fog
    scene.background = new THREE.Color()
    this.root.name = 'atmosphere'
    scene.add(this.root)
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({
      uniforms: { zenith: { value: scene.background }, horizon: { value: this.fog.color } },
      vertexShader: 'varying vec3 skyDirection; void main() { skyDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; varying vec3 skyDirection;
        void main() {
          float height = smoothstep(-0.04, 0.4, normalize(skyDirection).y);
          gl_FragColor = vec4(mix(horizon, zenith, height), 1.0);
          #include <colorspace_fragment>
        }`,
      // Fog is blended after tone mapping in Three.js; match that unlit color space at the horizon.
      side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false,
    }))
    this.skyDome.name = 'haze-sky'
    this.skyDome.renderOrder = -1000
    this.skyDome.frustumCulled = false
    this.root.add(this.skyDome)
    const lighthouse = world.structures.get('lighthouse')
    if (!lighthouse) throw new Error('Missing lighthouse for atmosphere')
    const lamp = lighthouse.getObjectByName('lantern-light')
    this.lamp = lamp instanceof THREE.Mesh && lamp.material instanceof THREE.MeshStandardMaterial ? lamp.material : null
    this.lampIntensity = this.lamp?.emissiveIntensity ?? 0
    this.buildBeam(lighthouse.position)
    this.buildLanterns()
    this.bindWind()
    this.buildGhost()
    const ocean = scene.getObjectByName('dark-ocean')
    this.oceanAnimation = ocean instanceof THREE.Mesh && ocean.material instanceof THREE.MeshStandardMaterial ? animateOcean(ocean.material) : null
    this.endingPosition.set(lighthouse.position.x + 13, 5, lighthouse.position.z + 17)
    const matrix = new THREE.Matrix4().lookAt(this.endingPosition, new THREE.Vector3(lighthouse.position.x, 13, lighthouse.position.z), camera.up)
    this.endingRotation.setFromRotationMatrix(matrix)
    this.update(0, false)
  }

  get restored(): boolean { return this.clock.restoration >= 1 }

  setProgress(snapshot: GameSnapshot): void {
    this.snapshot = snapshot
    if (snapshot.phase === 'completed' && !this.ending) {
      this.ending = true
      this.cameraStart.copy(this.camera.position)
      this.cameraRotation.copy(this.camera.quaternion)
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.config.reducedMotion = reduced
    this.clock.reducedMotion = reduced
  }

  update(deltaSeconds: number, exploring = true): void {
    if (this.disposed) return
    this.clock.update(deltaSeconds, this.snapshot, this.eligibleApparition(exploring), exploring)
    const time = this.clock.elapsed, restored = this.clock.restoration
    const motion = this.config.reducedMotion ? 0 : 1
    const storm = 1 - restored * 0.75
    const flash = this.config.lightning ? this.clock.lightning : 0
    this.fog.density = this.config.fogDensity * (1 - restored * 0.4)
    this.fog.color.copy(this.sky).lerp(this.clearSky, 0.38 + restored * 0.3).lerp(this.flashSky, flash * 0.55)
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.sky).lerp(this.clearSky, restored * 0.55).lerp(this.flashSky, flash * 0.5)
    this.lighting.moon.intensity = 1.6 + restored * 0.15 + flash * 2.8
    this.lighting.ambient.intensity = 0.65 + restored * 0.3 + flash * 0.9
    const beacon = 0.06 + smoothProgress(restored * 2) * 0.94
    this.beamPivot.rotation.set(-0.11, motion ? time * this.config.beamSpeed : 0.9, 0, 'YXZ')
    this.beamLight.intensity = beacon * 260
    this.beamMaterial.opacity = beacon * 0.065
    if (this.lamp) this.lamp.emissiveIntensity = 0.35 + beacon * 3.4
    if (this.oceanAnimation) {
      this.oceanAnimation.time.value = this.config.ocean ? time * motion : 0
      this.oceanAnimation.amplitude.value = this.config.ocean ? (motion ? storm : 0.25) : 1
    }
    for (const branch of this.branches) branch.pivot.rotation.z = Math.sin(time * 0.8 + branch.phase) * 0.006 * storm * motion * Number(this.config.wind)
    for (const bush of this.bushes) bush.object.rotation.y = bush.yaw + Math.sin(time * 0.9 + bush.phase) * 0.012 * storm * motion * Number(this.config.wind)
    for (const lantern of this.lanterns) {
      const flicker = motion ? Math.sin(time * 9 + lantern.phase) * 0.055 + Math.sin(time * 17.3 + lantern.phase) * 0.035 : 0
      lantern.light.intensity = (14 + restored * 4) * (1 + flicker * (1 - restored * 0.7))
      lantern.material.emissiveIntensity = 2.2 * (1 + flicker)
    }
    this.ghost.visible = this.config.apparition && this.clock.ghostOpacity > 0
    this.ghostMaterial.opacity = this.clock.ghostOpacity
    this.ghostFace.opacity = this.clock.ghostOpacity * 0.8
    this.ghost.position.y = this.world.heightAt(this.ghost.position.x, this.ghost.position.z) + 0.07 + Math.sin(time * 0.9) * 0.045 * motion
    this.ghost.rotation.y = Math.atan2(this.camera.position.x - this.ghost.position.x, this.camera.position.z - this.ghost.position.z)
    if (this.ending && motion) {
      this.camera.position.lerpVectors(this.cameraStart, this.endingPosition, restored)
      this.camera.quaternion.slerpQuaternions(this.cameraRotation, this.endingRotation, restored)
    }
    this.skyDome.position.copy(this.camera.position)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.oceanAnimation?.dispose()
    for (const branch of this.branches) {
      branch.parent.add(branch.mesh)
      branch.mesh.position.copy(branch.position)
      branch.pivot.removeFromParent()
    }
    for (const bush of this.bushes) bush.object.rotation.y = bush.yaw
    if (this.lamp) this.lamp.emissiveIntensity = this.lampIntensity
    for (const lantern of this.lanterns) lantern.light.dispose()
    this.beamLight.dispose()
    disposeWorld(this.root)
    this.scene.fog = this.previousFog
    this.scene.background = this.previousBackground
    this.lighting.moon.intensity = this.previousMoon
    this.lighting.ambient.intensity = this.previousAmbient
  }

  private eligibleApparition(exploring: boolean): boolean {
    if (!exploring || !this.config.apparition || this.clock.apparitionStarted || this.snapshot.collected.length === 0 || this.ending) return false
    this.direction.copy(this.ghost.position).addScaledVector(THREE.Object3D.DEFAULT_UP, 1.6).sub(this.camera.position)
    const distance = this.direction.length()
    if (distance < 5 || distance > 22) return false
    this.direction.multiplyScalar(1 / distance)
    this.camera.updateWorldMatrix(true, false)
    this.projected.copy(this.camera.position).addScaledVector(this.direction, distance).project(this.camera)
    if (Math.abs(this.projected.x) > 0.85 || Math.abs(this.projected.y) > 0.85 || this.projected.z < -1 || this.projected.z > 1) return false
    this.ray.set(this.camera.position, this.direction)
    this.ray.far = distance
    this.hits.length = 0
    this.ray.intersectObjects(this.occluders, true, this.hits)
    return this.hits.length === 0
  }

  private buildBeam(position: THREE.Vector3): void {
    this.beamMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = `varying vec3 beamNormal; varying vec3 beamView;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          beamNormal = normalize(normalMatrix * normal);
          beamView = -(modelViewMatrix * vec4(transformed, 1.0)).xyz;`)
      shader.fragmentShader = `varying vec3 beamNormal; varying vec3 beamView;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', `#include <color_fragment>
          float facing = abs(dot(normalize(beamNormal), normalize(beamView)));
          diffuseColor.a *= smoothstep(0.0, 0.55, facing);`)
    }
    this.beamMaterial.customProgramCacheKey = () => 'last-light-beacon-haze-v1'
    this.beamPivot.name = 'lighthouse-beam'
    this.beamPivot.position.set(position.x, position.y + 19.4, position.z)
    this.root.add(this.beamPivot)
    this.beamLight.target.position.set(0, 0, -75)
    this.beamPivot.add(this.beamLight, this.beamLight.target)
    const geometry = new THREE.CylinderGeometry(8.5, 0.22, 72, 32, 1, true)
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(0, 0, -38.7)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 4)
    for (let i = 0; i < positions.count; i++) {
      colors[i * 4] = colors[i * 4 + 1] = colors[i * 4 + 2] = 1
      colors[i * 4 + 3] = Math.max(0, 1 - (-positions.getZ(i) - 2.7) / 72)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    const cone = new THREE.Mesh(geometry, this.beamMaterial)
    cone.name = 'beacon-haze'
    this.beamPivot.add(cone)
  }

  private buildLanterns(): void {
    if (!this.config.lanterns) return
    const meshes = new MeshLibrary()
    const iron = new THREE.MeshStandardMaterial({ color: '#19242c', roughness: 0.75, metalness: 0.45 })
    for (const placement of this.world.plan.structures) {
      if (placement.kind !== 'lighthouse' && placement.kind !== 'mausoleum') continue
      const building = this.world.structures.get(placement.id)
      if (!building) continue
      const lantern = new THREE.Group()
      lantern.name = `lantern:${placement.id}`
      const lighthouseSconce = placement.kind === 'lighthouse'
      lantern.position.copy(building.position).add(new THREE.Vector3(lighthouseSconce ? -1.05 : -1.25, lighthouseSconce ? 3.1 : 2.4, lighthouseSconce ? 3.1 : 2.7))
      this.root.add(lantern)
      const material = new THREE.MeshStandardMaterial({ color: '#d2aa62', emissive: '#ffba59', emissiveIntensity: 2.2, roughness: 0.5 })
      if (lighthouseSconce) {
        const bracket = new THREE.Group()
        bracket.name = 'lantern-bracket'
        lantern.add(bracket)
        meshes.box(bracket, 'lantern-bracket-plate', iron, [0.22, 0.34, 0.07], [0, 0, -0.32])
        meshes.box(bracket, 'lantern-bracket-arm', iron, [0.07, 0.07, 0.3], [0, 0, -0.14])
      }
      meshes.box(lantern, 'lantern-glass', material, [0.21, 0.38, 0.2], [0, 0, 0])
      for (const y of [-0.24, 0.24]) meshes.box(lantern, 'lantern-cap', iron, [0.33, 0.1, 0.32], [0, y, 0])
      for (const x of [-0.14, 0.14]) meshes.box(lantern, 'lantern-frame', iron, [0.035, 0.4, 0.03], [x, 0, 0.13])
      const light = new THREE.PointLight('#ffc179', 14, 10, 2)
      light.position.set(0, 0, 0)
      lantern.add(light)
      this.lanterns.push({ light, material, phase: this.lanterns.length * 2.7 })
    }
    this.root.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = false; object.receiveShadow = false } })
  }

  private bindWind(): void {
    const branches: THREE.Mesh[] = []
    for (const object of this.world.occluders) {
      if (object.name.startsWith('prop:bush-')) this.bushes.push({ object, yaw: object.rotation.y, phase: this.bushes.length * 1.7 })
      object.traverse((child) => { if (child instanceof THREE.Mesh && child.name === 'dead-branch') branches.push(child) })
    }
    for (const mesh of branches) {
      const parent = mesh.parent
      if (!parent) continue
      mesh.geometry.computeBoundingBox()
      const minY = mesh.geometry.boundingBox?.min.y ?? 0
      const pivot = new THREE.Group()
      pivot.name = 'wind-pivot'
      pivot.position.set(0, minY * mesh.scale.y, 0).applyQuaternion(mesh.quaternion).add(mesh.position)
      const position = mesh.position.clone()
      parent.add(pivot)
      pivot.add(mesh)
      mesh.position.sub(pivot.position)
      this.branches.push({ pivot, mesh, parent, position, phase: this.branches.length * 1.31 })
    }
  }

  private buildGhost(): void {
    // A non-solid apparition beside the central route; it never joins picking/collision roots.
    const central = this.world.plan.routes.find((route) => route.id === 'central')
    this.ghost.name = 'keeper-apparition'
    this.ghost.position.set((central?.from.x ?? 0) + 3.3, 0, (central?.to.z ?? -20) + 12)
    const profile = [[0.01, 0], [0.6, 0.05], [0.46, 0.8], [0.3, 1.45], [0.4, 1.85], [0.28, 2.25], [0.01, 2.4]]
    const geometry = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 16)
    // This Three.js revision leaves the final lathe profile's normals unnormalized.
    geometry.normalizeNormals()
    const vertices = geometry.getAttribute('position')
    const colors = new Float32Array(vertices.count * 4)
    for (let i = 0; i < vertices.count; i++) {
      colors[i * 4] = colors[i * 4 + 1] = colors[i * 4 + 2] = 1
      const y = vertices.getY(i)
      colors[i * 4 + 3] = smoothProgress(y / 0.7) * (1 - smoothProgress((y - 2.15) / 0.3))
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    this.ghostMaterial.vertexColors = true
    this.ghostMaterial.side = THREE.FrontSide
    const robe = new THREE.Mesh(geometry, this.ghostMaterial)
    robe.name = 'keeper-robe'
    const face = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), this.ghostFace)
    face.name = 'keeper-face'
    face.position.set(0, 1.94, 0.29)
    face.scale.set(0.17, 0.24, 0.045)
    this.ghost.add(robe, face)
    this.ghost.visible = false
    this.root.add(this.ghost)
  }
}
