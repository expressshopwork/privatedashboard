// ---------------------------------------------------------------------------
// Google Sheets sync utility (client-side, for static/GitHub Pages deployment)
//
// Reads data from localStorage (via store.ts) and pushes it to a Google Sheet
// using the Sheets REST API v4.  Authentication is done by signing a JWT with
// the Google Service Account private key using the browser's Web Crypto API,
// then exchanging it for a short-lived OAuth2 bearer token.
//
// Required environment variables (NEXT_PUBLIC_ so they are embedded at build):
//   NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL
//   NEXT_PUBLIC_GOOGLE_PRIVATE_KEY   (PEM, with literal \n for newlines in .env)
// ---------------------------------------------------------------------------

import { format } from 'date-fns'
import { getCustomers, getSales, getTopups } from '@/lib/store'

const SPREADSHEET_ID = '1m5Ae00ICzhEiK8sFF0nglWLXYcPGlvRK6v_AXu81f-0'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
/** Maximum row range cleared before rewriting each sheet. */
const MAX_ROWS = 100000

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function arrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64urlEncode(input: string | Uint8Array): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input
  return arrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers/footers and whitespace, then decode base64
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binaryDer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function getAccessToken(): Promise<string> {
  const email = process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error(
      'Google Sheets credentials are not configured. ' +
        'Set NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL and ' +
        'NEXT_PUBLIC_GOOGLE_PRIVATE_KEY in your .env file.',
    )
  }

  // .env stores newlines as literal \n — restore them
  const privateKeyPem = rawKey.replace(/\\n/g, '\n')
  const cryptoKey = await importPrivateKey(privateKeyPem)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const headerEncoded = base64urlEncode(JSON.stringify(header))
  const payloadEncoded = base64urlEncode(JSON.stringify(payload))
  const signingInput = `${headerEncoded}.${payloadEncoded}`

  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )
  const signature = base64urlEncode(new Uint8Array(signatureBytes))
  const jwt = `${signingInput}.${signature}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to obtain Google access token: ${errorText}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

// ---------------------------------------------------------------------------
// Sheets API helpers
// ---------------------------------------------------------------------------

type CellValue = string | number | null

async function clearSheet(token: string, sheetName: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:Z${MAX_ROWS}:clear`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to clear sheet "${sheetName}": ${err}`)
  }
}

async function writeSheet(
  token: string,
  sheetName: string,
  values: CellValue[][],
): Promise<void> {
  const range = `${sheetName}!A1`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to write sheet "${sheetName}": ${err}`)
  }
}

// ---------------------------------------------------------------------------
// Sync functions
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return iso
  }
}

/** Sync all Customers to the "Customers" sheet tab. Returns count synced. */
export async function syncCustomers(token: string): Promise<number> {
  const customers = getCustomers()
  await clearSheet(token, 'Customers')

  const headers: CellValue[] = [
    'ID',
    'Name',
    'Phone',
    'Email',
    'Notes',
    'Created At',
  ]
  const rows: CellValue[][] = customers.map((c) => [
    c.id,
    c.name,
    c.phone,
    c.email ?? '',
    c.notes ?? '',
    fmtDate(c.createdAt),
  ])

  await writeSheet(token, 'Customers', [headers, ...rows])
  return customers.length
}

/** Sync all Sales to the "Sales" sheet tab. Returns count synced. */
export async function syncSales(token: string): Promise<number> {
  const sales = getSales()
  await clearSheet(token, 'Sales')

  const headers: CellValue[] = [
    'ID',
    'Customer Name',
    'Customer Phone',
    'Type',
    'Quantity',
    'Unit Price',
    'Total Amount',
    'Points Earned',
    'Date',
    'Notes',
    'Created At',
  ]

  // Build a quick phone lookup from customers
  const customers = getCustomers()
  const phoneById = new Map(customers.map((c) => [c.id, c.phone]))

  const rows: CellValue[][] = sales.map((s) => [
    s.id,
    s.customer?.name ?? '',
    s.customerId != null ? (phoneById.get(s.customerId) ?? '') : '',
    s.type,
    s.quantity ?? '',
    s.unitPrice ?? '',
    s.totalAmount,
    s.pointsEarned ?? '',
    fmtDate(s.date),
    s.notes ?? '',
    fmtDate(s.createdAt),
  ])

  await writeSheet(token, 'Sales', [headers, ...rows])
  return sales.length
}

/** Sync all TopUps to the "TopUps" sheet tab. Returns count synced. */
export async function syncTopUps(token: string): Promise<number> {
  const topups = getTopups()
  await clearSheet(token, 'TopUps')

  const headers: CellValue[] = [
    'ID',
    'Customer Name',
    'Customer Phone',
    'Product',
    'Last Top Up Date',
    'Payment Period',
    'Expire Date',
    'Created At',
  ]
  const rows: CellValue[][] = topups.map((t) => [
    t.id,
    t.customerName,
    t.customerPhone,
    t.product,
    fmtDate(t.lastTopUpDate),
    t.paymentPeriod,
    fmtDate(t.expireDate),
    fmtDate(t.createdAt),
  ])

  await writeSheet(token, 'TopUps', [headers, ...rows])
  return topups.length
}

/** Sync all three sheets. Returns counts for each. */
export async function syncAll(): Promise<{
  customers: number
  sales: number
  topups: number
}> {
  const token = await getAccessToken()
  const [customers, sales, topups] = await Promise.all([
    syncCustomers(token),
    syncSales(token),
    syncTopUps(token),
  ])
  return { customers, sales, topups }
}
