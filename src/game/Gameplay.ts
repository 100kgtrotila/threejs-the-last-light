import * as THREE from 'three'
import { GameState } from './GameState.ts'
import type { GameSnapshot } from './GameState.ts'
import { PlayerController } from '../player/PlayerController.ts'
import { InteractionSystem } from '../interaction/InteractionSystem.ts'
import { Hud } from '../ui/Hud.ts'
import { createWorldColliders } from '../physics/worldColliders.ts'
import type { EnvironmentWorld } from '../world/buildEnvironment.ts'
import type { SymbolId, WorldLayout } from '../world/layout.ts'
import { disposeWorld, MeshLibrary } from '../world/worldMeshes.ts'

type InputMode = 'paused' | 'playing' | 'reading' | 'puzzle' | 'ending' | 'completed'

export class Gameplay {
  private readonly state = new GameState()
  private readonly player: PlayerController
  private readonly interactions: InteractionSystem
  private readonly hud: Hud
  private readonly symbols = new THREE.Group()
  private readonly listeners = new AbortController()
  private readonly world: EnvironmentWorld
  private readonly onProgress: (snapshot: GameSnapshot) => void
  private mode: InputMode = 'paused'

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, host: HTMLElement, world: EnvironmentWorld, layout: WorldLayout, onProgress: (snapshot: GameSnapshot) => void) {
    this.world = world
    this.onProgress = onProgress
    this.symbols.name = 'ritual-symbols'
    scene.add(this.symbols)
    this.hud = new Hud(host, {
      resume: () => { if (this.mode !== 'ending' && this.mode !== 'completed') void this.player.requestLock() },
      enterSymbol: (symbol) => this.enterSymbol(symbol),
      restart: () => location.reload(),
    })
    this.interactions = new InteractionSystem(scene, camera, [...world.occluders, this.symbols])
    const landing = world.plan.structures.find((structure) => structure.kind === 'landing')
    this.player = new PlayerController({
      canvas, camera, spawn: layout.landmarks.landing, colliders: createWorldColliders(world.plan), boundary: world.plan.boundary,
      floorHeight: (x, z) => {
        const ground = world.heightAt(x, z)
        return landing?.footprint.type === 'circle' && Math.hypot(x - landing.footprint.x, z - landing.footprint.z) < landing.footprint.radius ? ground + 0.18 : ground
      },
      onActiveChange: (active) => {
        if (active && (this.mode === 'ending' || this.mode === 'completed')) { this.player.release(); return }
        if (active) { this.mode = 'playing'; this.hud.hideDialog() }
        else if (this.mode === 'playing') { this.mode = 'paused'; this.hud.showPause() }
        if (!active) this.interactions.clear()
      },
      onInteract: () => { if (this.mode === 'playing') this.interactions.activate() },
      onFlashlightChange: (enabled) => this.hud.showFlashlight(enabled),
      onError: (message) => this.hud.showCaptureError(message),
    })
    this.bindSymbols()
    this.bindMemorials()
    const dial = world.structures.get('dial')
    const entrance = world.structures.get('lighthouse')?.getObjectByName('lighthouse-entrance')
    if (!dial || !entrance) throw new Error('Missing ritual dial or lighthouse entrance')
    this.interactions.register({ id: 'dial', object: dial, prompt: 'Inspect the stone dial', enabled: () => true, interact: () => this.openDial() })
    this.interactions.register({ id: 'beacon', object: entrance, prompt: 'Activate the lighthouse', enabled: () => true, interact: () => this.activateBeacon() })
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && (this.mode === 'reading' || this.mode === 'puzzle')) {
        this.mode = 'paused'
        this.hud.showPause()
      }
    }, { signal: this.listeners.signal })
    this.updateState(this.state.snapshot())
  }

  get exploring(): boolean { return this.mode === 'playing' && this.player.active }

  finishRestoration(): void {
    if (this.mode !== 'ending') return
    this.mode = 'completed'
    this.hud.showCompletion()
  }

  update(deltaSeconds: number): void {
    this.player.update(deltaSeconds)
    if (this.mode === 'playing' && this.player.active) this.hud.showPrompt(this.interactions.update()?.prompt ?? '')
    else { this.interactions.clear(); this.hud.showPrompt('') }
  }

  dispose(): void {
    this.listeners.abort()
    this.player.dispose()
    this.interactions.dispose()
    this.hud.dispose()
    disposeWorld(this.symbols)
  }

  private updateState(snapshot: GameSnapshot): void {
    this.hud.setState(snapshot)
    this.onProgress(snapshot)
  }

  private bindSymbols(): void {
    const meshes = new MeshLibrary()
    const material = new THREE.MeshStandardMaterial({ color: '#e0b86b', metalness: 0.65, roughness: 0.35, emissive: '#765525', emissiveIntensity: 0.25 })
    const hitMaterial = new THREE.MeshBasicMaterial()
    for (const site of this.world.plan.artifactSites) {
      const group = new THREE.Group()
      group.name = `symbol:${site.id}`
      group.position.set(site.position.x, this.world.heightAt(site.position.x, site.position.z) + 1.255, site.position.z)
      const approach = this.world.plan.routes.map((route) => route.to).sort((a, b) => Math.hypot(a.x - site.position.x, a.z - site.position.z) - Math.hypot(b.x - site.position.x, b.z - site.position.z))[0]
      if (approach) group.rotation.y = Math.atan2(approach.x - site.position.x, approach.z - site.position.z)
      if (site.id === 'grave') meshes.cross(group, 'grave-ritual-symbol', material, 0.35, 0.52, 0.075, 0.075, 0.07, [0, 0, 0])
      else {
        const geometry = new THREE.TorusGeometry(0.24, 0.045, 8, site.id === 'thorn' ? 3 : 24)
        const mesh = meshes.mesh(group, `${site.id}-ritual-symbol`, geometry, material, [0, 0, 0])
        geometry.computeBoundingBox()
        if (geometry.boundingBox) mesh.position.y = -geometry.boundingBox.min.y
      }
      // A camera-hidden raycast volume keeps thin ritual glyphs easy to select through their open center.
      const hitArea = meshes.box(group, 'symbol-hit-area', hitMaterial, [0.65, 0.65, 0.24], [0, 0.325, 0])
      hitArea.layers.set(1)
      hitArea.castShadow = false
      hitArea.receiveShadow = false
      this.symbols.add(group)
      this.interactions.register({
        id: `symbol-${site.id}`, object: group, prompt: `Collect the ${site.id} symbol`, enabled: () => !this.state.snapshot().collected.includes(site.id),
        interact: () => {
          const transition = this.state.collect(site.id)
          if (transition.result !== 'collected') return
          group.visible = false
          this.updateState(transition.snapshot)
          this.hud.showFeedback(`${site.id[0].toUpperCase()}${site.id.slice(1)} symbol collected. ${transition.snapshot.collected.length}/3 found.`)
        },
      })
    }
    this.symbols.updateMatrixWorld(true)
  }

  private bindMemorials(): void {
    const messages = [
      'The keeper’s first oath belonged to the sea. WAVE opens the rite.',
      'The island held its keeper with a THORN. It follows the wave.',
      'The last oath was laid in the GRAVE. It closes the rite.',
    ]
    for (const structure of this.world.plan.structures.filter((placement) => placement.kind === 'grave')) {
      const object = this.world.structures.get(structure.id)
      if (!object) continue
      this.interactions.register({ id: structure.id, object, prompt: 'Read the memorial', enabled: () => true, interact: () => {
        this.mode = 'reading'
        this.hud.showReading('A weathered memorial', messages[structure.variant])
        this.player.release()
      } })
    }
  }

  private openDial(): void {
    const snapshot = this.state.snapshot()
    if (snapshot.phase === 'exploration') {
      this.hud.showFeedback('The dial is sealed. Bring all three ritual symbols here first.')
      return
    }
    this.mode = 'puzzle'
    this.hud.showPuzzle(snapshot, snapshot.phase === 'puzzle' ? 'Choose the symbols in the order recorded by the memorials.' : 'The ritual is aligned. Activate the lighthouse at its entrance.')
    this.player.release()
  }

  private enterSymbol(symbol: SymbolId): void {
    if (this.mode !== 'puzzle') return
    const transition = this.state.enterDial(symbol)
    const message = transition.result === 'incorrect' ? 'The order breaks. The dial has reset; your symbols are safe.'
      : transition.result === 'unlocked' ? 'The ritual is accepted. Activate the lighthouse at its entrance.'
      : 'The stone accepts this symbol.'
    this.updateState(transition.snapshot)
    this.hud.showPuzzle(transition.snapshot, message)
    this.hud.showFeedback(message)
  }

  private activateBeacon(): void {
    const transition = this.state.activateBeacon()
    if (transition.result === 'locked') {
      this.hud.showFeedback('The lighthouse is sealed by the ritual. Collect the symbols and align the stone dial first.')
      return
    }
    if (transition.result !== 'completed') return
    this.mode = 'ending'
    this.updateState(transition.snapshot)
    this.hud.showRestoration()
    this.player.release()
  }
}
