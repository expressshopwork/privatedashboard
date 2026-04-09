// ---------------------------------------------------------------------------
// Browser-side localStorage store (replaces Prisma API routes for static deployment)
// ---------------------------------------------------------------------------

const isBrowser = typeof window !== 'undefined'

function readKey<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeKey<T>(key: string, value: T): void {
  if (!isBrowser) return
  localStorage.setItem(key, JSON.stringify(value))
}

function nextId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawCustomer {
  id: number
  name: string
  phone: string
  email: string | null
  notes: string | null
  createdAt: string
}

export interface Customer extends RawCustomer {
  _count: { sales: number }
}

export interface Sale {
  id: number
  customerId: number | null
  type: string
  quantity: number | null
  unitPrice: number | null
  totalAmount: number
  pointsEarned: number | null
  date: string
  notes: string | null
  customer: { name: string } | null
  createdAt: string
}

export interface TopUp {
  id: number
  customerId: number | null
  customerPhone: string
  customerName: string
  product: string
  lastTopUpDate: string
  paymentPeriod: number
  expireDate: string
  createdAt: string
}

export interface KPISettings {
  id: number
  dailyUnitTarget: number
  dailyPointTarget: number
  monthlyRevenueTarget: number
  customerGrowthTarget: number
}

export interface WeeklyData {
  date: string
  units: number
  points: number
  revenue: number
}

export interface DashboardData {
  kpis: {
    salesToday: number
    revenueToday: number
    totalCustomers: number
    activeTopups: number
  }
  recentSales: Sale[]
  expiringTopups: TopUp[]
  weeklyData: WeeklyData[]
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const CUSTOMERS_KEY = 'pd_customers'
const SALES_KEY = 'pd_sales'
const TOPUPS_KEY = 'pd_topups'
const SETTINGS_KEY = 'pd_settings'

function readRawCustomers(): RawCustomer[] {
  return readKey<RawCustomer[]>(CUSTOMERS_KEY, [])
}

function readRawSales(): Sale[] {
  return readKey<Sale[]>(SALES_KEY, [])
}

function readRawTopups(): TopUp[] {
  return readKey<TopUp[]>(TOPUPS_KEY, [])
}

function attachSaleCount(customers: RawCustomer[], sales: Sale[]): Customer[] {
  return customers.map((c) => ({
    ...c,
    _count: { sales: sales.filter((s) => s.customerId === c.id).length },
  }))
}

export function getCustomers(search = ''): Customer[] {
  const raw = readRawCustomers()
  const sales = readRawSales()
  const lower = search.toLowerCase()
  const filtered = search
    ? raw.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.phone.toLowerCase().includes(lower)
      )
    : raw
  return attachSaleCount(
    [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    sales
  )
}

export function addCustomer(data: {
  name: string
  phone: string
  email?: string
  notes?: string
}): Customer {
  const customers = readRawCustomers()
  const sales = readRawSales()
  const newCustomer: RawCustomer = {
    id: nextId(customers),
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    notes: data.notes || null,
    createdAt: new Date().toISOString(),
  }
  customers.push(newCustomer)
  writeKey(CUSTOMERS_KEY, customers)
  return { ...newCustomer, _count: { sales: 0 } }
}

export function updateCustomer(
  id: number,
  data: { name: string; phone: string; email?: string; notes?: string }
): Customer {
  const customers = readRawCustomers()
  const sales = readRawSales()
  const idx = customers.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('Customer not found')
  customers[idx] = {
    ...customers[idx],
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    notes: data.notes || null,
  }
  writeKey(CUSTOMERS_KEY, customers)
  return {
    ...customers[idx],
    _count: { sales: sales.filter((s) => s.customerId === id).length },
  }
}

export function deleteCustomer(id: number): void {
  const customers = readRawCustomers()
  writeKey(
    CUSTOMERS_KEY,
    customers.filter((c) => c.id !== id)
  )
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export function getSales(filters?: {
  type?: string
  from?: string
  to?: string
}): Sale[] {
  const sales = readRawSales()
  const customers = readRawCustomers()

  const withCustomer = sales.map((s) => {
    const found = s.customerId ? customers.find((c) => c.id === s.customerId) : undefined
    return { ...s, customer: found ? { name: found.name } : null }
  })

  return withCustomer
    .filter((s) => {
      if (filters?.type && s.type !== filters.type) return false
      if (filters?.from && new Date(s.date) < new Date(filters.from)) return false
      if (filters?.to && new Date(s.date) > new Date(filters.to)) return false
      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function addSale(data: {
  customerId?: number | null
  type: string
  quantity?: number | null
  unitPrice?: number | null
  totalAmount: number
  pointsEarned?: number | null
  date?: string
  notes?: string | null
}): Sale {
  const sales = readRawSales()
  const customers = readRawCustomers()
  const now = new Date().toISOString()
  const newSale: Sale = {
    id: nextId(sales),
    customerId: data.customerId ?? null,
    type: data.type,
    quantity: data.quantity ?? null,
    unitPrice: data.unitPrice ?? null,
    totalAmount: data.totalAmount,
    pointsEarned: data.pointsEarned ?? null,
    date: data.date ? new Date(data.date).toISOString() : now,
    notes: data.notes ?? null,
    customer: data.customerId
      ? (() => {
          const found = customers.find((c) => c.id === data.customerId)
          return found ? { name: found.name } : null
        })()
      : null,
    createdAt: now,
  }
  sales.push(newSale)
  writeKey(SALES_KEY, sales)
  return newSale
}

export function deleteSale(id: number): void {
  const sales = readRawSales()
  writeKey(
    SALES_KEY,
    sales.filter((s) => s.id !== id)
  )
}

// ---------------------------------------------------------------------------
// Top-ups
// ---------------------------------------------------------------------------

export function getTopups(): TopUp[] {
  return [...readRawTopups()].sort(
    (a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime()
  )
}

export function addTopup(data: {
  customerId?: number | null
  customerPhone: string
  customerName: string
  product: string
  lastTopUpDate: string
  paymentPeriod: number
  expireDate: string
}): TopUp {
  const topups = readRawTopups()
  const newTopup: TopUp = {
    id: nextId(topups),
    customerId: data.customerId ?? null,
    customerPhone: data.customerPhone,
    customerName: data.customerName,
    product: data.product,
    lastTopUpDate: new Date(data.lastTopUpDate).toISOString(),
    paymentPeriod: data.paymentPeriod,
    expireDate: new Date(data.expireDate).toISOString(),
    createdAt: new Date().toISOString(),
  }
  topups.push(newTopup)
  writeKey(TOPUPS_KEY, topups)
  return newTopup
}

export function deleteTopup(id: number): void {
  const topups = readRawTopups()
  writeKey(
    TOPUPS_KEY,
    topups.filter((t) => t.id !== id)
  )
}

// ---------------------------------------------------------------------------
// KPI Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: KPISettings = {
  id: 1,
  dailyUnitTarget: 0,
  dailyPointTarget: 0,
  monthlyRevenueTarget: 0,
  customerGrowthTarget: 0,
}

export function getSettings(): KPISettings {
  return readKey<KPISettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
}

export function saveSettings(data: {
  dailyUnitTarget: number
  dailyPointTarget: number
  monthlyRevenueTarget: number
  customerGrowthTarget: number
}): KPISettings {
  const settings: KPISettings = { id: 1, ...data }
  writeKey(SETTINGS_KEY, settings)
  return settings
}

// ---------------------------------------------------------------------------
// Dashboard aggregation
// ---------------------------------------------------------------------------

export function getDashboardData(): DashboardData {
  const customers = readRawCustomers()
  const sales = readRawSales()
  const topups = readRawTopups()

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const salesTodayList = sales.filter((s) => {
    const d = new Date(s.date)
    return d >= today && d < tomorrow
  })

  const revenueToday = salesTodayList.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalCustomers = customers.length
  const activeTopups = topups.filter((t) => new Date(t.expireDate) >= now).length

  // Recent sales (last 10, newest first)
  const recentSales = [...sales]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map((s) => ({
      ...s,
      customer: s.customerId
        ? (() => {
            const foundCustomer = customers.find((customer) => customer.id === s.customerId)
            return foundCustomer ? { name: foundCustomer.name } : null
          })()
        : null,
    }))

  // Expiring top-ups (within 30 days, sorted by expireDate)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringTopups = topups
    .filter(
      (t) => new Date(t.expireDate) >= now && new Date(t.expireDate) <= thirtyDaysFromNow
    )
    .sort((a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime())
    .slice(0, 5)

  // Weekly data (last 7 days)
  const weeklyMap: Record<string, WeeklyData> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    weeklyMap[key] = { date: key, units: 0, points: 0, revenue: 0 }
  }
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  for (const sale of sales) {
    if (new Date(sale.date) >= sevenDaysAgo) {
      const key = new Date(sale.date).toISOString().split('T')[0]
      if (weeklyMap[key]) {
        weeklyMap[key].revenue += sale.totalAmount
        if (sale.type === 'unit') {
          weeklyMap[key].units += sale.quantity ?? 0
        } else {
          weeklyMap[key].points += sale.pointsEarned ?? 0
        }
      }
    }
  }

  return {
    kpis: {
      salesToday: salesTodayList.length,
      revenueToday,
      totalCustomers,
      activeTopups,
    },
    recentSales,
    expiringTopups,
    weeklyData: Object.values(weeklyMap),
  }
}
