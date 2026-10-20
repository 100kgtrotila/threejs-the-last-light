import './style.css'
import { Game } from './game/Game.ts'
import { showRenderFailure } from './ui/renderFailure.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app host')
const review = import.meta.env.DEV && new URLSearchParams(location.search).has('view')

app.innerHTML = `
  <main class="experience" aria-label="The Last Light Gothic island environment">
    <div class="scene-host" id="scene-host"></div>
    <header class="title-card" ${review ? '' : 'hidden'}>
      <p class="eyebrow">GOTHIC ATMOSPHERE · PHASE 4</p>
      <h1>The Last Light</h1>
      <p>Curse of the Forgotten Island</p>
    </header>
    <nav class="review-views" aria-label="Review viewpoints" ${review ? '' : 'hidden'}>
      <span>Views</span>
      <a href="?view=landing">Landing</a>
      <a href="?view=overview">Overview</a>
      <a href="?view=west">West junction</a>
      <a href="?view=east">East junction</a>
      <a href="?view=cemetery">Cemetery</a>
      <a href="?view=dial">Dial approach</a>
      <a href="?view=coast">Coast</a>
      <a href="?view=overview&debug=1">Debug overlay</a>
    </nav>
    <p class="phase-note" ${review ? '' : 'hidden'}>Environment review · Development cameras</p>
    ${review && new URLSearchParams(location.search).get('debug') === '1'
      ? '<p class="debug-legend">Gold: colliders · Blue: exclusion zones<br>Red: placement conflicts · Axes: artifact anchors</p>'
      : ''}
  </main>
`

const host = app.querySelector<HTMLDivElement>('#scene-host')
if (!host) throw new Error('Missing scene host')

let game: Game | undefined
let failure: HTMLElement | undefined
try {
  game = new Game(host)
  game.start()
} catch (error) {
  game?.dispose()
  console.error('The Last Light could not start:', error)
  failure = showRenderFailure(host, 'The 3D scene could not start. Use a desktop browser with WebGL 2 and hardware acceleration enabled, then reload the game.')
}

import.meta.hot?.dispose(() => { game?.dispose(); failure?.remove() })
