/**
 * Sample data shared by the server seed and the browser-only demo build.
 * All numbers, UPI IDs and domains are made up.
 */
export type DemoReport = [type: 'phone' | 'upi' | 'url' | 'email', value: string, category: string, description: string, lost: number, daysAgo: number]

export const DEMO_REPORTERS = ['Priya', 'Rohit', 'Ananya']

export const DEMO_REPORTS: DemoReport[] = [
  ['url', 'sbi-kyc-update-online.xyz', 'kyc_bank', 'Got SMS saying my YONO account will be blocked today, link asked for net banking password and OTP.', 0, 1],
  ['phone', '9000012345', 'electricity_bill', 'Caller said electricity will be cut at 9:30 pm tonight and asked me to install AnyDesk to pay the bill.', 0, 1],
  ['upi', 'taskreward.desk77@ybl', 'job_task', 'Telegram task group. Paid me ₹150 for liking videos, then asked for ₹5,000 "prepaid task" deposit. Lost it.', 5000, 2],
  ['phone', '7000098765', 'digital_arrest', 'Video call from fake "Mumbai Police" saying a FedEx parcel in my name had drugs. Kept me on call for 3 hours.', 0, 2],
  ['url', 'flipkrat-bigsale.shop', 'generic', 'Fake Flipkart sale page with iPhone for ₹999. Took payment, no order.', 999, 3],
  ['email', 'hr.onboarding.desk@gmail.com', 'fake_internship', 'Offer letter for "Data Analyst Intern at a top MNC" with no interview. Asked ₹2,499 for laptop and training kit.', 2499, 3],
  ['upi', 'kbc.lottery.office@paytm', 'lottery_prize', 'WhatsApp message with KBC logo saying I won ₹25 lakh, asked ₹12,500 as GST to release prize.', 0, 4],
  ['phone', '8000054321', 'family_emergency', 'Message: "Mummy this is my new number, phone broke, send ₹8000 urgently". My son was at home.', 0, 5],
  ['url', 'quick-loan-approval.top', 'loan_app', 'Instant loan app asked for contacts permission, then started threatening messages to my relatives.', 0, 6],
  ['upi', 'refund.helpdesk01@okaxis', 'refund_qr', 'Sent a "collect" request saying it is my refund. Would have debited ₹4,999 if I entered PIN.', 0, 7],
  ['url', 'tradeprofit-vip.live', 'investment', 'WhatsApp "stock VIP group" with fake app showing 300% profit. Could not withdraw.', 45000, 9],
  ['phone', '9000012345', 'electricity_bill', 'Same number called my father too, same electricity script.', 0, 10],
]

export const DEMO_MESSAGES = [
  'Dear Customer, your SBI YONO account will be blocked today. Update your KYC immediately: http://sbi-kyc-update-online.xyz/login',
  'Congratulations! You have won Rs 25,00,000 in KBC lucky draw. Pay processing fee of Rs 12,500 to claim. Contact 9000012345',
  'Part time job! Earn Rs 3000 daily by liking YouTube videos. Join our Telegram task group now.',
  'Dear consumer your electricity power will be disconnected tonight at 9.30pm because previous month bill was not updated. Call electricity officer 9000012345',
  'Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank',
  'Hi, are we still meeting for lunch tomorrow at 1?',
  'Selected for internship at our company without interview! Pay registration fee Rs 1999 to receive offer letter.',
  'This is Mumbai Police Cyber Cell. A FedEx parcel in your name contains drugs. You are under digital arrest. Do not tell anyone.',
  'Guaranteed 40% monthly returns! Join our stock market VIP group for insider tips.',
  'Mummy this is my new number, phone kharab ho gaya, urgent 8000 bhejo please',
]

/** Confirmations ("I got this too") each sample report gets: 0, 1 or 2 by position. */
export const demoConfirmations = (index: number) => index % 3

/** Sample checks per day for the last 14 days (day 0 = today). */
export const demoChecksOnDay = (day: number) => 3 + ((day * 7) % 6)
