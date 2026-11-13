/**
 * Pattern rules for scams common in India. Each rule carries a weight (how strongly it
 * points to fraud) and a plain-language explanation shown to the user.
 * Patterns cover English plus common Hinglish phrasing.
 */

export type Category =
  | 'kyc_bank'
  | 'otp_fraud'
  | 'lottery_prize'
  | 'job_task'
  | 'fake_internship'
  | 'electricity_bill'
  | 'digital_arrest'
  | 'investment'
  | 'refund_qr'
  | 'loan_app'
  | 'family_emergency'
  | 'remote_access'
  | 'generic'

export interface Rule {
  id: string
  category: Category | null // null = generic signal that does not decide the category
  label: string
  detail: string
  weight: number
  patterns: RegExp[]
  /** All of these must also match (used for combos like "internship" + "fee"). */
  requires?: RegExp[]
}

const w = (s: string) => new RegExp(s, 'i')

export const RULES: Rule[] = [
  // --- Bank / KYC ---
  {
    id: 'kyc_update', category: 'kyc_bank', weight: 35,
    label: 'Asks you to update KYC / PAN',
    detail: 'Banks never ask you to update KYC or link PAN through an SMS or WhatsApp link. They ask you to visit a branch or the official app.',
    patterns: [w('\\bkyc\\b'), w('pan\\s*(card)?\\s*(link|update|verify)'), w('aadhaa?r\\s*(link|update|verify)')],
  },
  {
    id: 'account_block', category: 'kyc_bank', weight: 30,
    label: 'Threatens to block your account or card',
    detail: 'Scammers threaten to block or suspend your account so that you panic and act without thinking.',
    patterns: [
      w('(account|a/c|card|wallet|sim|number)\\s*(will be|has been|is|ho jayega|hoga)?\\s*(blocked|suspended|deactivated|closed|band|freeze|frozen)'),
      w('khata\\s*band'), w('(blocked|suspended)\\s*today'),
    ],
  },

  // --- OTP / PIN ---
  {
    id: 'share_otp', category: 'otp_fraud', weight: 60,
    label: 'Asks you to share an OTP, PIN or CVV',
    detail: 'No genuine bank, company or government office will ever ask for your OTP, UPI PIN, CVV or password. Anyone who asks is trying to take your money.',
    patterns: [
      w("(?<!\\b(?:not|never|don'?t|na|mat|nahi)\\s+)\\b(share|send|tell|forward|give|provide|read out|batao|bhejo|bata do)\\b.{0,25}\\b(otp|upi pin|pin|cvv|password)\\b"),
      w("\\b(otp|upi pin|cvv)\\b.{0,30}\\b(batao|bata do|bhejo|bolo|share karo|send karo|bata dijiye)\\b"),
    ],
  },
  {
    id: 'pin_to_receive', category: 'refund_qr', weight: 60,
    label: 'Says you must enter a PIN or scan a QR to receive money',
    detail: 'You never need to enter your UPI PIN or scan a QR code to RECEIVE money. A PIN is only used to SEND money.',
    patterns: [
      w('(enter|use|daal)\\w*\\s*(your)?\\s*(upi)?\\s*pin\\s*(to|for|se)?\\s*(receive|get|claim|credit|paise milenge)'),
      w('scan\\s*(the|this)?\\s*(qr|code)\\s*(to|for)\\s*(receive|get|claim)'),
    ],
  },

  // --- Lottery / prizes ---
  {
    id: 'lottery', category: 'lottery_prize', weight: 40,
    label: 'Claims you won a lottery, prize or lucky draw',
    detail: 'If you never entered a contest, you cannot win it. "KBC lottery" and "lucky draw" messages are a well-known scam that ends with a "tax" or "processing fee".',
    patterns: [
      w('(you|u)\\s*(have)?\\s*(won|win|selected)'), w('lottery'), w('lucky\\s*draw'), w('\\bkbc\\b'),
      w('(inaam|inam)\\s*(jeeta|mila)'), w('jackpot'), w('(prize|reward)\\s*(money|amount|of\\s*(₹|rs))'), w('congratulations?.{0,40}(won|winner|selected|prize)'),
    ],
  },

  // --- Jobs / tasks ---
  {
    id: 'task_job', category: 'job_task', weight: 45,
    label: 'Offers easy money for simple online tasks',
    detail: 'Jobs that pay you to like videos, rate hotels or review products are the "task scam". You earn small amounts at first, then get asked to deposit money that you never get back.',
    patterns: [
      w('(like|subscribe|rate|review)\\w*\\s*(youtube|videos?|hotels?|products?|google\\s*maps)'),
      w('part[\\s-]*time\\s*(job|work|opportunity)'), w('(prepaid|paid)\\s*task'), w('telegram\\s*(task|group|channel)'),
      w('(earn|kamaye|kamao|income)\\s*.{0,20}(₹|rs\\.?|inr)?\\s*\\d[\\d,]*\\s*(\\/|per|daily|a day|per day|roz|daily)'),
      w('work\\s*from\\s*home.{0,40}(₹|rs|earn|daily|salary)'), w('ghar\\s*baithe'),
    ],
  },
  {
    id: 'internship_fee', category: 'fake_internship', weight: 50,
    label: 'Internship or job that asks for a fee',
    detail: 'Real companies do not charge for internships, offer letters, training or "security deposits". Paying to get hired is the clearest sign of a fake offer.',
    patterns: [w('(registration|training|security|processing|joining|onboarding|certificate|kit|document(ation)?|verification)\\s*(fee|fees|charge|charges|deposit|amount)')],
    requires: [w('(intern|internship|job|offer\\s*letter|hiring|selected|vacancy|position|interview|onboarding|naukri)')],
  },
  {
    id: 'offer_no_interview', category: 'fake_internship', weight: 20,
    label: 'Offer letter without a proper interview',
    detail: 'Genuine employers interview you before making an offer. "Selected directly, no interview" is a common hook in fake job offers.',
    patterns: [w('(no|without)\\s*interview'), w('(directly|direct)\\s*(selected|joining|hired)'), w('100\\s*%\\s*(job|placement)\\s*guarantee')],
  },

  // --- Utility bills ---
  {
    id: 'electricity', category: 'electricity_bill', weight: 45,
    label: 'Threatens to cut your electricity tonight',
    detail: 'Electricity boards do not send personal numbers asking you to call "the electricity officer". This scam makes you install a remote-access app or pay through a fake link.',
    patterns: [
      w('(electricity|power|bijli|light)\\s*(connection|supply)?\\s*(will be|hoga|ho jayega|will)?\\s*(disconnect|cut|kat|band)'),
      w('(previous|last)\\s*month\\s*bill\\s*(was\\s*)?not\\s*(updated|paid)'), w('electricity\\s*officer'),
    ],
  },

  // --- Digital arrest / parcel ---
  {
    id: 'digital_arrest', category: 'digital_arrest', weight: 55,
    label: 'Uses police, CBI or customs threats',
    detail: 'Police, CBI, ED, customs and courts never arrest anyone over a phone or video call, and never ask for money to "clear your name". "Digital arrest" is not a real legal process.',
    patterns: [
      w('digital\\s*arrest'), w('\\b(cbi|narcotics|ncb|enforcement\\s*directorate|cyber\\s*cell|crime\\s*branch)\\b'),
      w('(parcel|package|courier|fedex|dhl).{0,60}(drugs|illegal|seized|customs|passport)'),
      w('arrest\\s*warrant'), w('(money\\s*laundering|hawala).{0,40}(case|your\\s*(name|aadhaar))'),
    ],
  },

  // --- Investments ---
  {
    id: 'guaranteed_returns', category: 'investment', weight: 40,
    label: 'Promises guaranteed or very high returns',
    detail: 'No genuine investment guarantees returns or doubles your money. Fake trading and crypto apps show made-up profits and then block withdrawals.',
    patterns: [
      w('guarantee\\w*\\s*(return|profit|income)'), w('double\\s*(your)?\\s*money'), w('paisa\\s*double'),
      w('\\d{2,3}\\s*%\\s*(daily|weekly|monthly)?\\s*(return|profit)'), w('(stock|share|trading|crypto|ipo).{0,40}(tips|vip|group|allotment|insider)'),
      w('risk[\\s-]*free\\s*(investment|profit|return)'),
    ],
  },

  // --- Refunds / cashback ---
  {
    id: 'refund', category: 'refund_qr', weight: 20,
    label: 'Unexpected refund or cashback',
    detail: 'Fake refund and cashback messages trick you into "approving" a payment request, which actually takes money from your account.',
    patterns: [w('(refund|cashback|cash\\s*back)\\s*(of|worth)?\\s*(₹|rs)?'), w('(approve|accept)\\s*(the)?\\s*(collect|payment)\\s*request')],
  },

  // --- Loans ---
  {
    id: 'instant_loan', category: 'loan_app', weight: 25,
    label: 'Instant loan with no checks',
    detail: 'Illegal loan apps offer instant loans without documents, then take over your contacts and photos to harass and blackmail you.',
    patterns: [w('(instant|pre[\\s-]*approved|turant)\\s*(personal)?\\s*loan'), w('loan.{0,30}(no|without)\\s*(documents?|cibil|credit\\s*check)')],
  },

  // --- Family emergency / impersonation ---
  {
    id: 'family_emergency', category: 'family_emergency', weight: 30,
    label: 'A "relative" in trouble asking for money',
    detail: 'Scammers pretend to be a family member or friend with a new number, or say a relative was arrested or had an accident. Call the person on their known number before paying.',
    patterns: [
      w('(this is|i am|main)\\s*(your)?\\s*(son|daughter|beta|beti|brother|bhai|friend|dost).{0,40}(new number|naya number)'),
      w('(mummy|papa|mom|dad|maa)\\b.{0,40}(new number|naya number|urgent|paise bhejo|send money)'),
      w('(your|aapka|aapki)\\s*(son|daughter|beta|beti|husband|wife).{0,40}(arrested|accident|hospital|police)'),
    ],
  },

  // --- Remote access / APK ---
  {
    id: 'remote_app', category: 'remote_access', weight: 60,
    label: 'Asks you to install a screen-sharing or unknown app',
    detail: 'Apps like AnyDesk, TeamViewer or a random .apk file let a scammer see your screen and read your OTPs. Never install an app because a caller or message told you to.',
    patterns: [w('\\b(anydesk|teamviewer|quick\\s*support|rustdesk|airdroid)\\b'), w('\\.apk\\b'), w('(download|install)\\s*(this|the|our)?\\s*app.{0,30}(link|now|immediately)')],
  },

  // --- Generic pressure tactics ---
  {
    id: 'urgency', category: null, weight: 12,
    label: 'Creates urgency or panic',
    detail: 'Phrases like "immediately", "within 24 hours" or "last warning" are meant to stop you from thinking or checking with someone.',
    patterns: [
      w('\\b(urgent|urgently|immediately|asap|right now|act now|last warning|final notice|turant|abhi ke abhi|jaldi)\\b'),
      w('within\\s*\\d+\\s*(hours?|hrs?|minutes?|mins?)'), w('(today|tonight|aaj raat)\\s*(itself|only|by|before)'), w('expires?\\s*(today|soon|in)'),
    ],
  },
  {
    id: 'payment_request', category: null, weight: 12,
    label: 'Asks you to pay or transfer money',
    detail: 'The message asks you to send money. Check who you are paying before you transfer anything.',
    patterns: [w('\\b(pay|transfer|send|deposit|jama karo)\\s+(a\\s+|the\\s+|your\\s+)?(₹|rs\\.?|inr|money|amount|paise|fee|\\w+\\s+fee)'), w('(processing|tax|gst|clearance|release)\\s*(fee|charge|amount)')],
  },
  {
    id: 'click_link', category: null, weight: 8,
    label: 'Pushes you to click a link',
    detail: 'The message pushes you to open a link. Scam links lead to fake login or payment pages.',
    patterns: [w('(click|tap|open|visit)\\s*(on)?\\s*(the|this|below)?\\s*(link|here|url)'), w('link\\s*(par|pe)\\s*click')],
  },
  {
    id: 'secrecy', category: null, weight: 15,
    label: 'Tells you to keep it secret',
    detail: 'Being told not to tell family, friends or the bank is a major warning sign. Scammers isolate their victims.',
    patterns: [w("(don'?t|do not|mat)\\s*(tell|inform|share with)\\s*(anyone|family|bank|police|kisi ko)"), w('keep\\s*(this|it)\\s*(confidential|secret)'), w('kisi\\s*ko\\s*mat\\s*batana')],
  },
]

/** Phrases that make a message look like a genuine transactional notice (lowers the score). */
export const TRUST_RULES: Rule[] = [
  {
    id: 'genuine_otp_notice', category: null, weight: -20,
    label: 'Looks like a standard OTP notice',
    detail: 'This looks like an automated OTP that warns you not to share it. That is normal, as long as YOU started the transaction. If you did not, someone may be trying to log in to your account.',
    patterns: [w('(otp|one\\s*time\\s*password|verification\\s*code)\\s*(is|:)?\\s*\\d{4,8}')],
    requires: [w("(do not|don'?t|never)\\s*share")],
  },
]

export interface CategoryInfo {
  label: string
  advice: string[]
}

const UNIVERSAL = 'If you already lost money, call the national cyber-fraud helpline 1930 immediately and file a complaint at cybercrime.gov.in. Speed matters for freezing the money.'

export const CATEGORIES: Record<Category, CategoryInfo> = {
  kyc_bank: { label: 'Fake KYC / bank alert', advice: ['Do not click the link or call the number in the message.', 'Open your bank app or call the number printed on the back of your card to check.', UNIVERSAL] },
  otp_fraud: { label: 'OTP / PIN theft', advice: ['Never share an OTP, UPI PIN, CVV or password with anyone. That includes people claiming to be from the bank.', 'If you shared one, call your bank and block your card or UPI right away.', UNIVERSAL] },
  lottery_prize: { label: 'Fake lottery / prize', advice: ['Ignore it. You cannot win a contest you never entered.', 'Never pay a "tax" or "processing fee" to receive a prize.', 'Report the number on the Sanchar Saathi portal (Chakshu).'] },
  job_task: { label: 'Task-based job scam', advice: ['Leave the Telegram or WhatsApp group and do not deposit any money.', 'Genuine jobs never ask you to pay to unlock earnings.', UNIVERSAL] },
  fake_internship: { label: 'Fake internship / job offer', advice: ['Do not pay any registration, training or security fee.', 'Check the company careers page and the recruiter\'s LinkedIn profile, and make sure the email comes from the company\'s official domain.', 'Report the posting to the platform where you found it.'] },
  electricity_bill: { label: 'Electricity bill scam', advice: ['Do not call the number or install any app it suggests.', 'Check your bill on your electricity board\'s official website or app.', UNIVERSAL] },
  digital_arrest: { label: '"Digital arrest" / impersonation of officials', advice: ['Hang up. Real police and agencies never investigate or arrest over video calls.', 'Never transfer money to "verify" or "clear" your account.', 'Tell a family member and report it on 1930 or cybercrime.gov.in.'] },
  investment: { label: 'Investment / trading scam', advice: ['Only invest through SEBI-registered brokers and apps from the official app store.', 'Be careful of "VIP tips" groups and apps that will not let you withdraw.', UNIVERSAL] },
  refund_qr: { label: 'Refund / QR code scam', advice: ['You never need a PIN or a QR scan to RECEIVE money.', 'Decline unexpected "collect" requests in your UPI app.', UNIVERSAL] },
  loan_app: { label: 'Illegal loan app', advice: ['Borrow only from RBI-registered lenders. Check the RBI list of lenders.', 'Do not give a loan app access to your contacts or gallery.', 'If you are being harassed, report it at cybercrime.gov.in.'] },
  family_emergency: { label: 'Family emergency / impersonation', advice: ['Call the person on the number you already have before sending anything.', 'Ask a question only the real person would know.', UNIVERSAL] },
  remote_access: { label: 'Remote-access app scam', advice: ['Do not install AnyDesk, TeamViewer or any .apk file someone sent you.', 'If you installed one, uninstall it, turn off mobile data and call your bank.', UNIVERSAL] },
  generic: { label: 'Suspicious message', advice: ['Do not click links or share personal details until you have checked the sender.', 'Contact the company through its official website or app, not through the message.'] },
}

/**
 * Returns how many of the rule's patterns matched (0 = rule does not apply).
 * Several independent phrases from the same scam script make a stronger signal.
 */
export function matchRule(rule: Rule, text: string): number {
  const hits = rule.patterns.filter((p) => p.test(text)).length
  if (!hits) return 0
  return (rule.requires || []).every((p) => p.test(text)) ? hits : 0
}

/** Weight with a bonus for multiple matched phrases: +8 per extra phrase, at most +16. */
export function ruleWeight(rule: Rule, hits: number): number {
  if (rule.weight <= 0) return rule.weight
  return rule.weight + Math.min(8 * (hits - 1), 16)
}
