import type { GameSnapshot } from './GameState.ts'

export function smoothProgress(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function pulse(phase: number, start: number, duration: number): number {
  const t = (phase - start) / duration
  return t > 0 && t < 1 ? Math.sin(t * Math.PI) ** 2 : 0
}

export function lightningAt(time: number): number {
  if (time < 18) return 0
  const phase = (time - 18) % 43
  return Math.max(pulse(phase, 0, 0.16), pulse(phase, 0.3, 0.22) * 0.6)
}

/** Deterministic effect time; gameplay progression remains owned by GameState. */
export class AtmosphereClock {
  elapsed = 0
  restoration = 0
  ghostOpacity = 0
  lightning = 0
  reducedMotion: boolean
  private restorationTime = 0
  private ghostTime = 0
  private ghostTriggered = false

  constructor(options: { reducedMotion?: boolean } = {}) {
    this.reducedMotion = options.reducedMotion ?? false
  }

  get apparitionStarted(): boolean { return this.ghostTriggered }

  update(deltaSeconds: number, snapshot: GameSnapshot, apparitionEligible: boolean, active = true): void {
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
    this.elapsed += dt
    if (snapshot.phase === 'completed') {
      this.restorationTime += dt
      this.restoration = smoothProgress(this.restorationTime / 7)
      this.ghostOpacity = 0
    } else {
      if (!this.ghostTriggered && active && apparitionEligible && snapshot.collected.length > 0) this.ghostTriggered = true
      if (this.ghostTriggered && active) this.ghostTime += dt
      this.ghostOpacity = this.ghostTriggered ? smoothProgress(this.ghostTime) * (1 - smoothProgress((this.ghostTime - 3) / 2)) * 0.32 : 0
    }
    this.lightning = this.reducedMotion || snapshot.phase === 'completed' ? 0 : lightningAt(this.elapsed)
  }
}
