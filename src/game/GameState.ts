import type { SymbolId } from '../world/layout.ts'

export type GamePhase = 'exploration' | 'puzzle' | 'activation' | 'completed'
export type GameSnapshot = { phase: GamePhase; collected: readonly SymbolId[]; puzzleProgress: number }
export type GameTransition = {
  snapshot: GameSnapshot
  result: 'collected' | 'duplicate' | 'locked' | 'correct' | 'incorrect' | 'unlocked' | 'completed' | 'alreadyCompleted' | 'alreadySolved'
}

const RITUAL_ORDER: readonly SymbolId[] = ['wave', 'thorn', 'grave']

export class GameState {
  private phase: GamePhase = 'exploration'
  private readonly collected = new Set<SymbolId>()
  private puzzleProgress = 0

  snapshot(): GameSnapshot {
    return { phase: this.phase, collected: [...this.collected], puzzleProgress: this.puzzleProgress }
  }

  collect(symbol: SymbolId): GameTransition {
    if (this.collected.has(symbol)) return this.transition('duplicate')
    this.collected.add(symbol)
    if (this.collected.size === RITUAL_ORDER.length) this.phase = 'puzzle'
    return this.transition('collected')
  }

  enterDial(symbol: SymbolId): GameTransition {
    if (this.phase === 'exploration') return this.transition('locked')
    if (this.phase !== 'puzzle') return this.transition('alreadySolved')
    if (symbol !== RITUAL_ORDER[this.puzzleProgress]) {
      this.puzzleProgress = 0
      return this.transition('incorrect')
    }
    this.puzzleProgress += 1
    if (this.puzzleProgress === RITUAL_ORDER.length) {
      this.phase = 'activation'
      return this.transition('unlocked')
    }
    return this.transition('correct')
  }

  activateBeacon(): GameTransition {
    if (this.phase === 'completed') return this.transition('alreadyCompleted')
    if (this.phase !== 'activation') return this.transition('locked')
    this.phase = 'completed'
    return this.transition('completed')
  }

  private transition(result: GameTransition['result']): GameTransition {
    return { snapshot: this.snapshot(), result }
  }
}
