import { Link } from 'react-router-dom'

const GUIDES = [
  {
    icon: '🏦', title: 'Fake KYC / bank alerts',
    hook: '"Your account will be blocked today. Update KYC: bit.ly/..."',
    flags: ['A link to "update" KYC or PAN', 'A threat that your account will be blocked today', 'Sent from a normal mobile number'],
    truth: 'Banks never ask for KYC updates through links. Open your bank app yourself.',
  },
  {
    icon: '🔑', title: 'OTP / PIN theft',
    hook: '"Sir, I am calling from your bank. Please tell me the OTP you just received."',
    flags: ['Anyone asking for an OTP, PIN, CVV or password', 'Pressure to read it out "for verification"'],
    truth: 'An OTP is like the key to your house. No real bank employee will ever ask for it.',
  },
  {
    icon: '💼', title: 'Task jobs & fake internships',
    hook: '"Earn ₹3,000 a day by liking YouTube videos" or "Selected without interview, pay ₹1,999 for training kit"',
    flags: ['Payment for simple tasks', 'Telegram groups', 'Any fee for registration, training, laptop or offer letter', 'Offers without an interview'],
    truth: 'Real employers pay you. They never ask you to pay them.',
  },
  {
    icon: '👮', title: '"Digital arrest"',
    hook: '"This is Mumbai Police. A FedEx parcel with drugs is in your name. Stay on video call."',
    flags: ['Police, CBI, customs or ED contacting you over a video call', 'Being told not to tell family', 'Money demanded to "clear your name"'],
    truth: '"Digital arrest" does not exist in Indian law. Hang up and tell your family.',
  },
  {
    icon: '⚡', title: 'Electricity bill disconnection',
    hook: '"Your power will be cut tonight at 9:30 pm. Call the electricity officer."',
    flags: ['A personal mobile number', 'A "tonight" deadline', 'A request to install an app like AnyDesk'],
    truth: 'Check your bill only on the official electricity board website or app.',
  },
  {
    icon: '🎁', title: 'Lottery, KBC & refunds',
    hook: '"You won ₹25 lakh in KBC lucky draw! Pay GST to claim."',
    flags: ['A prize from a contest you never entered', 'A fee to release the prize', 'A QR code or PIN needed to "receive" money'],
    truth: 'You never need a PIN or QR code to receive money. A PIN only sends money.',
  },
  {
    icon: '📈', title: 'Investment & trading groups',
    hook: '"Join our VIP stock group. Guaranteed 40% monthly returns."',
    flags: ['Guaranteed or very high returns', 'WhatsApp or Telegram "tips" groups', 'An app that will not let you withdraw'],
    truth: 'Use only SEBI-registered brokers. Guaranteed returns do not exist.',
  },
  {
    icon: '👪', title: '"Mummy, this is my new number"',
    hook: '"Hi Mummy, my phone broke, this is my new number. Need ₹8,000 urgently."',
    flags: ['An unknown number claiming to be family', 'An urgent money request', 'An excuse for why they cannot call'],
    truth: 'Call the person on their old number before you send anything.',
  },
]

export default function LearnPage() {
  return (
    <div>
      <h1>Know the scams</h1>
      <p className="muted">Most scams follow a handful of scripts. Learn the patterns once and you'll spot them everywhere.</p>

      <div className="rules card">
        <h2>The 4 golden rules</h2>
        <ol>
          <li><strong>Never share</strong> an OTP, UPI PIN, CVV or password with anyone.</li>
          <li><strong>A PIN only sends money.</strong> You never need it to receive money.</li>
          <li><strong>Urgency is a trap.</strong> "Today", "tonight", "immediately": slow down and check.</li>
          <li><strong>Go to the source.</strong> Open the official app or website yourself. Never use the link or number in the message.</li>
        </ol>
      </div>

      <div className="guide-grid">
        {GUIDES.map((g) => (
          <article key={g.title} className="card guide">
            <h3><span aria-hidden="true">{g.icon}</span> {g.title}</h3>
            <blockquote>{g.hook}</blockquote>
            <p className="small muted">Red flags</p>
            <ul className="bullets">{g.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            <p className="guide-truth">✅ {g.truth}</p>
          </article>
        ))}
      </div>

      <div className="card helpline-card">
        <h2>Already lost money?</h2>
        <ol>
          <li>Call <a href="tel:1930"><strong>1930</strong></a> (National Cyber Crime Helpline) <strong>immediately</strong>. The first hours matter most for freezing the money.</li>
          <li>File a complaint at <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.</li>
          <li>Call your bank to block your card or UPI.</li>
          <li>Report the fraud call or SMS on <a href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer">Sanchar Saathi (Chakshu)</a>.</li>
          <li><Link to="/report">Report it on ScamShield</Link> so others get warned.</li>
        </ol>
      </div>
    </div>
  )
}
