import { getCustomers, getSales, getTopups, getKPIs } from '@/lib/store'

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbztDRiZhSnuBkY95EtbUAmbgwBKzWBwFBqyXvZGIvyjtGkAjT0_ybJT0gAW2Qrju62FZA/exec'

const LAST_SYNC_KEY = 'pd_last_sync'

export interface SyncResult {
  success: boolean
  counts?: {
    customers: number
    sales: number
    topups: number
    kpis: number
  }
  error?: string
}

export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_SYNC_KEY)
}

export async function syncToGoogleSheets(): Promise<SyncResult> {
  const customers = getCustomers()
  const sales = getSales()
  const topups = getTopups()
  const kpis = getKPIs()

  const body = { customers, sales, topups, kpis }

  let response: Response
  try {
    response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      redirect: 'follow',
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }

  let data: SyncResult
  try {
    data = await response.json()
  } catch {
    return { success: false, error: `Unexpected response (status ${response.status})` }
  }

  if (data.success) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    }
  }

  return data
}
