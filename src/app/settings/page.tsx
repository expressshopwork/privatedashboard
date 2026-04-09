'use client'

import { useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'

interface KPISettings {
  id: number
  dailyUnitTarget: number
  dailyPointTarget: number
  monthlyRevenueTarget: number
  customerGrowthTarget: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<KPISettings | null>(null)
  const [form, setForm] = useState({
    dailyUnitTarget: '',
    dailyPointTarget: '',
    monthlyRevenueTarget: '',
    customerGrowthTarget: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setForm({
          dailyUnitTarget: String(data.dailyUnitTarget),
          dailyPointTarget: String(data.dailyPointTarget),
          monthlyRevenueTarget: String(data.monthlyRevenueTarget),
          customerGrowthTarget: String(data.customerGrowthTarget),
        })
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    )
  }

  const fields = [
    { key: 'dailyUnitTarget' as const, label: 'Daily Sales Target (Units)', description: 'Target number of unit-based transactions per day', suffix: 'units' },
    { key: 'dailyPointTarget' as const, label: 'Daily Sales Target (Points)', description: 'Target points to be earned per day', suffix: 'points' },
    { key: 'monthlyRevenueTarget' as const, label: 'Monthly Revenue Target', description: 'Target total revenue for the month', suffix: '$' },
    { key: 'customerGrowthTarget' as const, label: 'Customer Growth Target', description: 'Target number of new customers per month', suffix: 'customers' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">KPI Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure performance targets for your shop</p>
      </div>

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
          {fields.map(({ key, label, description, suffix }) => (
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

        <div className="flex items-center justify-between pt-4 border-t">
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
