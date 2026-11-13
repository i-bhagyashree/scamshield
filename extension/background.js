// ScamShield background service worker.
// Privacy: only the hostname of a page is ever sent to the server, never the full URL or page content.

const DEFAULTS = { apiBase: 'http://localhost:5150', appBase: 'http://localhost:5180', enabled: true }
const CACHE_MS = 10 * 60 * 1000
const cache = new Map() // host -> { at, result }

async function settings() {
  const s = await chrome.storage.sync.get(DEFAULTS)
  return { ...DEFAULTS, ...s }
}

function shouldSkip(host, apiBase) {
  if (!host || !host.includes('.')) return true
  if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(host)) return true
  try {
    if (new URL(apiBase).hostname === host) return true
  } catch { /* bad setting */ }
  return false
}

async function checkHost(host) {
  const { apiBase, enabled } = await settings()
  if (!enabled || shouldSkip(host, apiBase)) return null
  const hit = cache.get(host)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result
  try {
    const res = await fetch(`${apiBase}/api/check-domain?host=${encodeURIComponent(host)}`)
    if (!res.ok) return null
    const result = await res.json()
    cache.set(host, { at: Date.now(), result })
    if (cache.size > 500) cache.delete(cache.keys().next().value)
    return result
  } catch {
    return null // server offline: fail open, never block browsing
  }
}

function setBadge(tabId, result) {
  if (tabId == null) return
  if (!result || result.verdict === 'low_risk') {
    chrome.action.setBadgeText({ tabId, text: '' })
    return
  }
  const danger = result.verdict === 'dangerous'
  chrome.action.setBadgeText({ tabId, text: danger ? '!' : '?' })
  chrome.action.setBadgeBackgroundColor({ tabId, color: danger ? '#c0262d' : '#b26b00' })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'check-host') {
    checkHost(msg.host).then((result) => {
      setBadge(sender.tab?.id, result)
      sendResponse(result)
    })
    return true // async response
  }
  if (msg?.type === 'get-host-result') {
    checkHost(msg.host).then(sendResponse)
    return true
  }
  return false
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ss-selection', title: 'Check "%s" with ScamShield', contexts: ['selection'] })
  chrome.contextMenus.create({ id: 'ss-link', title: 'Check this link with ScamShield', contexts: ['link'] })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  const { appBase } = await settings()
  const text = info.menuItemId === 'ss-link' ? info.linkUrl : info.selectionText
  if (!text) return
  chrome.tabs.create({ url: `${appBase}/check?src=ext&text=${encodeURIComponent(text.slice(0, 4000))}` })
})
