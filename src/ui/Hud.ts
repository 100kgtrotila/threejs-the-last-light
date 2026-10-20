import type { GameSnapshot } from '../game/GameState.ts'
import type { SymbolId } from '../world/layout.ts'

type HudActions = { resume(): void; enterSymbol(symbol: SymbolId): void; restart(): void }

function element<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const result = root.querySelector<T>(selector)
  if (!result) throw new Error(`Missing HUD element ${selector}`)
  return result
}

export class Hud {
  private readonly root = document.createElement('div')
  private readonly listeners = new AbortController()
  private readonly objective: HTMLElement
  private readonly collection: HTMLElement
  private readonly feedback: HTMLElement
  private readonly prompt: HTMLElement
  private readonly modal: HTMLElement
  private readonly title: HTMLElement
  private readonly body: HTMLElement
  private readonly puzzle: HTMLElement
  private readonly progress: HTMLElement
  private readonly resume: HTMLButtonElement
  private readonly restart: HTMLButtonElement

  constructor(host: HTMLElement, actions: HudActions) {
    this.root.className = 'gameplay-ui'
    this.root.dataset.playing = 'false'
    this.root.innerHTML = `
      <section class="objective-card" aria-label="Current objective"><p class="eyebrow">THE LAST LIGHT</p><p id="objective"></p><p id="collection"></p><p id="feedback" role="status" aria-live="polite"></p></section>
      <div class="reticle" aria-hidden="true"></div>
      <p class="interaction-prompt" id="interaction-prompt"></p>
      <p class="controls-hint">WASD move · Shift run · F flashlight · E interact · Esc pause <span id="flashlight-state">· Light on</span></p>
      <div class="pause-overlay" id="game-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <p class="eyebrow">CURSE OF THE FORGOTTEN ISLAND</p><h1 id="modal-title">The Last Light</h1><p id="modal-body"></p>
        <div id="puzzle-panel" hidden><p id="puzzle-progress" role="status"></p><div class="symbol-buttons">
          <button type="button" data-symbol="wave">Wave</button><button type="button" data-symbol="thorn">Thorn</button><button type="button" data-symbol="grave">Grave</button>
        </div><p class="muted">Read the memorials to learn the ritual order. A wrong symbol resets the dial.</p></div>
        <button type="button" id="resume">Begin exploration</button><button type="button" id="restart" hidden>Begin again</button>
        <p class="muted">WASD to move · Shift to run · Mouse to look<br>F flashlight · E interact · Escape pauses</p>
      </section></div>
    `
    host.append(this.root)
    this.objective = element(this.root, '#objective')
    this.collection = element(this.root, '#collection')
    this.feedback = element(this.root, '#feedback')
    this.prompt = element(this.root, '#interaction-prompt')
    this.modal = element(this.root, '#game-modal')
    this.title = element(this.root, '#modal-title')
    this.body = element(this.root, '#modal-body')
    this.puzzle = element(this.root, '#puzzle-panel')
    this.progress = element(this.root, '#puzzle-progress')
    this.resume = element(this.root, '#resume')
    this.restart = element(this.root, '#restart')
    const signal = this.listeners.signal
    this.resume.addEventListener('click', actions.resume, { signal })
    this.restart.addEventListener('click', actions.restart, { signal })
    this.puzzle.querySelectorAll<HTMLButtonElement>('[data-symbol]').forEach((button) => {
      button.addEventListener('click', () => {
        const symbol = button.dataset.symbol
        if (symbol === 'wave' || symbol === 'thorn' || symbol === 'grave') actions.enterSymbol(symbol)
      }, { signal })
    })
    this.showPause(true)
  }

  setState(snapshot: GameSnapshot): void {
    this.root.dataset.phase = snapshot.phase
    const objectives = {
      exploration: 'Find the ritual symbols at the shore, cemetery, and dead grove.',
      puzzle: 'Align the stone dial near the lighthouse using the memorials’ order.',
      activation: 'Return to the lighthouse entrance and activate its beacon.',
      completed: 'The lighthouse is restored.',
    }
    this.objective.textContent = objectives[snapshot.phase]
    this.collection.textContent = `Symbols ${snapshot.collected.length}/3 · ${['wave', 'thorn', 'grave'].map((symbol) => `${snapshot.collected.some((item) => item === symbol) ? '✓' : '○'} ${symbol}`).join(' · ')}`
  }

  showFeedback(message: string): void { this.feedback.textContent = message }
  showCaptureError(message: string): void {
    this.showFeedback(message)
    if (!this.modal.hidden) this.body.textContent = message
  }
  showPrompt(prompt: string): void { this.prompt.textContent = prompt ? `E — ${prompt}` : '' }
  showFlashlight(enabled: boolean): void { element(this.root, '#flashlight-state').textContent = enabled ? '· Light on' : '· Light off' }

  showPause(initial = false): void {
    this.showDialog(initial ? 'The Last Light' : 'Exploration paused', initial
      ? 'Find three ritual symbols, read the island’s memorials, and restore the lighthouse. Click below to capture the mouse.'
      : 'Click Resume to capture the mouse and continue. Your symbols and ritual progress are preserved.')
    this.resume.textContent = initial ? 'Begin exploration' : 'Resume'
  }

  showReading(title: string, message: string): void {
    this.showDialog(title, message)
    this.resume.textContent = 'Return to exploration'
  }

  showPuzzle(snapshot: GameSnapshot, message: string): void {
    const focused = document.activeElement
    this.showDialog('The stone dial', message)
    this.puzzle.hidden = false
    this.progress.textContent = `Ritual alignment: ${snapshot.puzzleProgress}/3`
    this.puzzle.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = snapshot.phase !== 'puzzle' })
    this.resume.textContent = snapshot.phase === 'activation' ? 'Return to the lighthouse' : 'Return to exploration'
    if (focused instanceof HTMLButtonElement && this.puzzle.contains(focused) && !focused.disabled) focused.focus()
    else if (snapshot.phase === 'puzzle') this.puzzle.querySelector<HTMLButtonElement>('button')?.focus()
  }

  showCompletion(): void {
    this.showDialog('The Last Light burns again', 'The three symbols are bound, the ritual is complete, and the lighthouse has awakened.')
    this.objective.textContent = 'The lighthouse is restored.'
    this.showFeedback('The keeper’s watch is over. The curse has lifted.')
    this.resume.hidden = true
    this.restart.hidden = false
    this.restart.focus()
  }

  showRestoration(): void {
    this.showDialog('The beacon awakens', 'The keeper’s watch is over. The light is finding its way through the storm…')
    this.modal.classList.add('restoring')
    this.objective.textContent = 'Watch the lighthouse awaken.'
    this.showFeedback('The beacon is gathering strength…')
    this.resume.hidden = true
    this.title.setAttribute('tabindex', '-1')
    this.title.focus()
  }

  hideDialog(): void {
    this.modal.hidden = true
    this.root.dataset.playing = 'true'
  }

  dispose(): void {
    this.listeners.abort()
    this.root.remove()
  }

  private showDialog(title: string, message: string): void {
    this.modal.classList.remove('restoring')
    this.root.dataset.playing = 'false'
    this.modal.hidden = false
    this.title.textContent = title
    this.body.textContent = message
    this.puzzle.hidden = true
    this.resume.hidden = false
    this.restart.hidden = true
    this.showPrompt('')
    this.resume.focus()
  }
}
