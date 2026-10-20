import './style.css'
import { Game } from './game/Game.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app host')

app.innerHTML = `
  <main class="experience" aria-label="The Last Light world blockout">
    <div class="scene-host" id="scene-host"></div>
    <header class="title-card">
      <p class="eyebrow">WORLD BLOCKOUT · PHASE 1</p>
      <h1>The Last Light</h1>
      <p>Curse of the Forgotten Island</p>
    </header>
    <nav class="review-views" aria-label="Review viewpoints">
      <span>Views</span>
      <a href="?view=landing">Landing</a>
      <a href="?view=overview">Overview</a>
      <a href="?view=west">West junction</a>
      <a href="?view=east">East junction</a>
      <a href="?view=dial">Dial approach</a>
      <a href="?view=overview&debug=1">Debug overlay</a>
    </nav>
    <p class="phase-note">Static layout review · No movement or gameplay yet</p>
  </main>
`

const host = app.querySelector<HTMLDivElement>('#scene-host')
if (!host) throw new Error('Missing scene host')

const game = new Game(host)
game.start()

import.meta.hot?.dispose(() => game.dispose())
