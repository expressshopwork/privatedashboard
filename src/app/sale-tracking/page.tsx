'use client'

import { useEffect, useState, useMemo } from 'react'
import { Target, ChevronDown, Users, Calendar, TrendingUp, Award } from 'lucide-react'
import {
  getKPIs,
  getSales,
  getCurrentUser,
  getUsers,
  computeKPIAchievement,
  type KPIRecord,
  type Sale,
  type AppUser,
} from '@/lib/store'

type TabKey = 'tracking' | 'performance'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Build "YYYY-MM" strings for the last N months */
function lastNMonths(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}

/** Pretty-print a YYYY-MM string */
function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

/** Day name abbreviation */
function dayName(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

/** Number of days in a month */
function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m), 0).getDate()
}

/** Remaining calendar days in the month from today (inclusive of today) */
function remainingDays(ym: string): number {
  const today = new Date()
  const todayYM = today.toISOString().slice(0, 7)
  if (ym < todayYM) return 0
  if (ym > todayYM) return daysInMonth(ym)
  return daysInMonth(ym) - today.getDate() + 1
}

/** Pad day to DD */
function padDay(d: number): string {
  return d < 10 ? '0' + d : '' + d
}

/** Format number with comma separator */
function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

/** Tier display config */
const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  oab: { bg: 'bg-green-100', text: 'text-green-800', label: 'OAB' },
  otb: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'OTB' },
  gate: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Gate' },
  min: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'MIN' },
  below: { bg: 'bg-red-100', text: 'text-red-800', label: 'Below MIN' },
}

/** Achievement color */
function achColor(pct: number): string {
  if (pct >= 100) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function achBg(pct: number): string {
  if (pct >= 100) return 'bg-green-50'
  if (pct >= 50) return 'bg-yellow-50'
  return 'bg-red-50'
}

/* ------------------------------------------------------------------ */
/*  Half-doughnut gauge (SVG)                                         */
/* ------------------------------------------------------------------ */

function HalfGauge({ pct, size = 120 }: { pct: number; size?: number }) {
  const cappedPct = Math.min(pct, 100)
  const r = (size - 12) / 2
  const cx = size / 2
  const cy = size / 2 + 4

  // Arc from 180° to 0° (left to right, semi-circle)
  const startAngle = Math.PI
  const endAngle = Math.PI - (cappedPct / 100) * Math.PI

  const bgArcEnd = 0
  const bgX2 = cx + r * Math.cos(bgArcEnd)
  const bgY2 = cy - r * Math.sin(bgArcEnd)
  const bgX1 = cx + r * Math.cos(startAngle)
  const bgY1 = cy - r * Math.sin(startAngle)

  const fgX1 = bgX1
  const fgY1 = bgY1
  const fgX2 = cx + r * Math.cos(endAngle)
  const fgY2 = cy - r * Math.sin(endAngle)
  const largeArc = cappedPct > 50 ? 1 : 0

  const bgPath = `M ${bgX1} ${bgY1} A ${r} ${r} 0 1 1 ${bgX2} ${bgY2}`
  const fgPath =
    cappedPct > 0
      ? `M ${fgX1} ${fgY1} A ${r} ${r} 0 ${largeArc} 1 ${fgX2} ${fgY2}`
      : ''

  let stroke = '#ef4444'
  if (pct >= 100) stroke = '#22c55e'
  else if (pct >= 50) stroke = '#eab308'

  return (
    <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
      <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth={10} strokeLinecap="round" />
      {fgPath && (
        <path d={fgPath} fill="none" stroke={stroke} strokeWidth={10} strokeLinecap="round" />
      )}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="text-lg font-bold"
        fill={stroke}
        fontSize={size * 0.17}
      >
        {fmtNum(pct, 0)}%
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Dropdown component                                                */
/* ------------------------------------------------------------------ */

function Dropdown({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`appearance-none w-full ${icon ? 'pl-8' : 'pl-3'} pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function SaleTrackingPage() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('tracking')

  // Filters
  const months = useMemo(() => lastNMonths(12), [])
  const [selectedMonth, setSelectedMonth] = useState(months[0])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [selectedKPIId, setSelectedKPIId] = useState<string>('all')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  // Data
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [allUsers, setAllUsers] = useState<AppUser[]>([])
  const [kpis, setKpis] = useState<KPIRecord[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  // Load data
  useEffect(() => {
    const user = getCurrentUser()
    const users = getUsers()
    setCurrentUser(user)
    setAllUsers(users)
    if (user) {
      setSelectedAgentId(String(user.id))
    }
    setLoading(false)
  }, [])

  // Reload KPIs + sales whenever filters change
  useEffect(() => {
    if (!currentUser) return
    const agentId = selectedAgentId ? Number(selectedAgentId) : currentUser.id
    setKpis(getKPIs({ month: selectedMonth, assigneeId: agentId }))

    // Get sales for the selected month
    const [y, m] = selectedMonth.split('-')
    const from = `${y}-${m}-01`
    const lastDay = daysInMonth(selectedMonth)
    const to = `${y}-${m}-${padDay(lastDay)}`
    setSales(getSales({ from, to }))
  }, [selectedMonth, selectedAgentId, currentUser])

  // Role-based KPI visibility
  const visibleKPIs = useMemo(() => {
    if (!currentUser) return []
    const agentId = selectedAgentId ? Number(selectedAgentId) : currentUser.id
    const agent = allUsers.find((u) => u.id === agentId)

    if (currentUser.role === 'admin') {
      // Admin sees all KPIs, optionally filtered by branch
      let all = getKPIs({ month: selectedMonth })
      if (selectedBranch !== 'all') {
        const branchUserIds = new Set(allUsers.filter((u) => u.branch === selectedBranch).map((u) => u.id))
        all = all.filter((k) => branchUserIds.has(k.assigneeId))
      }
      return all
    }
    if (currentUser.role === 'sup') {
      // Supervisor sees shop KPIs for their branch
      const branchUserIds = new Set(
        allUsers.filter((u) => u.branch === currentUser.branch).map((u) => u.id)
      )
      return getKPIs({ month: selectedMonth }).filter(
        (k) => k.assigneeType === 'shop' && branchUserIds.has(k.assigneeId)
      )
    }
    // Agent: own agent KPIs + shop KPIs for their branch
    const branchSups = allUsers.filter((u) => u.branch === (agent?.branch ?? currentUser.branch) && u.role === 'sup')
    const shopKpis = getKPIs({ month: selectedMonth }).filter(
      (k) => k.assigneeType === 'shop' && branchSups.some((s) => s.id === k.assigneeId)
    )
    const agentKpis = getKPIs({ month: selectedMonth, assigneeId: agentId }).filter(
      (k) => k.assigneeType === 'agent'
    )
    return [...agentKpis, ...shopKpis]
  }, [currentUser, selectedMonth, selectedAgentId, selectedBranch, allUsers])

  // Agent options for dropdown
  const agentOptions = useMemo(() => {
    if (!currentUser) return []
    if (currentUser.role === 'agent') {
      return [{ value: String(currentUser.id), label: currentUser.fullName }]
    }
    // Admin/Sup can pick agents
    let agents = allUsers.filter((u) => u.status === 'active')
    if (currentUser.role === 'sup') {
      agents = agents.filter((u) => u.branch === currentUser.branch)
    }
    return agents.map((u) => ({ value: String(u.id), label: `${u.fullName} (${u.role})` }))
  }, [currentUser, allUsers])

  // Branch options for admin
  const branchOptions = useMemo(() => {
    const branches = [...new Set(allUsers.map((u) => u.branch))].sort()
    return [{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: b, label: b }))]
  }, [allUsers])

  // KPI filter options
  const kpiOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'All KPIs' }]
    return [...base, ...visibleKPIs.map((k) => ({ value: String(k.id), label: k.name }))]
  }, [visibleKPIs])

  // The KPI currently selected for the tracking tab
  const activeKPI = useMemo(() => {
    if (selectedKPIId === 'all') return null
    return visibleKPIs.find((k) => String(k.id) === selectedKPIId) ?? null
  }, [selectedKPIId, visibleKPIs])

  // Compute achievements for all visible KPIs
  const achievements = useMemo(() => {
    return visibleKPIs.map((kpi) => ({
      kpi,
      ...computeKPIAchievement(kpi, sales, allUsers),
    }))
  }, [visibleKPIs, sales, allUsers])

  // Day-by-day data for tracking tab
  const dailyData = useMemo(() => {
    const days = daysInMonth(selectedMonth)
    const [y, m] = selectedMonth.split('-')

    // Determine which sales to count and how to value them
    const relevantKPIs = activeKPI ? [activeKPI] : visibleKPIs
    const isPoint = activeKPI ? activeKPI.mode === 'point' : relevantKPIs.some((k) => k.mode === 'point')

    // Group sales by day
    const dayMap: Record<string, number> = {}
    for (let d = 1; d <= days; d++) {
      dayMap[`${y}-${m}-${padDay(d)}`] = 0
    }

    for (const sale of sales) {
      const saleDate = sale.date.slice(0, 10)
      if (!(saleDate in dayMap)) continue

      if (isPoint) {
        dayMap[saleDate] += sale.kpiPoints ?? sale.pointsEarned ?? 0
      } else if (activeKPI?.volumeValueMode === 'unit') {
        dayMap[saleDate] += sale.quantity ?? 0
      } else {
        dayMap[saleDate] += sale.totalAmount
      }
    }

    let cumulative = 0
    return Array.from({ length: days }, (_, i) => {
      const d = i + 1
      const dateStr = `${y}-${m}-${padDay(d)}`
      const val = dayMap[dateStr] ?? 0
      cumulative += val
      return { day: d, date: dateStr, dayLabel: dayName(dateStr), value: val, cumulative }
    })
  }, [selectedMonth, sales, activeKPI, visibleKPIs])

  // Summary stats for tracking
  const trackingSummary = useMemo(() => {
    const total = dailyData.length > 0 ? dailyData[dailyData.length - 1].cumulative : 0
    const remaining = remainingDays(selectedMonth)

    if (activeKPI) {
      const ach = achievements.find((a) => a.kpi.id === activeKPI.id)
      if (activeKPI.mode === 'point') {
        const gate = activeKPI.pointGate ?? 0
        const dailyNeeded = total >= gate || remaining <= 0 ? null : (gate - total) / remaining
        return {
          mode: 'point' as const,
          total,
          min: activeKPI.pointMin ?? 0,
          gate,
          otb: activeKPI.pointOtb ?? 0,
          oab: activeKPI.pointOab ?? 0,
          dailyNeeded,
          tier: ach?.tier ?? 'below',
        }
      }
      const target = activeKPI.volumeTarget ?? 0
      const dailyNeeded = total >= target || remaining <= 0 ? null : (target - total) / remaining
      return {
        mode: 'volume' as const,
        total,
        target,
        actual: ach?.actual ?? total,
        dailyNeeded,
        tier: ach?.tier ?? 'below',
        valueMode: activeKPI.volumeValueMode ?? 'unit',
        currencyType: activeKPI.currencyType,
      }
    }

    // "All KPIs" — show aggregate point-based summary if any
    const pointKpis = visibleKPIs.filter((k) => k.mode === 'point')
    if (pointKpis.length > 0) {
      const gate = pointKpis.reduce((s, k) => s + (k.pointGate ?? 0), 0)
      const remaining2 = remainingDays(selectedMonth)
      const dailyNeeded = total >= gate || remaining2 <= 0 ? null : (gate - total) / remaining2
      return {
        mode: 'point' as const,
        total,
        min: pointKpis.reduce((s, k) => s + (k.pointMin ?? 0), 0),
        gate,
        otb: pointKpis.reduce((s, k) => s + (k.pointOtb ?? 0), 0),
        oab: pointKpis.reduce((s, k) => s + (k.pointOab ?? 0), 0),
        dailyNeeded,
        tier: 'below' as const,
      }
    }

    return { mode: 'volume' as const, total, target: 0, actual: total, dailyNeeded: null, tier: 'below' as const, valueMode: 'unit' as const }
  }, [dailyData, activeKPI, achievements, visibleKPIs, selectedMonth])

  const todayStr = new Date().toISOString().slice(0, 10)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="p-6 text-center text-gray-500">Please log in to view sale tracking.</div>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* ── Page title ── */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Target className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sale Tracking / Performance</h1>
          <p className="text-sm text-gray-500">Track daily progress and KPI achievements</p>
        </div>
      </div>

      {/* ── Tab buttons ── */}
      <div className="flex gap-2">
        {(['tracking', 'performance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t === 'tracking' ? 'Sale Tracking' : 'Performance'}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4">
          <Dropdown
            label="Month"
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={months.map((m) => ({ value: m, label: fmtMonth(m) }))}
            icon={<Calendar className="w-4 h-4" />}
          />

          {(currentUser.role === 'admin' || currentUser.role === 'sup') && (
            <Dropdown
              label="Agent"
              value={selectedAgentId}
              onChange={(v) => {
                setSelectedAgentId(v)
                setSelectedKPIId('all')
              }}
              options={agentOptions}
              icon={<Users className="w-4 h-4" />}
            />
          )}

          {currentUser.role === 'admin' && (
            <Dropdown
              label="Branch"
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={branchOptions}
            />
          )}

          {tab === 'tracking' && (
            <Dropdown
              label="KPI"
              value={selectedKPIId}
              onChange={setSelectedKPIId}
              options={kpiOptions}
              icon={<Target className="w-4 h-4" />}
            />
          )}
        </div>
      </div>

      {/* ── Tab content ── */}
      {tab === 'tracking' ? (
        <TrackingTab
          summary={trackingSummary}
          dailyData={dailyData}
          todayStr={todayStr}
          activeKPI={activeKPI}
        />
      ) : (
        <PerformanceTab achievements={achievements} />
      )}
    </div>
  )
}

/* ================================================================== */
/*  TRACKING TAB                                                      */
/* ================================================================== */

function TrackingTab({
  summary,
  dailyData,
  todayStr,
  activeKPI,
}: {
  summary: any
  dailyData: { day: number; date: string; dayLabel: string; value: number; cumulative: number }[]
  todayStr: string
  activeKPI: KPIRecord | null
}) {
  const unitLabel = activeKPI
    ? activeKPI.mode === 'point'
      ? 'pts'
      : activeKPI.volumeValueMode === 'currency'
        ? activeKPI.currencyType ?? '$'
        : 'units'
    : 'pts'

  return (
    <div className="space-y-6">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summary.mode === 'point' ? (
          <>
            <SummaryCard label="Total Points" value={fmtNum(summary.total)} accent="blue" icon={<TrendingUp className="w-5 h-5" />} />
            <SummaryCard label="MIN" value={fmtNum(summary.min)} accent="orange" />
            <SummaryCard label="Gate" value={fmtNum(summary.gate)} accent="yellow" />
            <SummaryCard label="OTB" value={fmtNum(summary.otb)} accent="blue" />
            <SummaryCard label="OAB" value={fmtNum(summary.oab)} accent="green" />
            <SummaryCard
              label="Daily Required"
              value={summary.dailyNeeded != null ? fmtNum(summary.dailyNeeded, 1) + ' ' + unitLabel : 'Target Met ✓'}
              accent={summary.dailyNeeded != null ? 'red' : 'green'}
              icon={<Award className="w-5 h-5" />}
            />
          </>
        ) : (
          <>
            <SummaryCard label="Actual" value={fmtNum(summary.total)} accent="blue" icon={<TrendingUp className="w-5 h-5" />} />
            <SummaryCard label="Target" value={fmtNum(summary.target ?? 0)} accent="purple" icon={<Target className="w-5 h-5" />} />
            <SummaryCard
              label="Daily Required"
              value={summary.dailyNeeded != null ? fmtNum(summary.dailyNeeded, 1) + ' ' + unitLabel : 'Target Met ✓'}
              accent={summary.dailyNeeded != null ? 'red' : 'green'}
              icon={<Award className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* ── Daily tracking table ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Daily Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 font-medium text-gray-500">Day</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Daily ({unitLabel})</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map((row) => {
                const isToday = row.date === todayStr
                return (
                  <tr
                    key={row.date}
                    className={`border-t border-gray-50 ${isToday ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5">
                      {row.date}
                      {isToday && (
                        <span className="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">TODAY</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{row.dayLabel}</td>
                    <td className={`px-4 py-2.5 text-right ${row.value > 0 ? 'text-green-600 font-medium' : 'text-gray-300'}`}>
                      {fmtNum(row.value)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtNum(row.cumulative)}</td>
                  </tr>
                )
              })}
              {dailyData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No data for this month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  PERFORMANCE TAB                                                   */
/* ================================================================== */

function PerformanceTab({
  achievements,
}: {
  achievements: {
    kpi: KPIRecord
    actual: number
    target: number
    achievementPct: number
    tier: 'oab' | 'otb' | 'gate' | 'min' | 'below'
  }[]
}) {
  if (achievements.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
        <Target className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No KPIs assigned for this period</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {achievements.map(({ kpi, actual, target, achievementPct, tier }) => (
        <div key={kpi.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* KPI header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="font-semibold text-gray-900">{kpi.name}</h3>
                <span className="text-xs text-gray-500 capitalize">
                  {kpi.mode} · {kpi.assigneeType} · {kpi.month}
                </span>
              </div>
            </div>
            {/* Tier badge (for point-based) */}
            {kpi.mode === 'point' && (
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-bold ${TIER_COLORS[tier].bg} ${TIER_COLORS[tier].text}`}
              >
                {TIER_COLORS[tier].label}
              </span>
            )}
          </div>

          <div className="p-4 flex flex-col lg:flex-row gap-6">
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center min-w-[160px]">
              <HalfGauge pct={achievementPct} size={140} />
              <p className="text-xs text-gray-500 mt-1">Achievement</p>
            </div>

            {/* Detail table */}
            <div className="flex-1 overflow-x-auto">
              {kpi.mode === 'point' ? (
                <PointKPITable kpi={kpi} actual={actual} achievementPct={achievementPct} tier={tier} />
              ) : (
                <VolumeKPITable kpi={kpi} actual={actual} target={target} achievementPct={achievementPct} tier={tier} />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Point KPI tier table ── */

function PointKPITable({
  kpi,
  actual,
  achievementPct,
  tier,
}: {
  kpi: KPIRecord
  actual: number
  achievementPct: number
  tier: string
}) {
  const tiers = [
    { key: 'min', label: 'MIN', target: kpi.pointMin ?? 0 },
    { key: 'gate', label: 'Gate', target: kpi.pointGate ?? 0 },
    { key: 'otb', label: 'OTB', target: kpi.pointOtb ?? 0 },
    { key: 'oab', label: 'OAB', target: kpi.pointOab ?? 0 },
  ]

  const tierOrder = ['below', 'min', 'gate', 'otb', 'oab']
  const currentTierIdx = tierOrder.indexOf(tier)

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 text-left">
          <th className="px-4 py-2.5 font-medium text-gray-500">Tier</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Target</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Current</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Achievement %</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Needed</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-center">Status</th>
        </tr>
      </thead>
      <tbody>
        {tiers.map((t) => {
          const pct = t.target > 0 ? (actual / t.target) * 100 : 0
          const needed = Math.max(0, t.target - actual)
          const achieved = currentTierIdx >= tierOrder.indexOf(t.key)

          return (
            <tr key={t.key} className={`border-t border-gray-50 ${achieved ? achBg(100) : ''}`}>
              <td className="px-4 py-2.5 font-medium">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${TIER_COLORS[t.key].bg.replace('bg-', 'bg-')}`} />
                {t.label}
              </td>
              <td className="px-4 py-2.5 text-right">{fmtNum(t.target)}</td>
              <td className="px-4 py-2.5 text-right font-medium">{fmtNum(actual)}</td>
              <td className={`px-4 py-2.5 text-right font-medium ${achColor(pct)}`}>
                {fmtNum(pct, 1)}%
              </td>
              <td className="px-4 py-2.5 text-right">{needed > 0 ? fmtNum(needed) : '—'}</td>
              <td className="px-4 py-2.5 text-center">
                {achieved ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Achieved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Pending
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── Volume KPI table ── */

function VolumeKPITable({
  kpi,
  actual,
  target,
  achievementPct,
  tier,
}: {
  kpi: KPIRecord
  actual: number
  target: number
  achievementPct: number
  tier: string
}) {
  const remaining = Math.max(0, target - actual)
  const label =
    kpi.volumeValueMode === 'currency' ? (kpi.currencyType ?? 'USD') : 'Units'

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 text-left">
          <th className="px-4 py-2.5 font-medium text-gray-500">Metric</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Target ({label})</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Actual</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Achievement %</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-right">Remaining</th>
          <th className="px-4 py-2.5 font-medium text-gray-500 text-center">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-gray-50">
          <td className="px-4 py-2.5 font-medium">{kpi.name}</td>
          <td className="px-4 py-2.5 text-right">{fmtNum(target)}</td>
          <td className="px-4 py-2.5 text-right font-medium">{fmtNum(actual)}</td>
          <td className={`px-4 py-2.5 text-right font-medium ${achColor(achievementPct)}`}>
            {fmtNum(achievementPct, 1)}%
          </td>
          <td className="px-4 py-2.5 text-right">{remaining > 0 ? fmtNum(remaining) : '—'}</td>
          <td className="px-4 py-2.5 text-center">
            {achievementPct >= 100 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Achieved
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[tier].bg} ${TIER_COLORS[tier].text}`}>
                {TIER_COLORS[tier].label}
              </span>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/* ── Summary Card component ── */

const ACCENT: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
}

function SummaryCard({
  label,
  value,
  accent = 'blue',
  icon,
}: {
  label: string
  value: string
  accent?: string
  icon?: React.ReactNode
}) {
  const colors = ACCENT[accent] ?? ACCENT.blue
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        {icon && <span className={`p-1.5 rounded-lg ${colors}`}>{icon}</span>}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
