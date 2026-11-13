const DEFAULTS = { apiBase: 'http://localhost:5150', appBase: 'http://localhost:5180', enabled: true }
const VERDICT = { dangerous: 'Dangerous: likely a scam site', suspicious: 'Suspicious: be careful', low_risk: 'No major red flags' }
const $ = (id) => document.getElementById(id)

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) }
}

function renderList(ul, items) {
  ul.replaceChildren(...items.map((t) => Object.assign(document.createElement('li'), { textContent: t })))
}

async function showCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let host = ''
  try {
    const url = new URL(tab?.url || '')
    if (url.protocol.startsWith('http')) host = url.hostname.replace(/^www\./, '')
  } catch { /* not a web page */ }
  if (!host) {
    $('host').textContent = 'Not a website'
    $('site').querySelector('.score').textContent = '–'
    return
  }
  $('host').textContent = host
  chrome.runtime.sendMessage({ type: 'get-host-result', host }, (r) => {
    if (!r) {
      $('verdict').textContent = 'Could not check (server offline or local site)'
      $('site').querySelector('.score').textContent = '–'
      return
    }
    $('site').className = `site ${r.verdict}`
    $('site').querySelector('.score').textContent = r.score
    $('verdict').textContent = VERDICT[r.verdict]
    renderList($('reasons'), r.signals.filter((s) => s.weight > 0).slice(0, 4).map((s) => s.label))
  })
}

async function checkText() {
  const text = $('text').value.trim()
  const out = $('result')
  if (text.length < 3) {
    out.textContent = 'Paste something to check first.'
    return
  }
  const { apiBase, appBase } = await getSettings()
  $('check').disabled = true
  $('check').textContent = 'Checking…'
  try {
    const res = await fetch(`${apiBase}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'extension' }),
    })
    const r = await res.json()
    if (!res.ok) throw new Error(r.error || 'Check failed')
    out.replaceChildren()
    const head = document.createElement('div')
    head.innerHTML = '<strong></strong> · <span></span>'
    head.querySelector('strong').textContent = `${r.score}/100`
    head.querySelector('span').textContent = r.verdict === 'low_risk' ? 'No major red flags' : r.categoryLabel
    head.style.color = r.verdict === 'dangerous' ? 'var(--danger)' : r.verdict === 'suspicious' ? 'var(--warn)' : 'var(--ok)'
    const ul = document.createElement('ul')
    renderList(ul, r.signals.filter((s) => s.weight > 0).slice(0, 4).map((s) => s.label))
    const link = Object.assign(document.createElement('a'), { href: `${appBase}/r/${r.id}`, target: '_blank', textContent: 'See full explanation →' })
    out.append(head, ul, link)
  } catch (e) {
    out.textContent = e.message || 'Could not reach the ScamShield server.'
  } finally {
    $('check').disabled = false
    $('check').textContent = 'Check'
  }
}

async function init() {
  const s = await getSettings()
  $('apiBase').value = s.apiBase
  $('appBase').value = s.appBase
  $('enabled').checked = s.enabled
  $('check').addEventListener('click', checkText)
  $('save').addEventListener('click', async () => {
    await chrome.storage.sync.set({
      apiBase: $('apiBase').value.trim().replace(/\/$/, '') || DEFAULTS.apiBase,
      appBase: $('appBase').value.trim().replace(/\/$/, '') || DEFAULTS.appBase,
      enabled: $('enabled').checked,
    })
    $('save').textContent = 'Saved ✓'
    setTimeout(() => ($('save').textContent = 'Save'), 1500)
  })
  showCurrentSite()
}

init()
