// ---------------------------------------------------------------------------
// Browser-side localStorage store (replaces Prisma API routes for static deployment)
// ---------------------------------------------------------------------------

const isBrowser = typeof window !== 'undefined'

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export interface AppUser {
  id: number
  fullName: string
  username: string
  password: string
  role: 'admin' | 'agent' | 'sup'
  branch: string
  status: 'active' | 'inactive'
  createdAt: string
}

const USERS_KEY = 'pd_users'
const CURRENT_USER_KEY = 'pd_current_user'
const SESSION_TIMESTAMP_KEY = 'pd_session_timestamp'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

function getDefaultAdmin(): AppUser {
  return {
    id: 1,
    fullName: 'Administrator',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    branch: '',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
}

export function getUsers(): AppUser[] {
  const users = readKey<AppUser[]>(USERS_KEY, [])
  if (users.length === 0) {
    const admin = getDefaultAdmin()
    writeKey(USERS_KEY, [admin])
    return [admin]
  }
  // Backward compatibility: ensure branch field exists
  let needsWrite = false
  for (const u of users) {
    if (u.branch === undefined) {
      (u as AppUser).branch = ''
      needsWrite = true
    }
  }
  if (needsWrite) writeKey(USERS_KEY, users)
  return users
}

export function addUser(data: {
  fullName: string
  username: string
  password: string
  role: 'admin' | 'agent' | 'sup'
  branch: string
  status: 'active' | 'inactive'
}): AppUser {
  const users = getUsers()
  const exists = users.find(
    (u) => u.username.toLowerCase() === data.username.toLowerCase()
  )
  if (exists) throw new Error('Username already exists')
  const newUser: AppUser = {
    id: nextId(users),
    fullName: data.fullName,
    username: data.username,
    password: data.password,
    role: data.role,
    branch: data.branch,
    status: data.status,
    createdAt: new Date().toISOString(),
  }
  users.push(newUser)
  writeKey(USERS_KEY, users)
  return newUser
}

export function updateUser(
  id: number,
  data: {
    fullName: string
    username: string
    password?: string
    role: 'admin' | 'agent' | 'sup'
    branch: string
    status: 'active' | 'inactive'
  }
): AppUser {
  const users = getUsers()
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) throw new Error('User not found')
  const duplicate = users.find(
    (u) => u.id !== id && u.username.toLowerCase() === data.username.toLowerCase()
  )
  if (duplicate) throw new Error('Username already exists')
  users[idx] = {
    ...users[idx],
    fullName: data.fullName,
    username: data.username,
    role: data.role,
    branch: data.branch,
    status: data.status,
    ...(data.password ? { password: data.password } : {}),
  }
  writeKey(USERS_KEY, users)
  return users[idx]
}

export function deleteUser(id: number): void {
  const users = getUsers()
  writeKey(
    USERS_KEY,
    users.filter((u) => u.id !== id)
  )
}

/** Get unique branch names from all users */
export function getBranches(): string[] {
  const users = getUsers()
  const branches = new Set<string>()
  for (const u of users) {
    if (u.branch) branches.add(u.branch)
  }
  return Array.from(branches).sort()
}

export function loginUser(username: string, password: string): AppUser | null {
  const users = getUsers()
  const user = users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password &&
      u.status === 'active'
  )
  if (!user) return null
  const sessionUser = { ...user }
  writeKey(CURRENT_USER_KEY, sessionUser)
  touchSession()
  return sessionUser
}

export function logoutUser(): void {
  if (isBrowser) {
    localStorage.removeItem(CURRENT_USER_KEY)
    localStorage.removeItem(SESSION_TIMESTAMP_KEY)
  }
}

export function getCurrentUser(): AppUser | null {
  return readKey<AppUser | null>(CURRENT_USER_KEY, null)
}

/** Update the session activity timestamp to now */
export function touchSession(): void {
  if (isBrowser) localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString())
}

/** Check if the session has expired (30 minutes of inactivity) */
export function isSessionExpired(): boolean {
  if (!isBrowser) return false
  const ts = localStorage.getItem(SESSION_TIMESTAMP_KEY)
  if (!ts) return true
  return Date.now() - parseInt(ts, 10) > SESSION_TIMEOUT_MS
}

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
// Service item definitions
// ---------------------------------------------------------------------------

export interface ServiceItem {
  name: string
  category: string
  /** For point-based: multiplier applied to quantity */
  pointMultiplier?: number
  /** For point-based: bonus points added if quantity > 0 */
  bonusPoints?: number
}

/** Unit Based – Unit Group items (counted as units) */
export const UNIT_GROUP_ITEMS: ServiceItem[] = [
  { name: 'Gross Ads', category: 'Unit Group' },
  { name: 'Smart@Home', category: 'Unit Group' },
  { name: 'Fiber+', category: 'Unit Group' },
  { name: 'SmartNas', category: 'Unit Group' },
]

/** Unit Based – Dollar Group items (entered as dollar amounts) */
export const DOLLAR_GROUP_ITEMS: ServiceItem[] = [
  { name: 'Buy Number', category: 'Dollar Group' },
  { name: 'Change SIM', category: 'Dollar Group' },
  { name: 'Recharge', category: 'Dollar Group' },
  { name: 'Dealer SC', category: 'Dollar Group' },
]

/** Point Based – all service items grouped by category */
export const POINT_BASED_ITEMS: ServiceItem[] = [
  // MBB Pre-Paid
  { name: 'Gross Add', category: 'MBB Pre-Paid', pointMultiplier: 1 },
  { name: 'Change SIM', category: 'MBB Pre-Paid', pointMultiplier: 1 },
  { name: 'Pre-Paid sub Recharge', category: 'MBB Pre-Paid', pointMultiplier: 1 },
  { name: 'SC Selling', category: 'MBB Pre-Paid', pointMultiplier: 1 },
  // FBB Home
  { name: 'Home Internet Gross Add', category: 'FBB Home', pointMultiplier: 2 },
  { name: 'FWBB Deposit / FTTx Signup', category: 'FBB Home', pointMultiplier: 2 },
  { name: 'Home Internet Migration', category: 'FBB Home', pointMultiplier: 2 },
  { name: 'Home Internet Recharge', category: 'FBB Home', pointMultiplier: 2 },
  // FBB SME
  { name: 'SME New Sub Gross Add', category: 'FBB SME', pointMultiplier: 2 },
  { name: 'SME Existing Recharge', category: 'FBB SME', pointMultiplier: 2 },
  // MBB ICT
  { name: 'ICT Solution', category: 'MBB ICT', pointMultiplier: 2 },
  // Other
  { name: 'Device Handset/Accessory', category: 'Other', pointMultiplier: 0.5 },
  { name: 'eSIM', category: 'Other', pointMultiplier: 0, bonusPoints: 2 },
  { name: 'Smart NAS Download', category: 'Other', pointMultiplier: 0, bonusPoints: 2 },
]

/** Get unique point categories in order */
export function getPointCategories(): string[] {
  const seen = new Set<string>()
  return POINT_BASED_ITEMS.reduce<string[]>((acc, item) => {
    if (!seen.has(item.category)) {
      seen.add(item.category)
      acc.push(item.category)
    }
    return acc
  }, [])
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
  /** Name of the service item sold */
  serviceName: string | null
  /** Category / group for the service item */
  category: string | null
  quantity: number | null
  unitPrice: number | null
  totalAmount: number
  pointsEarned: number | null
  date: string
  notes: string | null
  customer: { name: string } | null
  /** Points calculated using service point rules (amount × rate + add-on) */
  kpiPoints?: number | null
  createdBy: string
  createdAt: string
}

/** Predefined product options for top-up */
export const TOPUP_PRODUCTS = [
  'Smart@Home',
  'Fiber+',
  'M2M',
  'Smart Laor Monthly',
  'Data Tamchet Monthly',
  'Hybrid+',
] as const

export interface TopUp {
  id: number
  customerId: number | null
  customerPhone: string
  customerName: string
  product: string
  amount: number
  lastTopUpDate: string
  paymentPeriod: number
  expireDate: string
  createdBy: string
  createdAt: string
}

/** KPI mode: volume measures raw output, point measures a points score */
export type KPIMode = 'volume' | 'point'

/** For volume KPIs: whether to count units or sum currency */
export type VolumeValueMode = 'unit' | 'currency'

/** Currency type for volume/currency KPIs */
export type CurrencyType = 'USD' | 'KHR'

/** KPI period */
export type KPIPeriod = 'monthly' | 'weekly' | 'daily'

/** Assignee type: shop means track whole branch, agent means individual */
export type KPIAssigneeType = 'shop' | 'agent'

/** Service point rule: defines rate and add-on for a service type used in point-based KPIs */
export interface ServicePointRule {
  id: number
  /** The service type name (e.g., "Home Internet Activation") */
  serviceName: string
  /** Multiplier applied to the transaction dollar amount */
  rate: number
  /** Flat bonus points added regardless of amount */
  addOn: number
}

/** A single KPI record */
export interface KPIRecord {
  id: number
  /** Display name for this KPI */
  name: string
  /** Volume or Point mode */
  mode: KPIMode
  /** Whether this KPI is assigned to a shop (supervisor) or individual agent */
  assigneeType: KPIAssigneeType
  /** The user ID of the assignee (supervisor for shop KPIs, agent for agent KPIs) */
  assigneeId: number
  /** The month this KPI applies to, format: YYYY-MM */
  month: string
  /** Measurement period granularity */
  period: KPIPeriod

  // --- Volume-specific fields ---
  /** For volume KPIs: unit or currency value mode */
  volumeValueMode?: VolumeValueMode
  /** For volume/currency KPIs: USD or KHR */
  currencyType?: CurrencyType
  /** For volume KPIs: optional specific product to track (null = all products) */
  volumeProductFilter?: string | null
  /** For volume KPIs: the single target number */
  volumeTarget?: number

  // --- Point-specific fields ---
  /** For point KPIs: MIN threshold */
  pointMin?: number
  /** For point KPIs: Gate threshold (main benchmark) */
  pointGate?: number
  /** For point KPIs: OTB threshold */
  pointOtb?: number
  /** For point KPIs: OAB threshold */
  pointOab?: number

  createdAt: string
}

export interface WeeklyData {
  date: string
  units: number
  points: number
  revenue: number
}

export interface MonthlyData {
  month: string
  units: number
  points: number
  revenue: number
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const CUSTOMERS_KEY = 'pd_customers'
const SALES_KEY = 'pd_sales'
const TOPUPS_KEY = 'pd_topups'

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
  serviceName?: string | null
  category?: string | null
  quantity?: number | null
  unitPrice?: number | null
  totalAmount: number
  pointsEarned?: number | null
  kpiPoints?: number | null
  date?: string
  notes?: string | null
  createdBy?: string
}): Sale {
  const sales = readRawSales()
  const customers = readRawCustomers()
  const now = new Date().toISOString()
  const newSale: Sale = {
    id: nextId(sales),
    customerId: data.customerId ?? null,
    type: data.type,
    serviceName: data.serviceName ?? null,
    category: data.category ?? null,
    quantity: data.quantity ?? null,
    unitPrice: data.unitPrice ?? null,
    totalAmount: data.totalAmount,
    pointsEarned: data.pointsEarned ?? null,
    kpiPoints: data.kpiPoints ?? null,
    date: data.date ? new Date(data.date).toISOString() : now,
    notes: data.notes ?? null,
    customer: data.customerId
      ? (() => {
          const found = customers.find((c) => c.id === data.customerId)
          return found ? { name: found.name } : null
        })()
      : null,
    createdBy: data.createdBy ?? '',
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

export function updateSale(
  id: number,
  data: {
    type?: string
    serviceName?: string | null
    category?: string | null
    quantity?: number | null
    unitPrice?: number | null
    totalAmount?: number
    pointsEarned?: number | null
    kpiPoints?: number | null
    date?: string
    notes?: string | null
    createdBy?: string
  }
): Sale {
  const sales = readRawSales()
  const idx = sales.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('Sale not found')
  const update: Partial<Sale> = {}
  if (data.type !== undefined) update.type = data.type
  if (data.serviceName !== undefined) update.serviceName = data.serviceName
  if (data.category !== undefined) update.category = data.category
  if (data.quantity !== undefined) update.quantity = data.quantity
  if (data.unitPrice !== undefined) update.unitPrice = data.unitPrice
  if (data.totalAmount !== undefined) update.totalAmount = data.totalAmount
  if (data.pointsEarned !== undefined) update.pointsEarned = data.pointsEarned
  if (data.kpiPoints !== undefined) update.kpiPoints = data.kpiPoints
  if (data.date !== undefined) update.date = new Date(data.date).toISOString()
  if (data.notes !== undefined) update.notes = data.notes
  if (data.createdBy !== undefined) update.createdBy = data.createdBy
  sales[idx] = { ...sales[idx], ...update }
  writeKey(SALES_KEY, sales)
  return sales[idx]
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
  amount: number
  lastTopUpDate: string
  paymentPeriod: number
  expireDate: string
  createdBy?: string
}): TopUp {
  const topups = readRawTopups()
  const newTopup: TopUp = {
    id: nextId(topups),
    customerId: data.customerId ?? null,
    customerPhone: data.customerPhone,
    customerName: data.customerName,
    product: data.product,
    amount: data.amount,
    lastTopUpDate: new Date(data.lastTopUpDate).toISOString(),
    paymentPeriod: data.paymentPeriod,
    expireDate: new Date(data.expireDate).toISOString(),
    createdBy: data.createdBy ?? '',
    createdAt: new Date().toISOString(),
  }
  topups.push(newTopup)
  writeKey(TOPUPS_KEY, topups)
  return newTopup
}

export function updateTopup(
  id: number,
  data: {
    customerPhone?: string
    customerName?: string
    product?: string
    amount?: number
    lastTopUpDate?: string
    paymentPeriod?: number
    expireDate?: string
    createdBy?: string
  }
): TopUp {
  const topups = readRawTopups()
  const idx = topups.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error('Top-up not found')
  topups[idx] = {
    ...topups[idx],
    ...(data.customerPhone !== undefined ? { customerPhone: data.customerPhone } : {}),
    ...(data.customerName !== undefined ? { customerName: data.customerName } : {}),
    ...(data.product !== undefined ? { product: data.product } : {}),
    ...(data.amount !== undefined ? { amount: data.amount } : {}),
    ...(data.lastTopUpDate !== undefined
      ? { lastTopUpDate: new Date(data.lastTopUpDate).toISOString() }
      : {}),
    ...(data.paymentPeriod !== undefined ? { paymentPeriod: data.paymentPeriod } : {}),
    ...(data.expireDate !== undefined
      ? { expireDate: new Date(data.expireDate).toISOString() }
      : {}),
    ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
  }
  writeKey(TOPUPS_KEY, topups)
  return topups[idx]
}

export function deleteTopup(id: number): void {
  const topups = readRawTopups()
  writeKey(
    TOPUPS_KEY,
    topups.filter((t) => t.id !== id)
  )
}

// ---------------------------------------------------------------------------
// KPI Records CRUD
// ---------------------------------------------------------------------------

const KPIS_KEY = 'pd_kpis'
const SERVICE_POINT_RULES_KEY = 'pd_service_point_rules'

const DEFAULT_SERVICE_POINT_RULES: ServicePointRule[] = [
  { id: 1, serviceName: 'Gross Add', rate: 1, addOn: 0 },
  { id: 2, serviceName: 'Change SIM', rate: 1, addOn: 0 },
  { id: 3, serviceName: 'Pre-Paid sub Recharge', rate: 1, addOn: 0 },
  { id: 4, serviceName: 'SC Selling', rate: 1, addOn: 0 },
  { id: 5, serviceName: 'Home Internet Gross Add', rate: 2, addOn: 0 },
  { id: 6, serviceName: 'FWBB Deposit / FTTx Signup', rate: 2, addOn: 0 },
  { id: 7, serviceName: 'Home Internet Migration', rate: 2, addOn: 0 },
  { id: 8, serviceName: 'Home Internet Recharge', rate: 2, addOn: 0 },
  { id: 9, serviceName: 'SME New Sub Gross Add', rate: 2, addOn: 0 },
  { id: 10, serviceName: 'SME Existing Recharge', rate: 2, addOn: 0 },
  { id: 11, serviceName: 'ICT Solution', rate: 2, addOn: 0 },
  { id: 12, serviceName: 'Device Handset/Accessory', rate: 0.5, addOn: 0 },
  { id: 13, serviceName: 'eSIM', rate: 0, addOn: 2 },
  { id: 14, serviceName: 'Smart NAS Download', rate: 0, addOn: 2 },
]

export function getKPIs(filters?: { month?: string; assigneeId?: number; mode?: KPIMode }): KPIRecord[] {
  const kpis = readKey<KPIRecord[]>(KPIS_KEY, [])
  if (!filters) return kpis
  return kpis.filter((k) => {
    if (filters.month && k.month !== filters.month) return false
    if (filters.assigneeId !== undefined && k.assigneeId !== filters.assigneeId) return false
    if (filters.mode && k.mode !== filters.mode) return false
    return true
  })
}

export function addKPI(data: Omit<KPIRecord, 'id' | 'createdAt'>): KPIRecord {
  const kpis = readKey<KPIRecord[]>(KPIS_KEY, [])
  const newKPI: KPIRecord = {
    ...data,
    id: nextId(kpis),
    createdAt: new Date().toISOString(),
  }
  kpis.push(newKPI)
  writeKey(KPIS_KEY, kpis)
  return newKPI
}

export function updateKPI(id: number, data: Partial<Omit<KPIRecord, 'id' | 'createdAt'>>): KPIRecord {
  const kpis = readKey<KPIRecord[]>(KPIS_KEY, [])
  const idx = kpis.findIndex((k) => k.id === id)
  if (idx === -1) throw new Error('KPI not found')
  kpis[idx] = { ...kpis[idx], ...data }
  writeKey(KPIS_KEY, kpis)
  return kpis[idx]
}

export function deleteKPI(id: number): void {
  const kpis = readKey<KPIRecord[]>(KPIS_KEY, [])
  writeKey(
    KPIS_KEY,
    kpis.filter((k) => k.id !== id)
  )
}

// ---------------------------------------------------------------------------
// Service Point Rules CRUD
// ---------------------------------------------------------------------------

export function getServicePointRules(): ServicePointRule[] {
  const stored = readKey<ServicePointRule[] | null>(SERVICE_POINT_RULES_KEY, null)
  if (stored === null) {
    writeKey(SERVICE_POINT_RULES_KEY, DEFAULT_SERVICE_POINT_RULES)
    return DEFAULT_SERVICE_POINT_RULES
  }
  return stored
}

export function saveServicePointRules(rules: ServicePointRule[]): void {
  writeKey(SERVICE_POINT_RULES_KEY, rules)
}

export function addServicePointRule(data: Omit<ServicePointRule, 'id'>): ServicePointRule {
  const rules = getServicePointRules()
  const newRule: ServicePointRule = {
    ...data,
    id: nextId(rules),
  }
  rules.push(newRule)
  writeKey(SERVICE_POINT_RULES_KEY, rules)
  return newRule
}

export function deleteServicePointRule(id: number): void {
  const rules = getServicePointRules()
  writeKey(
    SERVICE_POINT_RULES_KEY,
    rules.filter((r) => r.id !== id)
  )
}

// ---------------------------------------------------------------------------
// KPI Performance Computation
// ---------------------------------------------------------------------------

/** Calculate actual achievement for a KPI given a set of sales */
export function computeKPIAchievement(
  kpi: KPIRecord,
  sales: Sale[],
  allUsers: AppUser[]
): {
  actual: number
  target: number
  achievementPct: number
  tier: 'oab' | 'otb' | 'gate' | 'min' | 'below'
} {
  // 1. Filter sales to the KPI's month (YYYY-MM)
  const monthSales = sales.filter((s) => {
    const d = new Date(s.date)
    const saleMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return saleMonth === kpi.month
  })

  // 2. Scope to the right person/shop
  let scopedSales: Sale[]
  if (kpi.assigneeType === 'agent') {
    const assignee = allUsers.find((u) => u.id === kpi.assigneeId)
    scopedSales = assignee
      ? monthSales.filter((s) => s.createdBy === assignee.fullName)
      : []
  } else {
    // Shop KPI: find the supervisor (assignee), get their branch, include all users in that branch
    const supervisor = allUsers.find((u) => u.id === kpi.assigneeId)
    if (supervisor && supervisor.branch) {
      const branchUsers = allUsers.filter((u) => u.branch === supervisor.branch)
      const branchNames = new Set(branchUsers.map((u) => u.fullName))
      scopedSales = monthSales.filter((s) => branchNames.has(s.createdBy))
    } else {
      scopedSales = []
    }
  }

  // 3. Sum actual based on mode
  let actual = 0
  if (kpi.mode === 'point') {
    for (const s of scopedSales) {
      if (s.type === 'point') {
        // Prefer kpiPoints (computed via ServicePointRule: amount × rate + addOn).
        // Fall back to pointsEarned for legacy sales created before kpiPoints was introduced.
        actual += s.kpiPoints ?? s.pointsEarned ?? 0
      }
    }
  } else {
    // Volume mode
    let filtered = scopedSales.filter((s) => s.type === 'unit')
    if (kpi.volumeProductFilter) {
      filtered = filtered.filter((s) => s.serviceName === kpi.volumeProductFilter)
    }
    if (kpi.volumeValueMode === 'currency') {
      for (const s of filtered) actual += s.totalAmount
    } else {
      // unit mode (default)
      for (const s of filtered) actual += s.quantity ?? 0
    }
  }

  // 4. Calculate achievement % (gate target)
  let target: number
  if (kpi.mode === 'point') {
    target = kpi.pointGate ?? 0
  } else {
    target = kpi.volumeTarget ?? 0
  }
  const achievementPct = target > 0 ? (actual / target) * 100 : 0

  // 5. Determine tier
  let tier: 'oab' | 'otb' | 'gate' | 'min' | 'below'
  if (kpi.mode === 'point') {
    if (kpi.pointOab !== undefined && actual >= kpi.pointOab) {
      tier = 'oab'
    } else if (kpi.pointOtb !== undefined && actual >= kpi.pointOtb) {
      tier = 'otb'
    } else if (kpi.pointGate !== undefined && actual >= kpi.pointGate) {
      tier = 'gate'
    } else if (kpi.pointMin !== undefined && actual >= kpi.pointMin) {
      tier = 'min'
    } else {
      tier = 'below'
    }
  } else {
    // Volume: only 'gate' or 'below'
    tier = target > 0 && actual >= target ? 'gate' : 'below'
  }

  return { actual, target, achievementPct, tier }
}

// ---------------------------------------------------------------------------
// Dashboard aggregation
// ---------------------------------------------------------------------------

export interface UnitDaySummary {
  unitGroup: Record<string, number>
  dollarGroup: Record<string, number>
  totalUnits: number
  totalRevenue: number
}

export interface PointDaySummary {
  items: Record<string, { quantity: number; points: number }>
  totalPoints: number
}

export interface PointCategoryChartData {
  category: string
  points: number
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
  monthlyData: MonthlyData[]
  unitSummaryToday: UnitDaySummary
  pointSummaryToday: PointDaySummary
  pointCategoryChart: PointCategoryChartData[]
  /** Comparison stats for weekly/monthly growth */
  weeklyComparison: {
    thisWeekUnits: number
    lastWeekUnits: number
    thisWeekPoints: number
    lastWeekPoints: number
    thisWeekRevenue: number
    lastWeekRevenue: number
  }
  monthlyComparison: {
    thisMonthUnits: number
    lastMonthUnits: number
    thisMonthPoints: number
    lastMonthPoints: number
    thisMonthRevenue: number
    lastMonthRevenue: number
  }
}

function buildUnitSummary(salesList: Sale[]): UnitDaySummary {
  const unitGroup: Record<string, number> = {}
  for (const item of UNIT_GROUP_ITEMS) unitGroup[item.name] = 0
  const dollarGroup: Record<string, number> = {}
  for (const item of DOLLAR_GROUP_ITEMS) dollarGroup[item.name] = 0

  for (const s of salesList) {
    if (s.type !== 'unit' || !s.serviceName) continue
    if (s.category === 'Unit Group' && s.serviceName in unitGroup) {
      unitGroup[s.serviceName] += s.quantity ?? 0
    } else if (s.category === 'Dollar Group' && s.serviceName in dollarGroup) {
      dollarGroup[s.serviceName] += s.totalAmount
    }
  }

  const totalUnits = Object.values(unitGroup).reduce((a, b) => a + b, 0)
  const totalRevenue = Object.values(dollarGroup).reduce((a, b) => a + b, 0)
  return { unitGroup, dollarGroup, totalUnits, totalRevenue }
}

function buildPointSummary(salesList: Sale[]): PointDaySummary {
  const items: Record<string, { quantity: number; points: number }> = {}
  for (const item of POINT_BASED_ITEMS) {
    items[item.name] = { quantity: 0, points: 0 }
  }

  for (const s of salesList) {
    if (s.type !== 'point' || !s.serviceName) continue
    if (s.serviceName in items) {
      items[s.serviceName].quantity += s.quantity ?? 0
      items[s.serviceName].points += s.pointsEarned ?? 0
    }
  }

  const totalPoints = Object.values(items).reduce((a, b) => a + b.points, 0)
  return { items, totalPoints }
}

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

  // Expiring top-ups (within 7 days, sorted by expireDate)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const expiringTopups = topups
    .filter(
      (t) => new Date(t.expireDate) >= now && new Date(t.expireDate) <= sevenDaysFromNow
    )
    .sort((a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime())

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

  // Monthly data (last 6 months)
  const monthlyMap: Record<string, MonthlyData> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = { month: key, units: 0, points: 0, revenue: 0 }
  }
  for (const sale of sales) {
    const sd = new Date(sale.date)
    const key = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}`
    if (monthlyMap[key]) {
      monthlyMap[key].revenue += sale.totalAmount
      if (sale.type === 'unit') {
        monthlyMap[key].units += sale.quantity ?? 0
      } else {
        monthlyMap[key].points += sale.pointsEarned ?? 0
      }
    }
  }

  // Point category chart (today's points by main category)
  const pointCategoryMap: Record<string, number> = {}
  for (const cat of getPointCategories()) {
    pointCategoryMap[cat] = 0
  }
  for (const s of salesTodayList) {
    if (s.type !== 'point' || !s.category) continue
    if (s.category in pointCategoryMap) {
      pointCategoryMap[s.category] += s.pointsEarned ?? 0
    }
  }
  const pointCategoryChart: PointCategoryChartData[] = Object.entries(pointCategoryMap).map(
    ([category, points]) => ({ category, points })
  )

  // Weekly comparison: this week (last 7 days) vs previous week (7-14 days ago)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const thisWeek = { units: 0, points: 0, revenue: 0 }
  const lastWeek = { units: 0, points: 0, revenue: 0 }
  for (const sale of sales) {
    const d = new Date(sale.date)
    if (d >= sevenDaysAgo && d <= now) {
      thisWeek.revenue += sale.totalAmount
      if (sale.type === 'unit') thisWeek.units += sale.quantity ?? 0
      else thisWeek.points += sale.pointsEarned ?? 0
    } else if (d >= fourteenDaysAgo && d < sevenDaysAgo) {
      lastWeek.revenue += sale.totalAmount
      if (sale.type === 'unit') lastWeek.units += sale.quantity ?? 0
      else lastWeek.points += sale.pointsEarned ?? 0
    }
  }

  // Monthly comparison: this month vs last month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonth = { units: 0, points: 0, revenue: 0 }
  const lastMonth = { units: 0, points: 0, revenue: 0 }
  for (const sale of sales) {
    const d = new Date(sale.date)
    if (d >= thisMonthStart && d <= now) {
      thisMonth.revenue += sale.totalAmount
      if (sale.type === 'unit') thisMonth.units += sale.quantity ?? 0
      else thisMonth.points += sale.pointsEarned ?? 0
    } else if (d >= lastMonthStart && d < thisMonthStart) {
      lastMonth.revenue += sale.totalAmount
      if (sale.type === 'unit') lastMonth.units += sale.quantity ?? 0
      else lastMonth.points += sale.pointsEarned ?? 0
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
    monthlyData: Object.values(monthlyMap),
    unitSummaryToday: buildUnitSummary(salesTodayList),
    pointSummaryToday: buildPointSummary(salesTodayList),
    pointCategoryChart,
    weeklyComparison: {
      thisWeekUnits: thisWeek.units,
      lastWeekUnits: lastWeek.units,
      thisWeekPoints: thisWeek.points,
      lastWeekPoints: lastWeek.points,
      thisWeekRevenue: thisWeek.revenue,
      lastWeekRevenue: lastWeek.revenue,
    },
    monthlyComparison: {
      thisMonthUnits: thisMonth.units,
      lastMonthUnits: lastMonth.units,
      thisMonthPoints: thisMonth.points,
      lastMonthPoints: lastMonth.points,
      thisMonthRevenue: thisMonth.revenue,
      lastMonthRevenue: lastMonth.revenue,
    },
  }
}
