import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import ResultView from '../components/ResultView'
import { post } from '../lib/api'
import type { CheckResult } from '../lib/types'

const EXAMPLES = [
  { label: 'Bank KYC', text: 'Dear Customer, your SBI YONO account will be blocked today. Update your PAN/KYC immediately: http://sbi-kyc-update-online.xyz/login' },
  { label: 'Part-time job', text: 'Hello! Part time job opportunity. Earn Rs 3000 daily by liking YouTube videos. Join our Telegram task group now. Contact taskreward.desk77@ybl' },
  { label: 'Electricity', text: 'Dear consumer your electricity power will be disconnected tonight at 9.30pm because previous month bill was not updated. Please immediately contact electricity officer 9000012345' },
  { label: 'Internship', text: 'Congratulations! You are selected for Data Analyst internship at our MNC without interview. Pay registration fee of Rs 1999 to receive your offer letter within 24 hours.' },
  { label: 'Hinglish OTP', text: 'Sir main bank se bol raha hoon, aapka khata band ho jayega. Abhi jo OTP aaya hai woh turant batao' },
  { label: 'Genuine OTP', text: 'Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank' },
]

const STEPS = ['Reading the message', 'Checking links and domains', 'Searching community reports', 'Putting it together']

export default function CheckPage() {
  const [params] = useSearchParams()
  const [text, setText] = useState(params.get('text') || '')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [ocr, setOcr] = useState<{ busy: boolean; progress: number; error?: string }>({ busy: false, progress: 0 })
  const resultRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const autoRan = useRef(false)

  const check = async (value = text, source: 'web' | 'ocr' | 'extension' = 'web') => {
    if (value.trim().length < 3) {
      setError('Paste a message, link, phone number or UPI ID first.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    setStep(0)
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700)
    try {
      const r = await post<CheckResult>('/check', { text: value, source })
      setResult(r)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  // Text sent from the browser extension's "Check with ScamShield" menu runs automatically.
  useEffect(() => {
    const t = params.get('text')
    if (t && !autoRan.current) {
      autoRan.current = true
      check(t, params.get('src') === 'ext' ? 'extension' : 'web')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    check()
  }

  const onImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setOcr({ busy: false, progress: 0, error: 'Please choose an image (screenshot).' })
      return
    }
    setOcr({ busy: true, progress: 0 })
    try {
      // Loaded only when needed: OCR runs entirely in the browser, the image never leaves the device.
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setOcr({ busy: true, progress: Math.round(m.progress * 100) })
        },
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()
      const extracted = data.text.replace(/\n{2,}/g, '\n').trim()
      if (!extracted) {
        setOcr({ busy: false, progress: 0, error: 'No text found in that image. Try a clearer screenshot.' })
        return
      }
      setText(extracted)
      setOcr({ busy: false, progress: 100 })
      check(extracted, 'ocr')
    } catch {
      setOcr({ busy: false, progress: 0, error: 'Could not read the image. Try pasting the text instead.' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="check-page">
      <section className="hero">
        <h1>Is this message <span className="gradient-text">a scam?</span></h1>
        <p className="hero-sub">
          Paste any suspicious SMS, WhatsApp message, email, link, phone number or UPI ID. We'll tell you if it's
          risky, explain why in plain language, and tell you what to do next.
        </p>
      </section>

      <form className="card check-form" onSubmit={onSubmit}>
        <label htmlFor="msg" className="sr-only">Message to check</label>
        <textarea
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'e.g. "Your account will be blocked today. Update KYC: http://..."'}
          rows={6}
          maxLength={8000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) check()
          }}
        />
        <div className="check-row">
          <div className="check-tools">
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={ocr.busy}>
              {ocr.busy ? `Reading screenshot… ${ocr.progress}%` : '📷 Upload screenshot'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onImage(e.target.files?.[0])} />
            {text && <button type="button" className="btn btn-link" onClick={() => { setText(''); setResult(null) }}>Clear</button>}
          </div>
          <button className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Checking…' : 'Check now'}
          </button>
        </div>
        {(error || ocr.error) && <p className="form-error" role="alert">{error || ocr.error}</p>}
        <ul className="trust-row" aria-label="Highlights">
          <li>✓ Free, no sign-up needed</li>
          <li>✓ Works with Hinglish</li>
          <li>✓ Your message stays private</li>
        </ul>
        <div className="examples">
          <span className="muted small">Try an example:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="chip" onClick={() => { setText(ex.text); check(ex.text) }}>
              {ex.label}
            </button>
          ))}
        </div>
      </form>

      <div ref={resultRef}>
        {loading && (
          <div className="card loading-card" aria-live="polite">
            {STEPS.map((s, i) => (
              <div key={s} className={`loading-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                <span className="dot" /> {s}
              </div>
            ))}
          </div>
        )}
        {result && <ResultView result={result} />}
      </div>


    </div>
  )
}
