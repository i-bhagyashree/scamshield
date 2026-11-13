/**
 * Heuristics for a single link: brand impersonation, typosquatting, shorteners,
 * risky TLDs, raw IPs, punycode, APK downloads and more.
 */

export interface Signal {
  id: string
  label: string
  detail: string
  weight: number
  source: 'pattern' | 'link' | 'domain' | 'community' | 'ai' | 'trust'
}

interface Brand {
  name: string
  tokens: string[]
  official: string[]
}

export const BRANDS: Brand[] = [
  { name: 'SBI', tokens: ['sbi', 'onlinesbi', 'yonosbi', 'yono'], official: ['sbi.co.in', 'onlinesbi.sbi', 'sbi.bank.in', 'sbicard.com', 'sbi'] },
  { name: 'HDFC Bank', tokens: ['hdfc', 'hdfcbank'], official: ['hdfcbank.com', 'hdfc.com', 'hdfcbank.bank.in'] },
  { name: 'ICICI Bank', tokens: ['icici', 'icicibank'], official: ['icicibank.com', 'icicibank.bank.in', 'icicidirect.com'] },
  { name: 'Axis Bank', tokens: ['axisbank'], official: ['axisbank.com', 'axisbank.bank.in'] },
  { name: 'Kotak', tokens: ['kotak'], official: ['kotak.com', 'kotak.bank.in'] },
  { name: 'PNB', tokens: ['pnbindia', 'punjabnational'], official: ['pnbindia.in', 'pnb.bank.in'] },
  { name: 'Paytm', tokens: ['paytm'], official: ['paytm.com', 'paytm.in', 'paytmbank.com', 'paytmmoney.com'] },
  { name: 'PhonePe', tokens: ['phonepe'], official: ['phonepe.com'] },
  { name: 'Google Pay', tokens: ['googlepay', 'gpay'], official: ['google.com', 'pay.google.com'] },
  { name: 'Amazon', tokens: ['amazon'], official: ['amazon.in', 'amazon.com', 'amazonpay.in', 'amazon.co.uk'] },
  { name: 'Flipkart', tokens: ['flipkart'], official: ['flipkart.com'] },
  { name: 'IRCTC', tokens: ['irctc'], official: ['irctc.co.in', 'irctc.com'] },
  { name: 'Income Tax Dept', tokens: ['incometax', 'itrefund', 'incometaxindia'], official: ['incometax.gov.in', 'incometaxindia.gov.in'] },
  { name: 'UIDAI / Aadhaar', tokens: ['uidai', 'aadhaar', 'aadhar'], official: ['uidai.gov.in', 'myaadhaar.uidai.gov.in'] },
  { name: 'EPFO', tokens: ['epfo', 'epfindia'], official: ['epfindia.gov.in', 'epfo.gov.in'] },
  { name: 'India Post', tokens: ['indiapost'], official: ['indiapost.gov.in'] },
  { name: 'FedEx', tokens: ['fedex'], official: ['fedex.com'] },
  { name: 'Jio', tokens: ['jio', 'myjio'], official: ['jio.com', 'jiomart.com'] },
  { name: 'Airtel', tokens: ['airtel'], official: ['airtel.in', 'airtel.com'] },
  { name: 'NPCI / UPI', tokens: ['npci', 'bhim'], official: ['npci.org.in', 'bhimupi.org.in'] },
  { name: 'RBI', tokens: ['rbi', 'reservebank'], official: ['rbi.org.in'] },
  { name: 'WhatsApp', tokens: ['whatsapp'], official: ['whatsapp.com', 'whatsapp.net', 'wa.me'] },
  { name: 'Instagram', tokens: ['instagram'], official: ['instagram.com'] },
  { name: 'Netflix', tokens: ['netflix'], official: ['netflix.com'] },
  { name: 'LinkedIn', tokens: ['linkedin'], official: ['linkedin.com', 'lnkd.in'] },
  { name: 'Internshala', tokens: ['internshala'], official: ['internshala.com'] },
  { name: 'Naukri', tokens: ['naukri'], official: ['naukri.com'] },
  { name: 'TCS', tokens: ['tcs'], official: ['tcs.com'] },
  { name: 'Infosys', tokens: ['infosys'], official: ['infosys.com'] },
  { name: 'Microsoft', tokens: ['microsoft', 'outlook', 'office365'], official: ['microsoft.com', 'outlook.com', 'live.com', 'office.com'] },
  { name: 'Apple', tokens: ['apple', 'icloud'], official: ['apple.com', 'icloud.com'] },
]

/** Large, well-known sites. Links here skip domain-age checks and get a small trust bonus. */
const WELL_KNOWN = new Set([
  'google.com', 'youtube.com', 'wikipedia.org', 'github.com', 'gov.in', 'nic.in', 'india.gov.in',
  'stackoverflow.com', 'twitter.com', 'x.com', 'facebook.com', 'reddit.com', 'zoho.com', 'swiggy.com', 'zomato.com',
  'claude.ai', 'anthropic.com', 'cybercrime.gov.in', 'sancharsaathi.gov.in',
])

export const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.ly', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'goo.su', 'tiny.cc', 'ow.ly', 's.id',
  'v.gd', 'bitly.ws', 'shorte.st', 'adf.ly', 'rebrand.ly', 'short.io', 'tny.im', 'u.to', 'clck.ru', 'qr.ae', 'surl.li', 'linktr.ee',
])

const RISKY_TLDS = new Set([
  'xyz', 'top', 'club', 'online', 'site', 'info', 'live', 'shop', 'buzz', 'icu', 'vip', 'work', 'click', 'link',
  'tk', 'ml', 'ga', 'cf', 'gq', 'cyou', 'rest', 'sbs', 'bar', 'monster', 'loan', 'win', 'bid', 'cfd', 'today', 'support',
])

const RISKY_WORDS = ['kyc', 'verify', 'verification', 'update', 'login', 'secure', 'reward', 'bonus', 'refund', 'gift', 'claim', 'offer', 'prize', 'account', 'bank', 'wallet', 'free', 'lucky', 'redeem', 'unblock', 'support', 'helpdesk', 'customer', 'care']

const MULTI_PART_SUFFIXES = new Set(['co.in', 'gov.in', 'org.in', 'net.in', 'ac.in', 'edu.in', 'nic.in', 'bank.in', 'firm.in', 'gen.in', 'ind.in', 'co.uk', 'org.uk', 'com.au', 'co.jp'])

/** Approximate registrable domain (eTLD+1) without pulling in the full Public Suffix List. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const lastTwo = parts.slice(-2).join('.')
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.')
  return lastTwo
}

function isSameOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function officialBrandFor(host: string): Brand | undefined {
  return BRANDS.find((b) => b.official.some((d) => isSameOrSubdomain(host, d)))
}

export function isWellKnown(host: string): boolean {
  const reg = registrableDomain(host)
  if (officialBrandFor(host)) return true
  if (host.endsWith('.gov.in') || host.endsWith('.nic.in') || host.endsWith('.ac.in') || host.endsWith('.edu')) return true
  return WELL_KNOWN.has(reg) || WELL_KNOWN.has(host)
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export function analyzeUrl(host: string, raw = host): Signal[] {
  const signals: Signal[] = []
  const add = (s: Omit<Signal, 'source'>) => signals.push({ ...s, source: 'link' })
  const reg = registrableDomain(host)
  const label = reg.split('.')[0]
  const tld = host.split('.').pop() || ''

  const official = officialBrandFor(host)
  if (official) {
    signals.push({ id: `official:${host}`, label: `Official ${official.name} website`, detail: `${host} belongs to ${official.name}'s official domain. A genuine link can still come with a fake message, so check that the message itself makes sense.`, weight: -15, source: 'trust' })
    return signals
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    add({ id: `ip:${host}`, label: 'Link uses a raw IP address', detail: `"${host}" is a bare number instead of a website name. Real companies do not send links like this.`, weight: 30 })
  }
  if (host.includes('xn--')) {
    add({ id: `puny:${host}`, label: 'Link uses look-alike characters', detail: 'This domain uses special characters that can make a fake site look identical to a real one (for example a Cyrillic "а" in place of "a").', weight: 30 })
  }
  if (SHORTENERS.has(reg) || SHORTENERS.has(host)) {
    add({ id: `short:${host}`, label: 'Shortened link hides the real website', detail: `${host} is a link shortener, so you cannot see where it really goes. Scammers use shorteners to hide fake sites.`, weight: 15 })
  }

  // Brand impersonation: brand name appears in a non-official domain.
  const compact = host.replace(/[^a-z0-9]/g, '')
  const impersonated = BRANDS.find((b) => b.tokens.some((t) => (t.length >= 4 ? compact.includes(t) : host.split(/[.-]/).includes(t))))
  if (impersonated) {
    add({ id: `brand:${host}`, label: `Pretends to be ${impersonated.name}`, detail: `"${host}" contains "${impersonated.name}" but is NOT an official ${impersonated.name} domain (${impersonated.official[0]}). This is a classic phishing trick.`, weight: 40 })
  } else if (label.length >= 5) {
    // Typosquatting: close misspelling of a brand (e.g. "flipkrat", "hdfcbnak").
    const typo = BRANDS.find((b) => b.tokens.some((t) => t.length >= 5 && levenshtein(label, t) > 0 && levenshtein(label, t) <= (t.length >= 7 ? 2 : 1)))
    if (typo) add({ id: `typo:${host}`, label: `Misspelled ${typo.name} domain`, detail: `"${reg}" looks like a misspelling of ${typo.name}. Fake sites copy real names with one or two letters changed.`, weight: 40 })
  }

  if (RISKY_TLDS.has(tld)) {
    add({ id: `tld:${host}`, label: `Cheap, high-risk domain ending (.${tld})`, detail: `.${tld} domains cost very little and appear often in scam campaigns. That alone is not proof, but be careful.`, weight: 15 })
  }
  const words = RISKY_WORDS.filter((word) => host.includes(word))
  if (words.length) {
    add({ id: `words:${host}`, label: 'Domain name uses bait words', detail: `The domain contains "${words.slice(0, 3).join('", "')}". Fake sites add words like these to look official.`, weight: 10 })
  }
  if ((reg.match(/-/g) || []).length >= 2 || host.length > 35) {
    add({ id: `long:${host}`, label: 'Unusually long or hyphenated domain', detail: 'Long domains full of hyphens are common in throwaway scam sites.', weight: 8 })
  }
  if (host.split('.').length - reg.split('.').length >= 3) {
    add({ id: `subs:${host}`, label: 'Too many subdomains', detail: `The real website here is "${reg}". Everything before it is decoration meant to confuse you.`, weight: 10 })
  }
  if (/\.apk(\b|$|\?)/i.test(raw)) {
    add({ id: `apk:${host}`, label: 'Link downloads an Android app (.apk)', detail: 'Apps from outside the Play Store can read your SMS and OTPs. Never install an APK that someone sent you.', weight: 40 })
  }
  if (/^https?:\/\/[^/]*@/i.test(raw)) {
    add({ id: `at:${host}`, label: 'Link hides its real destination', detail: 'Anything before "@" in a web address is ignored. It is used to make a link look like it goes somewhere else.', weight: 25 })
  }
  if (/^http:\/\//i.test(raw) && !isWellKnown(host)) {
    add({ id: `http:${host}`, label: 'Link is not secure (http)', detail: 'The link does not use HTTPS, so anything you type into it can be intercepted.', weight: 5 })
  }

  return signals
}
