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

  await send('Page.navigate', { url: 'http://localhost:5173/canvas' })
  await new Promise((r) => setTimeout(r, 3000))

  const viewport = await send('Runtime.evaluate', {
    expression: `({ width: window.innerWidth, height: window.innerHeight })`,
    returnByValue: true
  })
  const { width: vw, height: vh } = viewport.result.value
  console.log('Viewport', vw, vh)

  // Find the floating toolbar and click its first add-node button
  const toolbarBtn = await send('Runtime.evaluate', {
    expression: `(() => {
      const divs = document.querySelectorAll('div')
      for (const div of divs) {
        if (div.className && div.className.includes('top-4') && div.className.includes('left-1/2')) {
          const buttons = div.querySelectorAll('button')
          if (buttons.length > 3) {
            const rect = buttons[0].getBoundingClientRect()
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: buttons[0].innerText }
          }
        }
      }
      return null
    })()`,
    returnByValue: true
  })
  if (!toolbarBtn.result.value) {
    console.error('Toolbar button not found')
    process.exit(1)
  }
  const { x: addX, y: addY, text: addText } = toolbarBtn.result.value
  console.log('Clicking toolbar add button:', addText, 'at', addX, addY)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: addX, y: addY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 50))
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: addX, y: addY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 1000))

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
    console.error('No node found after adding')
    process.exit(1)
  }
  console.log('First node rect:', rect)

  const startX = rect.x + rect.width / 2
  const startY = rect.y + rect.height / 2

  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__canvasDebug = { mousedown: 0, mouseup: 0, click: 0, nodeTarget: '', selectionChange: null }
      window.addEventListener('mousedown', (e) => {
        window.__canvasDebug.mousedown++
        window.__canvasDebug.nodeTarget = e.target.getAttribute('data-testid') || e.target.className || e.target.tagName
      }, true)
      window.addEventListener('mouseup', () => window.__canvasDebug.mouseup++, true)
      window.addEventListener('click', () => window.__canvasDebug.click++, true)
    })()`,
    returnByValue: true
  })

  // Single click without Shift
  console.log('Sending single click without Shift at', startX, startY)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX, y: startY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 500))

  let debug = await send('Runtime.evaluate', { expression: 'window.__canvasDebug', returnByValue: true })
  console.log('After single click debug:', debug.result.value)
  let afterRect = await getFirstNodeRect()
  console.log('After single click node selected:', afterRect.selected)

  // Try drag without Shift
  console.log('Sending drag without Shift')
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 100))
  for (let i = 1; i <= 10; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX + i * 10, y: startY + i * 10, button: 'left' })
    await new Promise((r) => setTimeout(r, 20))
  }
  await new Promise((r) => setTimeout(r, 100))
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX + 100, y: startY + 100, button: 'left', clickCount: 1 })
  await new Promise((r) => setTimeout(r, 500))

  debug = await send('Runtime.evaluate', { expression: 'window.__canvasDebug', returnByValue: true })
  console.log('After drag debug:', debug.result.value)
  afterRect = await getFirstNodeRect()
  console.log('After drag node selected/moved:', { selected: afterRect.selected, x: afterRect.x, y: afterRect.y })

  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
