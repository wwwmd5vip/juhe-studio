/* global console, fetch, process, setTimeout, WebSocket */
const CDP_URL = 'http://localhost:9222/json/list'

async function main() {
  const listRes = await fetch(CDP_URL)
  const pages = await listRes.json()
  const page = pages.find((p) => p.type === 'page')
  if (!page) {
    console.error('No page target found')
    process.exit(1)
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  const pending = new Map()
  let id = 0

  function send(method, params) {
    const reqId = ++id
    return new Promise((resolve, reject) => {
      pending.set(reqId, { resolve, reject })
      ws.send(JSON.stringify({ id: reqId, method, params }))
    })
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  }

  await new Promise((resolve) => (ws.onopen = resolve))
  console.log('CDP connected')

  await send('Runtime.enable')
  await send('Page.enable')

  await send('Page.navigate', { url: 'http://localhost:8000/debug-canvas.html' })
  await new Promise((r) => setTimeout(r, 4000))

  async function getFirstNodeRect() {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('[data-testid^="rf__node-"]')
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return { id: el.getAttribute('data-testid'), x: rect.x, y: rect.y, width: rect.width, height: rect.height, selected: el.classList.contains('selected') }
      })()`,
      returnByValue: true
    })
    return res.result.value
  }

  let rect = await getFirstNodeRect()
  if (!rect) {
    console.error('No node found')
    process.exit(1)
  }
  console.log('Node rect:', rect)

  const startX = rect.x + rect.width / 2
  const startY = rect.y + rect.height / 2

  // Single click without Shift
  console.log('--- Single click without Shift ---')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX, y: startY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 800))

  rect = await getFirstNodeRect()
  console.log('After single click selected:', rect.selected)
  let log = await send('Runtime.evaluate', { expression: 'document.getElementById("log").textContent', returnByValue: true })
  console.log('Log after single click:\n' + log.result.value)

  // Drag without Shift
  console.log('--- Drag without Shift ---')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 100))
  for (let i = 1; i <= 10; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX + i * 15, y: startY + i * 15, button: 'left' })
    await new Promise((r) => setTimeout(r, 30))
  }
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX + 150, y: startY + 150, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 800))

  rect = await getFirstNodeRect()
  console.log('After drag selected/moved:', { selected: rect.selected, x: rect.x, y: rect.y })
  log = await send('Runtime.evaluate', { expression: 'document.getElementById("log").textContent', returnByValue: true })
  console.log('Log after drag:\n' + log.result.value)

  // Single click with Shift
  console.log('--- Single click with Shift ---')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', modifiers: 8 })
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX + 20, y: startY + 20, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX + 20, y: startY + 20, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', modifiers: 0 })
  await new Promise((r) => setTimeout(r, 800))

  rect = await getFirstNodeRect()
  console.log('After Shift+click selected:', rect.selected)
  log = await send('Runtime.evaluate', { expression: 'document.getElementById("log").textContent', returnByValue: true })
  console.log('Log after shift click:\n' + log.result.value)

  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
