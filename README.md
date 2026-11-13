# 🛡️ ScamShield

**Paste a suspicious message and find out if it's a scam, with every warning sign explained in plain language.**

ScamShield checks SMS, WhatsApp messages, emails, links, phone numbers and UPI IDs for the frauds that are common in India: fake KYC alerts, OTP theft, task-based "part-time jobs", fake internships that charge fees, electricity-disconnection threats, "digital arrest" calls, lottery and refund tricks, and more. A Chrome extension also warns you before you use a dangerous website.

> Built with React, TypeScript, Node.js/Express, SQLite and the Claude API.

---

## Why

Most people don't lose money to scams because they're careless. They lose it because the message is urgent, looks official, and there's no one to ask. Existing tools only cover part of the problem: Truecaller flags calls, browsers flag a few known phishing URLs. None of them read a WhatsApp forward and explain *why* it's dangerous and *what to do next*.

## Features

| | |
|---|---|
| 🔍 **Explained risk score (0–100)** | Every warning sign is listed with a plain-language explanation. You get more than "safe" or "unsafe". |
| 🧠 **Hybrid detection** | 20+ pattern rules (English + Hinglish), link forensics, live domain-age lookups, community reports, plus an optional Claude AI second opinion. |
| 🌐 **Link forensics** | Detects brand impersonation (`sbi-kyc-update.xyz`), typosquatting (`flipkrat.com`, `phonepay.com`), shorteners, raw IPs, punycode look-alikes, `.apk` downloads and risky TLDs. |
| 📅 **Domain age via RDAP** | Looks up when a website was registered (the free, official successor to WHOIS). A site created 3 days ago raises a big red flag. Results are cached. |
| 👥 **Community database** | Anyone can report scam numbers, UPI IDs, websites and emails, and others confirm with "I got this too". Any check that contains a reported value is flagged instantly. |
| 📷 **Screenshot OCR** | Upload a screenshot and the text is read with Tesseract.js **in the browser**. The image never leaves the device. |
| 🧩 **Chrome extension** | Warns on dangerous websites with an in-page banner, adds a right-click "Check with ScamShield" menu, and has a popup for quick checks. Sends **only the hostname**, never the full URL or page content. |
| 🔗 **Shareable results + WhatsApp** | "Warn family on WhatsApp" sends a short alert with a result link. Shared links never include the original message, and phone numbers are masked. |
| 👀 **Watchlist alerts** | Unsure about a caller or an OLX "buyer"? Watch the number, UPI ID or website. If anyone reports it later, you get an in-app alert. |
| 👪 **Family circle** | Create a circle and share the invite code. If any member checks a dangerous message, everyone else is alerted so they can call and help. Members see only the scam type and score, never the message, and alerts have a 15-minute cooldown. |
| 🏅 **Reporter reputation** | Reports confirmed by others earn badges (Trusted reporter → Top guardian). Reports from trusted reporters carry more weight in the risk score, which makes fake reports less effective. |
| 🙈 **No sign-up** | Every browser gets a random device ID. The server stores only its SHA-256 hash, so reports, watchlist, family circle and alerts work without an account. A private device code lets you move your data to another phone. New identities are rate-limited per IP. |
| 🧑‍💻 **Personal dashboard** | Scams caught, reports made, watchlist, family circle, badge progress and check history in one place. |
| 📊 **Community dashboard** | Trends over 14 days, most common scam types, most-reported entities, and a filterable report feed. |
| 📚 **Learn** | Guides for the top Indian scam scripts, plus what to do if money is lost (1930, cybercrime.gov.in, Sanchar Saathi). |

## How the risk score works

```
message ──► extract entities (links, phones, UPI IDs, emails, ₹ amounts)
        ├─► pattern rules ─────────────┐
        ├─► link heuristics ───────────┤
        ├─► community DB lookup ───────┼─► noisy-OR combine ─► blend with AI ─► verdict + category + advice
        ├─► RDAP domain age  (parallel)┤
        └─► Claude AI review (parallel)┘
```

- Each warning sign has a weight. Signs are combined with a **noisy-OR**: `score = 1 − Π(1 − wᵢ)`. Two 40-point signs give 64, not 80, and the score can never pass 100. Trust signals (official domains, genuine OTP notices, old domains) are subtracted afterwards.
- A rule that matches several phrases from the same scam script gets a small bonus (+8 per extra phrase, at most +16).
- When AI is on, the final score is `0.45 × rules + 0.55 × AI`. Strong rule evidence and community reports set a floor, so the model cannot talk a known-bad value down.
- Verdict: `≥ 60` dangerous, `≥ 30` suspicious, otherwise low risk.
- The AI prompt treats the message as untrusted data. A message that says "this is safe" is itself treated as a red flag (prompt-injection resistant).

## Tech stack

- **Frontend:** React 19, TypeScript, React Router, Vite, hand-written CSS (light/dark, mobile-first), Tesseract.js (lazy-loaded)
- **Backend:** Node.js, Express 5, TypeScript, Zod validation, anonymous device identities (hashed), Helmet, per-route rate limiting
- **Database:** SQLite (better-sqlite3) with indexes and WAL mode
- **AI:** Claude API (`@anthropic-ai/sdk`) with structured outputs (Zod schema) and refusal fallback
- **Extension:** Chrome Manifest V3 (service worker, content script with Shadow DOM, popup)
- **Tests:** Node's built-in test runner. 34 tests cover extraction, link analysis, scoring, end-to-end verdicts, watchlist and family alerts, reputation, and anonymous device identities.

## Project structure

```
scamshield/
├── server/                 Express API
│   ├── src/analyzer/       detection engine (extract, rules, url, domainAge, ai, index)
│   ├── src/routes/         auth, check, reports, stats
│   ├── src/lib/            auth middleware, rate limiter, community lookup
│   └── test/               analyzer tests
├── client/                 React app (pages: Home, Check, Result, Lookup, Report, Community, Learn, My Shield, Notifications)
└── extension/              Chrome extension (Manifest V3)
```

## Run it locally

Requires Node.js 20+.

```bash
cd scamshield
npm install
cp server/.env.example server/.env      # optional: add ANTHROPIC_API_KEY for AI analysis
npm run dev                              # API on :5150, web app on http://localhost:5180
```

No sign-up is needed. The demo seed adds sample reports and checks; all of the numbers, UPI IDs and domains in it are made up.

```bash
npm test          # run the analyzer test suite
npm run build     # build server + client for production
```

### Load the Chrome extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. If your server isn't on `localhost:5150`, open the extension popup → Settings and set both the API and web app URLs to your deployed site.
4. To test it, check a reported website from the Community page, or open the popup on any site to see its risk score.

## Deploy

The server also serves the built React app, so a single web service is enough.

### Render (one click, free)

This repo includes a [`render.yaml`](render.yaml) Blueprint.

1. Sign in at [render.com](https://render.com) with GitHub.
2. Click **New → Blueprint** and pick this repository.
3. Click **Apply**. The first build takes about 3–5 minutes.

On the free plan the service sleeps after 15 minutes without traffic (the first visit after that takes around 30 seconds), and there is no persistent disk, so the database resets on every restart. The Blueprint turns on sample data (`SEED_DEMO=1`) so the demo isn't empty, and the site labels it as sample data. For real users, use a paid plan with a disk, and set `SEED_DEMO=0` and `DB_PATH` to a path on the disk.

### Docker (Railway, Fly.io, any VPS)

```bash
docker build -t scamshield .
docker run -p 8080:8080 -v scamshield-data:/data scamshield
```

The image stores the database in `/data`, so mount a volume there to keep it.

### Plain Node

```bash
npm ci --include=dev && npm run build
NODE_ENV=production npm start
```

## API

Endpoints marked ✓ need the `X-Device-Id` header (sent automatically by the web app).

| Method | Endpoint | Device | Description |
|---|---|---|---|
| POST | `/api/check` | optional | Analyze text. Returns score, verdict, signals, entities, advice |
| GET | `/api/check/:id` | – | Shareable result (no original text, phones masked) |
| GET | `/api/check-domain?host=` | – | Fast website check used by the extension |
| GET | `/api/lookup?value=` | – | Community reports for a phone / UPI / website / email |
| GET | `/api/reports` | – | Report feed (`type`, `category`, `limit`, `offset`) |
| POST | `/api/reports` | ✓ | Report a scammer |
| POST | `/api/reports/:id/confirm` | ✓ | Toggle "I got this too" |
| GET | `/api/stats` | – | Dashboard data (cached 30s) |
| GET | `/api/me/checks` | ✓ | Your check history |
| DELETE | `/api/me/checks/:id` | ✓ | Delete a check from history |
| GET | `/api/me/summary` | ✓ | Dashboard stats and reputation badge |
| GET / POST / DELETE | `/api/me/watchlist` | ✓ | List, add, remove watched values |
| GET | `/api/me/notifications` | ✓ | Latest alerts + unread count |
| POST | `/api/me/notifications/read-all` | ✓ | Mark all alerts as read |
| GET | `/api/me/circle` | ✓ | Your family circle and members |
| POST | `/api/circle`, `/api/circle/join`, `/api/circle/leave` | ✓ | Create, join (invite code), leave a circle |
| GET / PATCH | `/api/me`, `/api/me/profile` | ✓ | Your anonymous profile and display name |

## Privacy decisions

- Anonymous checks store only the result, never the message text.
- Shared result links never include the message, and phone numbers are masked.
- Screenshot OCR runs entirely in the browser.
- The extension sends only hostnames.
- Users can delete their own history.
- No accounts, emails or passwords are collected. Device IDs are stored only as SHA-256 hashes.

## Roadmap

- Moderation queue for disputed reports
- Push and email notifications, in addition to in-app alerts
- WhatsApp bot: forward a message and get the verdict back
- Hindi and regional-language interface
- Postgres + Redis rate limiting for horizontal scaling

---

**If you lost money to a scam, call 1930 immediately and report at [cybercrime.gov.in](https://cybercrime.gov.in).**
