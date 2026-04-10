'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ShoppingBag, DollarSign, Zap, TrendingUp, TrendingDown, Star, RefreshCw, ChevronDown } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import Modal from '@/components/Modal'
import {
  getDashboardData,
  getCurrentUser,
  updateTopup,
  getKPIs,
  getUsers,
  getBranches,
  computeKPIAchievement,
  getSales,
  type DashboardData,
  type TopUp,
  type KPIRecord,
  type AppUser,
  UNIT_GROUP_ITEMS,
  DOLLAR_GROUP_ITEMS,
  TOPUP_PRODUCTS,
} from '@/lib/store'

type ViewMode = 'unit' | 'point'
type ChartRange = 'weekly' | 'monthly'

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444']

function calcGrowth(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return 100
  return ((current - previous) / previous) * 100
}

function GrowthBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  const pct = calcGrowth(current, previous)
  if (pct === null) return null
  const isUp = pct >= 0
  const direction = isUp ? 'up' : 'down'
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-gray-500">{label}:</span>
      <span
        className={`flex items-center gap-0.5 font-semibold ${isUp ? 'text-green-600' : 'text-red-600'}`}
        aria-label={`${label}: ${isUp ? '+' : ''}${pct.toFixed(1)}% ${direction}`}
      >
        {isUp ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
        {isUp ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </div>
  )
}

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

const todayStr = () => new Date().toISOString().split('T')[0]

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (Math.PI / 180) * startAngle
  const endRad = (Math.PI / 180) * endAngle
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy - r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy - r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`
}

function HalfGauge({ percentage, label, sublabel }: { percentage: number; label: string; sublabel?: string }) {
  const clamped = Math.min(Math.max(percentage, 0), 100)
  const color = clamped < 50 ? '#ef4444' : clamped < 100 ? '#f59e0b' : '#10b981'
  const fillAngle = 180 + (clamped / 100) * 180
  const bgPath = describeArc(50, 50, 40, 0, 180)
  const fillPath = clamped > 0 ? describeArc(50, 50, 40, 180, fillAngle) : ''
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 10 100 50" className="w-32 h-16">
        <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth={8} strokeLinecap="round" />
        {clamped > 0 && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
        )}
        <text x="50" y="50" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
          {Math.round(percentage)}%
        </text>
      </svg>
      <p className="text-xs font-semibold text-gray-700 mt-1 text-center leading-tight">{label}</p>
      {sublabel && (
        <span className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {sublabel}
        </span>
      )}
    </div>
  )
}

interface KPIComputedRow {
  kpi: KPIRecord
  actual: number
  target: number
  achievementPct: number
  tier: 'oab' | 'otb' | 'gate' | 'min' | 'below'
  assigneeName: string
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('point')
  const [chartRange, setChartRange] = useState<ChartRange>('weekly')
  const [showAllExpiring, setShowAllExpiring] = useState(false)

  // Update Payment modal state
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updatingTopup, setUpdatingTopup] = useState<TopUp | null>(null)
  const [updateForm, setUpdateForm] = useState({
    product: '',
    lastTopUpDate: todayStr(),
    paymentPeriod: '1',
  })
  const [saving, setSaving] = useState(false)

  // KPI Performance section state
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [selectedKpiMonth, setSelectedKpiMonth] = useState(currentMonth)
  const [selectedKpiBranch, setSelectedKpiBranch] = useState('all')
  const [kpiData, setKpiData] = useState<KPIComputedRow[]>([])

  const currentUser = getCurrentUser()

  const reload = () => {
    try {
      setData(getDashboardData())
    } catch {
      // leave data null
    }
  }

  useEffect(() => {
    reload()
    setLoading(false)
  }, [])

  // Load KPI data when filters change
  useEffect(() => {
    if (!currentUser) return
    try {
      const allUsers = getUsers()
      const allKpis = getKPIs({ month: selectedKpiMonth })
      const [year, month] = selectedKpiMonth.split('-')
      const monthStart = `${year}-${month}-01`
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
      const sales = getSales({ from: monthStart, to: monthEnd })

      let visibleKpis: KPIRecord[]
      if (currentUser.role === 'admin') {
        if (selectedKpiBranch === 'all') {
          visibleKpis = allKpis
        } else {
          const branchUserIds = new Set(allUsers.filter((u) => u.branch === selectedKpiBranch).map((u) => u.id))
          visibleKpis = allKpis.filter((k) => branchUserIds.has(k.assigneeId))
        }
      } else if (currentUser.role === 'sup') {
        const branchUserIds = new Set(allUsers.filter((u) => u.branch === currentUser.branch).map((u) => u.id))
        visibleKpis = allKpis.filter((k) => k.assigneeType === 'shop' && branchUserIds.has(k.assigneeId))
      } else {
        // agent: own agent KPIs + shop KPIs for their branch
        const branchUserIds = new Set(allUsers.filter((u) => u.branch === currentUser.branch).map((u) => u.id))
        visibleKpis = allKpis.filter(
          (k) => (k.assigneeType === 'agent' && k.assigneeId === currentUser.id) ||
                 (k.assigneeType === 'shop' && branchUserIds.has(k.assigneeId))
        )
      }

      const rows: KPIComputedRow[] = visibleKpis.map((kpi) => {
        const result = computeKPIAchievement(kpi, sales, allUsers)
        const assignee = allUsers.find((u) => u.id === kpi.assigneeId)
        return { kpi, ...result, assigneeName: assignee?.fullName ?? 'Unknown' }
      })
      setKpiData(rows)
    } catch {
      setKpiData([])
    }
  }, [selectedKpiMonth, selectedKpiBranch, currentUser])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-red-500">Failed to load dashboard data.</div>
  }

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), 'MMM d')
    } catch {
      return d
    }
  }

  const formatMonth = (m: string) => {
    try {
      const [year, month] = m.split('-')
      return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy')
    } catch {
      return m
    }
  }

  const weeklyChartData = data.weeklyData.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }))

  const monthlyChartData = data.monthlyData.map((d) => ({
    ...d,
    month: formatMonth(d.month),
  }))

  const now = new Date()
  const getTopupStatus = (expireDate: string) => {
    const exp = new Date(expireDate)
    const diff = exp.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700' }
    if (days <= 30) return { label: `${days}d left`, color: 'bg-amber-100 text-amber-700' }
    return { label: 'Active', color: 'bg-green-100 text-green-700' }
  }

  const unitSummary = data.unitSummaryToday
  const pointSummary = data.pointSummaryToday

  // Handle "Update Payment" button click
  const openUpdateModal = (topup: TopUp) => {
    setUpdatingTopup(topup)
    setUpdateForm({
      product: TOPUP_PRODUCTS.includes(topup.product as typeof TOPUP_PRODUCTS[number])
        ? topup.product
        : '',
      lastTopUpDate: todayStr(),
      paymentPeriod: String(topup.paymentPeriod || 1),
    })
    setUpdateModalOpen(true)
  }

  const computedUpdateExpire = () => {
    try {
      return addMonths(
        new Date(updateForm.lastTopUpDate),
        parseInt(updateForm.paymentPeriod) || 0
      )
    } catch {
      return null
    }
  }

  const handleUpdatePayment = () => {
    if (!updatingTopup) return
    setSaving(true)
    const expire = computedUpdateExpire()
    updateTopup(updatingTopup.id, {
      product: updateForm.product,
      lastTopUpDate: updateForm.lastTopUpDate,
      paymentPeriod: parseInt(updateForm.paymentPeriod),
      expireDate: expire ? expire.toISOString() : new Date().toISOString(),
      createdBy: currentUser?.fullName ?? '',
    })
    setSaving(false)
    setUpdateModalOpen(false)
    setUpdatingTopup(null)
    reload()
  }

  const updateExpirePreview = computedUpdateExpire()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['unit', 'point'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {mode === 'unit' ? 'Unit Based' : 'Point Based'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {viewMode === 'unit' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            title="Total Sales Today"
            value={data.kpis.salesToday}
            icon={ShoppingBag}
            color="bg-blue-500"
            subtitle="transactions"
          />
          <KPICard
            title="Total Units Today"
            value={unitSummary.totalUnits}
            icon={ShoppingBag}
            color="bg-indigo-500"
            subtitle="units"
          />
          <KPICard
            title="Total Revenue Today"
            value={`$${unitSummary.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            color="bg-green-500"
          />
          <KPICard
            title="Active Top-ups"
            value={data.kpis.activeTopups}
            icon={Zap}
            color="bg-orange-500"
            subtitle="subscriptions"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            title="Total Sales Today"
            value={data.kpis.salesToday}
            icon={ShoppingBag}
            color="bg-blue-500"
            subtitle="transactions"
          />
          <KPICard
            title="Total Points Today"
            value={pointSummary.totalPoints}
            icon={Star}
            color="bg-purple-500"
            subtitle="points"
          />
          <KPICard
            title="Active Top-ups"
            value={data.kpis.activeTopups}
            icon={Zap}
            color="bg-orange-500"
            subtitle="subscriptions"
          />
        </div>
      )}

      {/* KPI Performance Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">KPI Performance</h2>
          <div className="flex items-center gap-3">
            <select
              value={selectedKpiMonth}
              onChange={(e) => setSelectedKpiMonth(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date()
                d.setDate(1)
                d.setMonth(d.getMonth() - i)
                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                return (
                  <option key={val} value={val}>
                    {format(d, 'MMM yyyy')}
                  </option>
                )
              })}
            </select>
            {currentUser?.role === 'admin' && (
              <select
                value={selectedKpiBranch}
                onChange={(e) => setSelectedKpiBranch(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="all">All Branches</option>
                {getBranches().map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {kpiData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No KPIs found for this period</p>
        ) : (
          <>
            {/* Gauge Charts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
              {kpiData.map((row) => (
                <HalfGauge
                  key={row.kpi.id}
                  percentage={row.achievementPct}
                  label={row.kpi.name}
                  sublabel={row.kpi.mode === 'volume' ? 'Volume' : 'Point'}
                />
              ))}
            </div>

            {/* Summary Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">KPI Name</th>
                    <th className="pb-3 font-medium">Mode</th>
                    <th className="pb-3 font-medium">Assignee</th>
                    <th className="pb-3 font-medium text-right">Target</th>
                    <th className="pb-3 font-medium text-right">Actual</th>
                    <th className="pb-3 font-medium text-right">Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {kpiData.map((row) => {
                    const pctColor =
                      row.achievementPct >= 100
                        ? 'bg-green-100 text-green-700'
                        : row.achievementPct >= 50
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                    return (
                      <tr key={row.kpi.id} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{row.kpi.name}</td>
                        <td className="py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              row.kpi.mode === 'volume'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {row.kpi.mode === 'volume' ? 'Volume' : 'Point'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              row.kpi.assigneeType === 'shop'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-teal-100 text-teal-700'
                            }`}
                          >
                            {row.kpi.assigneeType === 'shop' ? 'Shop' : 'Agent'}
                          </span>
                          <span className="ml-1 text-xs text-gray-500">{row.assigneeName}</span>
                        </td>
                        <td className="py-3 text-right text-gray-600">{row.target}</td>
                        <td className="py-3 text-right text-gray-900 font-medium">{Number(row.actual.toFixed(2))}</td>
                        <td className="py-3 text-right">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${pctColor}`}>
                            {row.achievementPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Today's Breakdown */}
      {viewMode === 'unit' ? (
        <div className="space-y-6">
          {/* Unit Group & Dollar Group Lists */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Unit Group */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                Unit Group — Today
              </h2>
              <div className="space-y-3">
                {UNIT_GROUP_ITEMS.map((item) => {
                  const val = unitSummary.unitGroup[item.name] ?? 0
                  return (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      <span className="text-sm font-bold text-blue-700">{val} units</span>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-semibold text-blue-800">Total</span>
                  <span className="text-sm font-bold text-blue-800">{unitSummary.totalUnits} units</span>
                </div>
              </div>
            </div>

            {/* Dollar Group */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Dollar Group — Today
              </h2>
              <div className="space-y-3">
                {DOLLAR_GROUP_ITEMS.map((item) => {
                  const val = unitSummary.dollarGroup[item.name] ?? 0
                  return (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      <span className="text-sm font-bold text-green-700">${val.toFixed(2)}</span>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm font-semibold text-green-800">Total Revenue</span>
                  <span className="text-sm font-bold text-green-800">${unitSummary.totalRevenue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Unit Group & Dollar Group Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Unit Group Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                Unit Group Chart — Today
              </h2>
              {unitSummary.totalUnits === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  No unit sales recorded today
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={UNIT_GROUP_ITEMS.map((item) => ({
                      name: item.name,
                      units: unitSummary.unitGroup[item.name] ?? 0,
                    }))}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip />
                    <Bar dataKey="units" name="Units" radius={[0, 4, 4, 0]}>
                      {UNIT_GROUP_ITEMS.map((_, index) => (
                        <Cell key={`unit-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Dollar Group Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Dollar Group Chart — Today
              </h2>
              {unitSummary.totalRevenue === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  No dollar sales recorded today
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={DOLLAR_GROUP_ITEMS.map((item) => ({
                      name: item.name,
                      revenue: unitSummary.dollarGroup[item.name] ?? 0,
                    }))}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="revenue" name="Revenue ($)" radius={[0, 4, 4, 0]}>
                      {DOLLAR_GROUP_ITEMS.map((_, index) => (
                        <Cell key={`dollar-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Point mode: Points by Category + Weekly Sales side by side */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              Points by Category — Today
            </h2>
            {data.pointCategoryChart.every((c) => c.points === 0) ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                No point sales recorded today
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={data.pointCategoryChart.filter((c) => c.points > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={4}
                      dataKey="points"
                      nameKey="category"
                      label={({ x, y, category, percent }) => (
                        <text
                          x={x}
                          y={y}
                          fill="#374151"
                          fontSize={12}
                          fontWeight={600}
                          textAnchor="middle"
                          dominantBaseline="central"
                          stroke="#fff"
                          strokeWidth={3}
                          paintOrder="stroke"
                        >
                          {`${category} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )}
                      labelLine={true}
                    >
                      {data.pointCategoryChart
                        .filter((c) => c.points > 0)
                        .map((_, index) => (
                          <Cell key={`doughnut-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value} pts`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Weekly/Monthly Sales Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-slate-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {chartRange === 'weekly' ? 'Weekly Sales' : 'Monthly Sales'}
                </h2>
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['weekly', 'monthly'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      chartRange === range
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {range === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mb-4 px-1">
              {chartRange === 'weekly' ? (
                <>
                  <GrowthBadge current={data.weeklyComparison.thisWeekUnits} previous={data.weeklyComparison.lastWeekUnits} label="Units vs last week" />
                  <GrowthBadge current={data.weeklyComparison.thisWeekPoints} previous={data.weeklyComparison.lastWeekPoints} label="Points vs last week" />
                  <GrowthBadge current={data.weeklyComparison.thisWeekRevenue} previous={data.weeklyComparison.lastWeekRevenue} label="Revenue vs last week" />
                </>
              ) : (
                <>
                  <GrowthBadge current={data.monthlyComparison.thisMonthUnits} previous={data.monthlyComparison.lastMonthUnits} label="Units vs last month" />
                  <GrowthBadge current={data.monthlyComparison.thisMonthPoints} previous={data.monthlyComparison.lastMonthPoints} label="Points vs last month" />
                  <GrowthBadge current={data.monthlyComparison.thisMonthRevenue} previous={data.monthlyComparison.lastMonthRevenue} label="Revenue vs last month" />
                </>
              )}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartRange === 'weekly' ? weeklyChartData : monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={chartRange === 'weekly' ? 'date' : 'month'} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="units" fill="#3b82f6" name="Units" radius={[4, 4, 0, 0]} />
                <Bar dataKey="points" fill="#8b5cf6" name="Points" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sales Chart (full width, unit mode only) */}
      {viewMode === 'unit' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-slate-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {chartRange === 'weekly' ? 'Weekly Sales' : 'Monthly Sales'}
              </h2>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['weekly', 'monthly'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setChartRange(range)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartRange === range
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-4 px-1">
            {chartRange === 'weekly' ? (
              <>
                <GrowthBadge current={data.weeklyComparison.thisWeekUnits} previous={data.weeklyComparison.lastWeekUnits} label="Units vs last week" />
                <GrowthBadge current={data.weeklyComparison.thisWeekPoints} previous={data.weeklyComparison.lastWeekPoints} label="Points vs last week" />
                <GrowthBadge current={data.weeklyComparison.thisWeekRevenue} previous={data.weeklyComparison.lastWeekRevenue} label="Revenue vs last week" />
              </>
            ) : (
              <>
                <GrowthBadge current={data.monthlyComparison.thisMonthUnits} previous={data.monthlyComparison.lastMonthUnits} label="Units vs last month" />
                <GrowthBadge current={data.monthlyComparison.thisMonthPoints} previous={data.monthlyComparison.lastMonthPoints} label="Points vs last month" />
                <GrowthBadge current={data.monthlyComparison.thisMonthRevenue} previous={data.monthlyComparison.lastMonthRevenue} label="Revenue vs last month" />
              </>
            )}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRange === 'weekly' ? weeklyChartData : monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={chartRange === 'weekly' ? 'date' : 'month'} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="units" fill="#3b82f6" name="Units" radius={[4, 4, 0, 0]} />
              <Bar dataKey="points" fill="#8b5cf6" name="Points" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expiring Soon — Full width */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Expiring Soon</h2>
          <span className="text-xs text-gray-400 ml-1">(next 7 days)</span>
          {data.expiringTopups.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium ml-auto">
              {data.expiringTopups.length} total
            </span>
          )}
        </div>
        {data.expiringTopups.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No expiring top-ups</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {(showAllExpiring ? data.expiringTopups : data.expiringTopups.slice(0, 5)).map((t) => {
                const status = getTopupStatus(t.expireDate)
                return (
                  <div key={t.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.customerName}</p>
                        <p className="text-xs text-gray-500">{t.product}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Expires: {format(new Date(t.expireDate), 'MMM d, yyyy')}
                    </p>
                    <button
                      onClick={() => openUpdateModal(t)}
                      className="w-full flex items-center justify-center gap-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Update Payment
                    </button>
                  </div>
                )
              })}
            </div>
            {data.expiringTopups.length > 5 && !showAllExpiring && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowAllExpiring(true)}
                  className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <ChevronDown size={16} />
                  Show More ({data.expiringTopups.length - 5} more)
                </button>
              </div>
            )}
            {showAllExpiring && data.expiringTopups.length > 5 && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowAllExpiring(false)}
                  className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Show Less
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        {data.recentSales.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-medium">Service</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Details</th>
                  <th className="pb-3 font-medium">Agent</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium">{sale.serviceName ?? '—'}</td>
                    <td className="py-3 text-gray-500">{sale.category ?? '—'}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          sale.type === 'unit'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {sale.type === 'unit' ? 'Unit' : 'Point'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">
                      {sale.type === 'unit'
                        ? sale.category === 'Dollar Group'
                          ? `$${sale.totalAmount.toFixed(2)}`
                          : `${sale.quantity ?? 0} units`
                        : `${sale.quantity ?? 0} qty → ${sale.pointsEarned ?? 0} pts`}
                    </td>
                    <td className="py-3 text-gray-500">{sale.createdBy || '—'}</td>
                    <td className="py-3 text-gray-500">
                      {format(new Date(sale.date), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Payment Modal */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => { setUpdateModalOpen(false); setUpdatingTopup(null) }}
        title="Update Payment"
      >
        <div className="space-y-4">
          {/* Username (read-only, from login) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={currentUser?.fullName ?? ''}
              readOnly
              className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-600 focus:outline-none"
            />
          </div>

          {updatingTopup && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-blue-800">Customer: {updatingTopup.customerName}</p>
              <p className="text-blue-600 text-xs mt-1">Phone: {updatingTopup.customerPhone}</p>
            </div>
          )}

          {/* Product Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
            <select
              value={updateForm.product}
              onChange={(e) => setUpdateForm({ ...updateForm, product: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Select product —</option>
              {TOPUP_PRODUCTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Last Top Up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Top Up Date *</label>
            <input
              type="date"
              value={updateForm.lastTopUpDate}
              onChange={(e) => setUpdateForm({ ...updateForm, lastTopUpDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Payment Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Period (months) *</label>
            <input
              type="number"
              value={updateForm.paymentPeriod}
              onChange={(e) => setUpdateForm({ ...updateForm, paymentPeriod: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. 1, 3, 6, 12"
              min="1"
            />
          </div>

          {updateExpirePreview && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              <span className="font-medium text-green-800">New Expire Date: </span>
              <span className="text-green-700">{format(updateExpirePreview, 'MMMM d, yyyy')}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setUpdateModalOpen(false); setUpdatingTopup(null) }}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdatePayment}
              disabled={saving || !updateForm.product}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Update Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
