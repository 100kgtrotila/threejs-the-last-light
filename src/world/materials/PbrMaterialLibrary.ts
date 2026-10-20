import * as THREE from 'three'
import { projectSurface } from './projectSurface.ts'
import { projectGround } from './groundSurface.ts'

export type PbrSurface = 'masonry' | 'grave' | 'terrain' | 'rock' | 'slate' | 'bark' | 'wood' | 'iron' | 'soil'
type TextureLoader = (url: string) => Promise<THREE.Texture>

const surfaces = {
  masonry: { asset: 'rustic_stone_wall_02', tileMeters: 1.5, color: '#c8d2da', trim: '#edf0ef', strength: 0.3 },
  grave: { asset: 'mossy_rock', tileMeters: 3, color: '#d4d8d5', trim: '#e2e6df', strength: 0.3 },
  terrain: { asset: 'rocky_terrain', tileMeters: 2, color: '#9aaeb8', trim: '#9aaeb8', strength: 0.35 },
  rock: { asset: 'mossy_rock', tileMeters: 3, color: '#8b969c', trim: '#a9b4b8', strength: 0.3 },
  slate: { asset: 'mossy_rock', tileMeters: 2, color: '#485765', trim: '#485765', strength: 0.2 },
  bark: { asset: 'bark_willow', tileMeters: 1, color: '#9caaa9', trim: '#9caaa9', strength: 0.3 },
  wood: { asset: 'weathered_brown_planks', tileMeters: 1.8, color: '#788c99', trim: '#788c99', strength: 0.25 },
  iron: { asset: 'rusty_metal_02', tileMeters: 0.7, color: '#626f79', trim: '#626f79', strength: 0.18 },
  soil: { asset: 'mud_forest', tileMeters: 2, color: '#a7b5ba', trim: '#a7b5ba', strength: 0.25 },
} satisfies Record<PbrSurface, { asset: string; tileMeters: number; color: string; trim: string; strength: number }>

/** Owns shared GPU resources, including textures finishing after teardown. */
export class PbrMaterialLibrary {
  private readonly load: TextureLoader
  private readonly anisotropy: number
  private readonly textures = new Map<string, Promise<THREE.Texture>>()
  private readonly materials = new Map<string, Promise<THREE.MeshStandardMaterial>>()
  private readonly ownedTextures = new Set<THREE.Texture>()
  private readonly ownedMaterials = new Set<THREE.MeshStandardMaterial>()
  private disposed = false

  constructor(load: TextureLoader = (url) => new THREE.TextureLoader().loadAsync(url), anisotropy = 1) {
    this.load = load
    this.anisotropy = Math.max(1, Math.min(4, anisotropy))
  }

  get(surface: PbrSurface, trim = false): Promise<THREE.MeshStandardMaterial> {
    if (this.disposed) return Promise.reject(new Error('PBR library is disposed'))
    const key = `${surface}:${trim}`
    const cached = this.materials.get(key)
    if (cached) return cached
    const config = surfaces[surface]
    const request = Promise.all([
      this.texture(config.asset, 'diff', THREE.SRGBColorSpace),
      this.texture(config.asset, 'nor_gl', THREE.NoColorSpace),
      this.texture(config.asset, surface === 'iron' ? 'arm' : 'rough', THREE.NoColorSpace),
    ]).then(([map, normalMap, roughnessMap]) => {
      if (this.disposed) throw new Error('PBR library is disposed')
      const material = new THREE.MeshStandardMaterial({
        name: `pbr:${key}`, map, normalMap, roughnessMap,
        color: surface === 'terrain' ? '#ffffff' : trim ? config.trim : config.color, roughness: 1, metalness: 0,
        normalScale: new THREE.Vector2(config.strength, config.strength), vertexColors: surface === 'terrain',
        metalnessMap: surface === 'iron' ? roughnessMap : null,
      })
      if (surface === 'iron') material.metalness = 1
      projectSurface(material, config.tileMeters, surface === 'terrain', config.color, {
        local: surface === 'bark' || surface === 'wood',
        weathered: surface === 'masonry' || surface === 'grave' || surface === 'rock' || surface === 'slate',
        muted: surface === 'rock' || surface === 'slate' || surface === 'iron',
      })
      this.ownedMaterials.add(material)
      return material
    })
    this.materials.set(key, request)
    return request
  }

  getGround(): Promise<THREE.MeshStandardMaterial> {
    if (this.disposed) return Promise.reject(new Error('PBR library is disposed'))
    const cached = this.materials.get('ground')
    if (cached) return cached
    const request = Promise.all([this.get('soil'), this.get('terrain'), this.get('grave')]).then(([soil, stone, moss]) => {
      if (this.disposed) throw new Error('PBR library is disposed')
      const material = new THREE.MeshStandardMaterial({ name: 'pbr:ground', map: soil.map, normalMap: soil.normalMap, roughnessMap: soil.roughnessMap, roughness: 1, metalness: 0, vertexColors: true, normalScale: new THREE.Vector2(0.25, 0.25) })
      projectGround(material, stone, moss)
      this.ownedMaterials.add(material)
      return material
    })
    this.materials.set('ground', request)
    return request
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const material of this.ownedMaterials) material.dispose()
    for (const texture of this.ownedTextures) texture.dispose()
    this.ownedMaterials.clear()
    this.ownedTextures.clear()
    this.materials.clear()
    this.textures.clear()
  }

  private texture(asset: string, channel: string, colorSpace: THREE.ColorSpace): Promise<THREE.Texture> {
    const url = `${import.meta.env.BASE_URL}assets/textures/${asset}_${channel}_1k.jpg`
    const cached = this.textures.get(url)
    if (cached) return cached
    const request = this.load(url).then((texture) => {
      if (this.disposed) {
        texture.dispose()
        throw new Error('PBR library is disposed')
      }
      texture.name = `${asset}:${channel}`
      texture.colorSpace = colorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = this.anisotropy
      this.ownedTextures.add(texture)
      return texture
    })
    this.textures.set(url, request)
    return request
  }
}
