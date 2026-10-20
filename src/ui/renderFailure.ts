export function showRenderFailure(host: HTMLElement, message: string): HTMLElement {
  const overlay = document.createElement('section')
  overlay.className = 'render-failure'
  overlay.setAttribute('role', 'alert')
  const card = document.createElement('div')
  card.className = 'modal-card'
  const title = document.createElement('h1')
  title.textContent = 'The light could not reach the island'
  const body = document.createElement('p')
  body.textContent = message
  const reload = document.createElement('button')
  reload.type = 'button'
  reload.dataset.reload = ''
  reload.textContent = 'Reload game'
  reload.onclick = () => location.reload()
  card.append(title, body, reload)
  overlay.append(card)
  host.append(overlay)
  host.dataset.renderFailed = 'true'
  delete host.dataset.sceneReady
  reload.focus()
  return overlay
}
