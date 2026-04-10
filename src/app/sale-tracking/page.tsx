'use client'

import { useEffect, useState, useMemo } from 'react'
import { Target, ChevronDown, Users } from 'lucide-react'
import {
  getSettings,
  getSales,
  getCurrentUser,
  getUsers,
  type KPISettings,
  type Sale,
  type KPIItem,
  type SIPPositionConfig,
  type NewSIPPositionConfig,
  type AppUser,
  UNIT_GROUP_ITEMS,
  DOLLAR_GROUP_ITEMS,
} from '@/lib/store'

type ViewMode = 'unit' | 'point'

/** Determine which payment level an actual value achieves */
function getLevel(
  actual: number,
  gate: number,
  otb: number,
  oab: number,
  min?: number,
): 'oab' | 'otb' | 'gate' | 'min' | 'below' {
  if (actual >= oab) return 'oab'
  if (actual >= otb) return 'otb'
  if (actual >= gate) return 'gate'
  if (min !== undefined && actual >= min) return 'min'
  return 'below'
}

const LEVEL_COLORS: Record<string, string> = {
  oab: 'bg-green-100 text-green-800',
  otb: 'bg-blue-100 text-blue-800',
  gate: 'bg-yellow-100 text-yellow-800',
  min: 'bg-orange-100 text-orange-800',
  below: 'bg-red-100 text-red-700',
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${LEVEL_COLORS[level] ?? 'bg-gray-100 text-gray-700'}`}>
      {level === 'below' ? 'Below Min' : level.toUpperCase()}
    </span>
  )
}

/** Compute the actual value for a KPI item from sales */
function computeKPIActual(kpiName: string, sales: Sale[]): number {
  const unitSales = sales.filter((s) => s.type === 'unit')

  // Map KPI name to service names
  const lower = kpiName.toLowerCase()

  if (lower.includes('gross add')) {
    return unitSales
      .filter((s) => s.serviceName === 'Gross Ads' && s.category === 'Unit Group')
      .reduce((sum, s) => sum + (s.quantity ?? 0), 0)
  }

  if (lower.includes('recharge')) {
    return unitSales
      .filter((s) => s.serviceName === 'Recharge' && s.category === 'Dollar Group')
      .reduce((sum, s) => sum + s.totalAmount, 0)
  }

  if (lower.includes('smart@home') || lower.includes('fiber')) {
    return unitSales
      .filter(
        (s) =>
          (s.serviceName === 'Smart@Home' || s.serviceName === 'Fiber+') &&
          s.category === 'Unit Group',
      )
      .reduce((sum, s) => sum + (s.quantity ?? 0), 0)
  }

  if (lower.includes('smart nas') || lower.includes('smartnas') || lower.includes('downloading') || lower.includes('mau')) {
    return unitSales
      .filter((s) => s.serviceName === 'SmartNas' && s.category === 'Unit Group')
      .reduce((sum, s) => sum + (s.quantity ?? 0), 0)
  }

  // Fallback: look for exact match in unit or dollar group items
  const unitItem = UNIT_GROUP_ITEMS.find((i) => i.name.toLowerCase() === lower)
  if (unitItem) {
    return unitSales
      .filter((s) => s.serviceName === unitItem.name && s.category === 'Unit Group')
      .reduce((sum, s) => sum + (s.quantity ?? 0), 0)
  }

  const dollarItem = DOLLAR_GROUP_ITEMS.find((i) => i.name.toLowerCase() === lower)
  if (dollarItem) {
    return unitSales
      .filter((s) => s.serviceName === dollarItem.name && s.category === 'Dollar Group')
      .reduce((sum, s) => sum + s.totalAmount, 0)
  }

  return 0
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    options.push({ value, label })
  }
  return options
}

export default function SaleTrackingPage() {
  const [settings, setSettings] = useState<KPISettings | null>(null)
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('unit')
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [allUsers, setAllUsers] = useState<AppUser[]>([])
  const [trackingMode, setTrackingMode] = useState<'my' | 'shop'>('my')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const monthOptions = useMemo(() => getMonthOptions(), [])

  useEffect(() => {
    setSettings(getSettings())
    setCurrentUser(getCurrentUser())
    setAllUsers(getUsers())
  }, [])

  useEffect(() => {
    // Get sales filtered for the selected month
    const [year, month] = selectedMonth.split('-').map(Number)
    const from = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const to = new Date(year, month, 0).toISOString().split('T')[0]
    setAllSales(getSales({ from, to }))
  }, [selectedMonth])

  const isAgent = currentUser?.role === 'agent'
  const isSup = currentUser?.role === 'sup'
  const userBranch = currentUser?.branch || ''

  // Filter sales based on tracking mode
  const sales = useMemo(() => {
    if (!currentUser) return allSales
    if (trackingMode === 'my' && isAgent) {
      return allSales.filter((s) => s.createdBy === currentUser.fullName)
    }
    if (trackingMode === 'shop' || isSup) {
      if (userBranch) {
        const branchUsers = allUsers
          .filter((u) => u.branch === userBranch && (u.role === 'agent' || u.role === 'sup'))
          .map((u) => u.fullName)
        return allSales.filter((s) => branchUsers.includes(s.createdBy))
      }
      return allSales
    }
    return allSales
  }, [allSales, trackingMode, isAgent, isSup, currentUser, userBranch, allUsers])

  const kpiItems = useMemo(() => settings?.kpiItems ?? [], [settings])
  const currentScheme = settings?.currentScheme ?? []
  const newScheme = settings?.newScheme ?? []

  // Get KPIs matching the user's role and branch
  const myKpiItems = useMemo(() => {
    if (!currentUser) return kpiItems
    if (trackingMode === 'my' && (isAgent || isSup)) {
      const role = currentUser.role as 'agent' | 'sup'
      return kpiItems.filter(
        (k) => k.role === role && (!k.branch || k.branch === userBranch),
      )
    }
    if (trackingMode === 'shop') {
      return kpiItems.filter((k) => !k.branch || k.branch === userBranch)
    }
    return kpiItems
  }, [kpiItems, trackingMode, isAgent, isSup, currentUser, userBranch])

  if (!settings || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    )
  }

  // ---- Unit-based tracking ----
  const unitKPIRows = myKpiItems.map((kpi) => {
    const actual = computeKPIActual(kpi.name, sales)
    const level = getLevel(actual, kpi.gateTarget, kpi.otbTarget, kpi.oabTarget)
    return { ...kpi, actual, level }
  })

  // Determine how many KPIs failed (below gate)
  const failedCount = unitKPIRows.filter((r) => r.level === 'below').length
  const maxAllowedFail = 2

  // Compute payment per KPI row using first agent position
  const agentPosition: SIPPositionConfig | undefined = currentScheme.find((p) =>
    p.grouping === 'Frontline',
  )

  function getUnitPaymentForLevel(level: string, position?: SIPPositionConfig): number {
    if (!position || level === 'below') return 0
    if (level === 'oab') return position.oab
    if (level === 'otb') return position.otb
    return position.gate
  }

  const unitPaymentRows = unitKPIRows.map((row) => {
    const basePay = getUnitPaymentForLevel(row.level, agentPosition)
    const payment = failedCount > maxAllowedFail ? 0 : (row.weight / 100) * basePay
    return { ...row, payment }
  })

  const totalUnitPayment = unitPaymentRows.reduce((sum, r) => sum + r.payment, 0)

  // ---- Point-based tracking ----
  const totalPoints = sales
    .filter((s) => s.type === 'point')
    .reduce((sum, s) => sum + (s.pointsEarned ?? 0), 0)

  const pointTrackingRows = newScheme.map((pos) => {
    const level = getLevel(totalPoints, pos.gatePoints, pos.otbPoints, pos.oabPoints, pos.minPoints)
    let payment = 0
    if (level === 'oab') payment = pos.oab
    else if (level === 'otb') payment = pos.otb
    else if (level === 'gate') payment = pos.gate
    else if (level === 'min') payment = pos.min
    return { ...pos, actual: totalPoints, level, payment }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sale Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">
            {trackingMode === 'my'
              ? `Your KPI targets vs actual achievements${userBranch ? ` (${userBranch})` : ''}`
              : `Shop performance (Agent + Sup)${userBranch ? ` – ${userBranch}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tracking Mode Toggle */}
          <div className="flex bg-white border rounded-lg overflow-hidden">
            <button
              onClick={() => setTrackingMode('my')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${trackingMode === 'my' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              My Performance
            </button>
            <button
              onClick={() => setTrackingMode('shop')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${trackingMode === 'shop' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Users size={14} />
              Shop Performance
            </button>
          </div>
          {/* Month Selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {/* View Mode Toggle */}
          <div className="flex bg-white border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('unit')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'unit' ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Unit Based
            </button>
            <button
              onClick={() => setViewMode('point')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'point' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Point Based
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'unit' ? (
        <>
          {/* Unit-Based: KPI Performance */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Target size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">KPI Performance – Unit Based</h2>
                <p className="text-sm text-gray-500">Target vs Actual for each KPI item</p>
              </div>
              {failedCount > maxAllowedFail && (
                <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">
                  ⚠ Payment forfeited: {failedCount} KPIs failed (max {maxAllowedFail} failures allowed)
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">No.</th>
                    <th className="px-3 py-2 font-medium">KPI Name</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium text-right">WT (%)</th>
                    <th className="px-3 py-2 font-medium text-right">Gate</th>
                    <th className="px-3 py-2 font-medium text-right">OTB</th>
                    <th className="px-3 py-2 font-medium text-right">OAB</th>
                    <th className="px-3 py-2 font-medium text-right">Actual</th>
                    <th className="px-3 py-2 font-medium text-center">Level</th>
                    <th className="px-3 py-2 font-medium text-right">Payment ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unitPaymentRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${row.role === 'sup' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {row.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{row.weight}%</td>
                      <td className="px-3 py-2 text-right text-gray-600">{row.gateTarget.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{row.otbTarget.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{row.oabTarget.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.actual.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center"><LevelBadge level={row.level} /></td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.payment > 0 ? `$${row.payment.toFixed(2)}` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-3 py-3" colSpan={3}>Total</td>
                    <td className="px-3 py-3 text-right">{myKpiItems.reduce((s, r) => s + r.weight, 0)}%</td>
                    <td colSpan={5} />
                    <td className="px-3 py-3 text-right text-lg">${totalUnitPayment.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Unit-Based: Position Payment Reference */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Target size={20} className="text-slate-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Incentive Payment Range – Current Scheme</h2>
                <p className="text-sm text-gray-500">Reference payment ranges per position</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Position</th>
                    <th className="px-3 py-2 font-medium text-right">Gate ($)</th>
                    <th className="px-3 py-2 font-medium text-right">OTB ($)</th>
                    <th className="px-3 py-2 font-medium text-right">OAB ($)</th>
                    <th className="px-3 py-2 font-medium text-right">Annual Bonus (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentScheme.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{row.position}</td>
                      <td className="px-3 py-2 text-right">${row.gate}</td>
                      <td className="px-3 py-2 text-right">${row.otb}</td>
                      <td className="px-3 py-2 text-right">${row.oab}</td>
                      <td className="px-3 py-2 text-right">{row.annualBonus}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">** Yearly bonus {currentScheme[0]?.annualBonus ?? 25}%</p>
          </div>
        </>
      ) : (
        <>
          {/* Point-Based: Point Target Tracking */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Point Target Tracking – Point Based</h2>
                <p className="text-sm text-gray-500">Actual points vs targets per position</p>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 flex items-center gap-4">
              <div className="p-3 bg-green-600 rounded-lg">
                <Target size={24} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Total Points Earned This Month</p>
                <p className="text-3xl font-bold text-green-900">{totalPoints.toLocaleString()}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Position</th>
                    <th className="px-3 py-2 font-medium text-right bg-yellow-50">Min (pts)</th>
                    <th className="px-3 py-2 font-medium text-right">Gate (pts)</th>
                    <th className="px-3 py-2 font-medium text-right">OTB (pts)</th>
                    <th className="px-3 py-2 font-medium text-right">OAB (pts)</th>
                    <th className="px-3 py-2 font-medium text-right">Actual</th>
                    <th className="px-3 py-2 font-medium text-center">Level</th>
                    <th className="px-3 py-2 font-medium text-right">Payment ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pointTrackingRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{row.position}</td>
                      <td className="px-3 py-2 text-right bg-yellow-50 font-medium">{row.minPoints.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{row.gatePoints.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{row.otbPoints.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{row.oabPoints.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.actual.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center"><LevelBadge level={row.level} /></td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.payment > 0 ? `$${row.payment.toFixed(2)}` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Point-Based: Incentive Payment Range Reference */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Target size={20} className="text-slate-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Incentive Payment Range – Point Based</h2>
                <p className="text-sm text-gray-500">Reference payment ranges per position</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Position</th>
                    <th className="px-3 py-2 font-medium text-right bg-yellow-50">Min ($)</th>
                    <th className="px-3 py-2 font-medium text-right">Gate ($)</th>
                    <th className="px-3 py-2 font-medium text-right">OTB ($)</th>
                    <th className="px-3 py-2 font-medium text-right">OAB ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {newScheme.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{row.position}</td>
                      <td className="px-3 py-2 text-right bg-yellow-50 font-medium">${row.min}</td>
                      <td className="px-3 py-2 text-right">${row.gate}</td>
                      <td className="px-3 py-2 text-right">${row.otb}</td>
                      <td className="px-3 py-2 text-right">${row.oab}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">** 25% bonus to be added to monthly in separate proposal. Min = 75%–85% (based on Mgt Approval).</p>
          </div>
        </>
      )}
    </div>
  )
}
