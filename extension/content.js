// Shows a warning banner on websites that ScamShield rates as dangerous.
(() => {
  if (window.top !== window) return // only the top-level page
  const host = location.hostname.replace(/^www\./, '')
  const DISMISS_KEY = `scamshield-dismissed:${host}`

  try {
    if (sessionStorage.getItem(DISMISS_KEY)) return
  } catch { /* storage blocked */ }

  chrome.runtime.sendMessage({ type: 'check-host', host }, (result) => {
    if (chrome.runtime.lastError || !result || result.verdict !== 'dangerous') return
    showBanner(result)
  })

  function showBanner(result) {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;'
    // Shadow DOM keeps the page's CSS from breaking the banner (and vice versa).
    const root = wrap.attachShadow({ mode: 'closed' })
    const reasons = result.signals.filter((s) => s.weight > 0).slice(0, 3)

    root.innerHTML = `
      <style>
        .bar { font: 15px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #c0262d; color: #fff;
               padding: 14px 18px; box-shadow: 0 4px 20px rgba(0,0,0,.3); display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
        .icon { font-size: 26px; line-height: 1; }
        .body { flex: 1; min-width: 240px; }
        strong { font-size: 16px; }
        ul { margin: 6px 0 0; padding-left: 18px; }
        .actions { display: flex; gap: 8px; align-items: center; }
        button { font: inherit; font-weight: 600; border-radius: 8px; padding: 8px 14px; cursor: pointer; border: 0; }
        .back { background: #fff; color: #c0262d; }
        .stay { background: transparent; color: #fff; text-decoration: underline; padding: 8px 6px; }
      </style>
      <div class="bar" role="alert">
        <div class="icon">⚠️</div>
        <div class="body">
          <strong>ScamShield: this website may be a scam (risk ${Number(result.score)}/100)</strong>
          <ul></ul>
        </div>
        <div class="actions">
          <button class="back">Take me back</button>
          <button class="stay">I understand, continue</button>
        </div>
      </div>`

    const ul = root.querySelector('ul')
    for (const r of reasons) {
      const li = document.createElement('li')
      li.textContent = r.label // textContent: server data never becomes HTML
      ul.appendChild(li)
    }
    root.querySelector('.back').addEventListener('click', () => {
      if (history.length > 1) history.back()
      else location.href = 'about:blank'
    })
    root.querySelector('.stay').addEventListener('click', () => {
      try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
      wrap.remove()
    })
    document.documentElement.appendChild(wrap)
  }
})()
