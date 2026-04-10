'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ShoppingBag, DollarSign, Zap, TrendingUp, Star } from 'lucide-react'
import { format } from 'date-fns'
import {
  getDashboardData,
  type DashboardData,
  UNIT_GROUP_ITEMS,
  DOLLAR_GROUP_ITEMS,
  POINT_BASED_ITEMS,
  getPointCategories,
} from '@/lib/store'

type ViewMode = 'unit' | 'point'

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('unit')

  useEffect(() => {
    try {
      setData(getDashboardData())
    } catch {
      // leave data null
    }
    setLoading(false)
  }, [])

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

  const weeklyChartData = data.weeklyData.map((d) => ({
    ...d,
    date: formatDate(d.date),
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

  const pointCategories = getPointCategories()
  const unitSummary = data.unitSummaryToday
  const pointSummary = data.pointSummaryToday

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

      {/* Today's Breakdown */}
      {viewMode === 'unit' ? (
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
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            Point Summary — Today
          </h2>
          <div className="space-y-4">
            {pointCategories.map((cat) => {
              const items = POINT_BASED_ITEMS.filter((i) => i.category === cat)
              return (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">{cat}</h3>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const entry = pointSummary.items[item.name] ?? { quantity: 0, points: 0 }
                      const multiplierLabel =
                        item.bonusPoints
                          ? `×${item.pointMultiplier ?? 0} +${item.bonusPoints} pts`
                          : `×${item.pointMultiplier ?? 0} pts`
                      return (
                        <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <span className="text-sm text-gray-700">{item.name}</span>
                            <span className="text-xs text-gray-400 ml-2">({multiplierLabel})</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">{entry.quantity} qty</span>
                            <span className="text-sm font-bold text-purple-700 w-16 text-right">{entry.points} pts</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200 mt-2">
              <span className="text-sm font-semibold text-purple-800">Total Points</span>
              <span className="text-sm font-bold text-purple-800">{pointSummary.totalPoints} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Chart + Expiring Top-ups */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-slate-600" />
            <h2 className="text-lg font-semibold text-gray-900">Weekly Sales</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="units" fill="#3b82f6" name="Units" radius={[4, 4, 0, 0]} />
              <Bar dataKey="points" fill="#8b5cf6" name="Points" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Expiring Soon</h2>
          </div>
          {data.expiringTopups.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No expiring top-ups</p>
          ) : (
            <div className="space-y-3">
              {data.expiringTopups.map((t) => {
                const status = getTopupStatus(t.expireDate)
                return (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.customerName}</p>
                      <p className="text-xs text-gray-500">{t.product}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
    </div>
  )
}
