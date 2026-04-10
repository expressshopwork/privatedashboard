'use client'

import { useEffect, useState } from 'react'
import { Save, Settings, Calendar } from 'lucide-react'
import {
  getSettings,
  saveSettings,
  type KPISettings,
  type SIPPositionConfig,
  type NewSIPPositionConfig,
} from '@/lib/store'

export default function SettingsPage() {
  const [settings, setSettings] = useState<KPISettings | null>(null)
  const [form, setForm] = useState({
    dailyUnitTarget: '',
    dailyPointTarget: '',
    monthlyRevenueTarget: '',
    customerGrowthTarget: '',
  })
  const [currentScheme, setCurrentScheme] = useState<SIPPositionConfig[]>([])
  const [newScheme, setNewScheme] = useState<NewSIPPositionConfig[]>([])
  const [effectiveDate, setEffectiveDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const data = getSettings()
    setSettings(data)
    setForm({
      dailyUnitTarget: String(data.dailyUnitTarget),
      dailyPointTarget: String(data.dailyPointTarget),
      monthlyRevenueTarget: String(data.monthlyRevenueTarget),
      customerGrowthTarget: String(data.customerGrowthTarget),
    })
    setCurrentScheme(data.currentScheme.map((r) => ({ ...r })))
    setNewScheme(data.newScheme.map((r) => ({ ...r })))
    setEffectiveDate(data.newSchemeEffectiveDate)
  }, [])

  const handleSave = () => {
    setSaving(true)
    const updated = saveSettings({
      dailyUnitTarget: parseFloat(form.dailyUnitTarget) || 0,
      dailyPointTarget: parseFloat(form.dailyPointTarget) || 0,
      monthlyRevenueTarget: parseFloat(form.monthlyRevenueTarget) || 0,
      customerGrowthTarget: parseFloat(form.customerGrowthTarget) || 0,
      currentScheme,
      newScheme,
      newSchemeEffectiveDate: effectiveDate,
    })
    setSettings(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const updateCurrentRow = (idx: number, field: keyof SIPPositionConfig, value: string | number) => {
    setCurrentScheme((prev) => {
      const next = prev.map((r) => ({ ...r }))
      ;(next[idx] as Record<string, string | number>)[field] = value
      return next
    })
  }

  const updateNewRow = (idx: number, field: keyof NewSIPPositionConfig, value: string | number) => {
    setNewScheme((prev) => {
      const next = prev.map((r) => ({ ...r }))
      ;(next[idx] as Record<string, string | number>)[field] = value
      return next
    })
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    )
  }

  const targetFields = [
    { key: 'dailyUnitTarget' as const, label: 'Daily Sales Target (Units)', description: 'Target number of unit-based transactions per day', suffix: 'units' },
    { key: 'dailyPointTarget' as const, label: 'Daily Sales Target (Points)', description: 'Target points to be earned per day', suffix: 'points' },
    { key: 'monthlyRevenueTarget' as const, label: 'Monthly Revenue Target', description: 'Target total revenue for the month', suffix: '$' },
    { key: 'customerGrowthTarget' as const, label: 'Customer Growth Target', description: 'Target number of new customers per month', suffix: 'customers' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">KPI Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure performance targets and SIP schemes for your shop</p>
      </div>

      {/* Target Configuration */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Settings size={20} className="text-slate-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Target Configuration</h2>
            <p className="text-sm text-gray-500">Set your daily and monthly performance goals</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {targetFields.map(({ key, label, description, suffix }) => (
            <div key={key} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{label}</label>
              <p className="text-xs text-gray-400">{description}</p>
              <div className="relative mt-2">
                <input
                  type="number"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="0"
                  min="0"
                  step={suffix === '$' ? '0.01' : '1'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  {suffix}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Scheme – Unit Based */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Settings size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Current Scheme – Unit Based</h2>
            <p className="text-sm text-gray-500">SIP position settings for the unit-based incentive scheme</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Grouping</th>
                <th className="px-3 py-2 font-medium">Payout Method</th>
                <th className="px-3 py-2 font-medium text-right">Gate ($)</th>
                <th className="px-3 py-2 font-medium text-right">OTB ($)</th>
                <th className="px-3 py-2 font-medium text-right">OAB ($)</th>
                <th className="px-3 py-2 font-medium text-right">Annual Bonus (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentScheme.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{row.position}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.department}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.grouping}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.payoutMethod}</td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.gate} onChange={(e) => updateCurrentRow(idx, 'gate', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.otb} onChange={(e) => updateCurrentRow(idx, 'otb', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.oab} onChange={(e) => updateCurrentRow(idx, 'oab', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" max="100" step="1" value={row.annualBonus} onChange={(e) => updateCurrentRow(idx, 'annualBonus', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Scheme – Point Based */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 bg-green-100 rounded-lg">
            <Settings size={20} className="text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">New Scheme – Point Based</h2>
            <p className="text-sm text-gray-500">SIP position settings for the point-based incentive scheme</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-gray-400" />
            <label className="text-gray-600 font-medium">Effective Date:</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Grouping</th>
                <th className="px-3 py-2 font-medium">Payout Method</th>
                <th className="px-3 py-2 font-medium text-right">Gate ($)</th>
                <th className="px-3 py-2 font-medium text-right">OTB ($)</th>
                <th className="px-3 py-2 font-medium text-right">OAB ($)</th>
                <th className="px-3 py-2 font-medium text-right">Annual Bonus (%)</th>
                <th className="px-3 py-2 font-medium text-right">PA Allowance ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {newScheme.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{row.position}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.department}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.grouping}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.payoutMethod}</td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.gate} onChange={(e) => updateNewRow(idx, 'gate', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.otb} onChange={(e) => updateNewRow(idx, 'otb', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.oab} onChange={(e) => updateNewRow(idx, 'oab', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" max="100" step="1" value={row.annualBonus} onChange={(e) => updateNewRow(idx, 'annualBonus', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" value={row.paAllowance} onChange={(e) => updateNewRow(idx, 'paAllowance', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          {saved && (
            <span className="text-green-600 text-sm font-medium flex items-center gap-1">
              ✓ Settings saved successfully
            </span>
          )}
          {!saved && <span />}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
