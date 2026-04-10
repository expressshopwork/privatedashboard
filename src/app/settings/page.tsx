'use client'

import { useEffect, useState } from 'react'
import { Save, Settings, Calendar, Plus, Trash2 } from 'lucide-react'
import {
  getSettings,
  saveSettings,
  getBranches,
  type KPISettings,
  type SIPPositionConfig,
  type NewSIPPositionConfig,
  type KPIItem,
} from '@/lib/store'

export default function SettingsPage() {
  const [settings, setSettings] = useState<KPISettings | null>(null)
  const [currentScheme, setCurrentScheme] = useState<SIPPositionConfig[]>([])
  const [newScheme, setNewScheme] = useState<NewSIPPositionConfig[]>([])
  const [kpiItems, setKpiItems] = useState<KPIItem[]>([])
  const [effectiveDate, setEffectiveDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<'agent' | 'sup' | 'all'>('all')

  useEffect(() => {
    const data = getSettings()
    setSettings(data)
    setCurrentScheme(data.currentScheme.map((r) => ({ ...r })))
    setNewScheme(data.newScheme.map((r) => ({ ...r })))
    setKpiItems(data.kpiItems.map((r) => ({ ...r })))
    setEffectiveDate(data.newSchemeEffectiveDate)
    setBranches(getBranches())
  }, [])

  const handleSave = () => {
    setSaving(true)
    const updated = saveSettings({
      currentScheme,
      newScheme,
      newSchemeEffectiveDate: effectiveDate,
      kpiItems,
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

  const updateKPIItem = (idx: number, field: keyof KPIItem, value: string | number) => {
    setKpiItems((prev) => {
      const next = prev.map((r) => ({ ...r }))
      ;(next[idx] as Record<string, string | number>)[field] = value
      return next
    })
  }

  const addKPIItem = () => {
    const newRole = selectedRole === 'all' ? 'agent' : selectedRole
    const newBranch = selectedBranch === 'all' ? '' : selectedBranch
    setKpiItems((prev) => [...prev, { name: '', weight: 0, gateTarget: 0, otbTarget: 0, oabTarget: 0, role: newRole, branch: newBranch }])
  }

  const removeKPIItem = (idx: number) => {
    setKpiItems((prev) => prev.filter((_, i) => i !== idx))
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    )
  }

  // Filtered KPI items based on selected branch and role
  const filteredKpiIndices: number[] = kpiItems
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (selectedBranch !== 'all' && item.branch !== selectedBranch) return false
      if (selectedRole !== 'all' && item.role !== selectedRole) return false
      return true
    })
    .map(({ idx }) => idx)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">KPI Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure performance targets and SIP schemes for your shop</p>
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

      {/* KPI Items – Unit Based Targets (by Branch & Role) */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Settings size={20} className="text-orange-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">KPI Performance Items</h2>
            <p className="text-sm text-gray-500">Set KPI targets per role and branch (Shop Performance = Agent + Sup)</p>
          </div>
          <button
            onClick={addKPIItem}
            className="flex items-center gap-1 text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus size={14} />
            Add KPI
          </button>
        </div>

        {/* Branch & Role Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Branch:</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Role:</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'agent' | 'sup' | 'all')}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="all">All Roles</option>
              <option value="agent">Agent</option>
              <option value="sup">Supervisor</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2 font-medium">No.</th>
                <th className="px-3 py-2 font-medium">KPI Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium text-right">Weight (%)</th>
                <th className="px-3 py-2 font-medium text-right">Gate Target</th>
                <th className="px-3 py-2 font-medium text-right">OTB Target</th>
                <th className="px-3 py-2 font-medium text-right">OAB Target</th>
                <th className="px-3 py-2 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredKpiIndices.map((idx, displayIdx) => {
                const row = kpiItems[idx]
                return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{displayIdx + 1}</td>
                  <td className="px-3 py-2">
                    <input type="text" value={row.name} onChange={(e) => updateKPIItem(idx, 'name', e.target.value)} className="w-48 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300" placeholder="KPI name" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={row.role} onChange={(e) => updateKPIItem(idx, 'role', e.target.value)} className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
                      <option value="agent">Agent</option>
                      <option value="sup">Supervisor</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={row.branch} onChange={(e) => updateKPIItem(idx, 'branch', e.target.value)} className="w-28 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300" placeholder="Branch" list="branch-list" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" max="100" step="1" value={row.weight} onChange={(e) => updateKPIItem(idx, 'weight', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="1" value={row.gateTarget} onChange={(e) => updateKPIItem(idx, 'gateTarget', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="1" value={row.otbTarget} onChange={(e) => updateKPIItem(idx, 'otbTarget', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="1" value={row.oabTarget} onChange={(e) => updateKPIItem(idx, 'oabTarget', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeKPIItem(idx)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Remove KPI">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
            {filteredKpiIndices.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-medium text-gray-700">
                  <td className="px-3 py-2" colSpan={4}>Total Weight</td>
                  <td className="px-3 py-2 text-right">{filteredKpiIndices.reduce((sum, idx) => sum + kpiItems[idx].weight, 0)}%</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
          <datalist id="branch-list">
            {branches.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <p className="text-xs text-gray-400">* Weights should sum to 100% per role per branch. Staff is only allowed two KPIs to fail out of total KPIs (Mandatory).</p>
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

        {/* Incentive Payment Range */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Incentive Payment Range</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Grouping</th>
                  <th className="px-3 py-2 font-medium">Payout Method</th>
                  <th className="px-3 py-2 font-medium text-right bg-yellow-50">Min ($)</th>
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
                    <td className="px-3 py-2 bg-yellow-50">
                      <input type="number" min="0" step="0.01" value={row.min} onChange={(e) => updateNewRow(idx, 'min', parseFloat(e.target.value) || 0)} className="w-20 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                    </td>
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
          <p className="text-xs text-gray-400 mt-2">* 25% bonus to be added to monthly in separate proposal. Min = 75%–85% (based on Mgt Approval).</p>
        </div>

        {/* Point Targets */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Point Targets</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium text-right bg-yellow-50">Min (pts)</th>
                  <th className="px-3 py-2 font-medium text-right">Gate (pts)</th>
                  <th className="px-3 py-2 font-medium text-right">OTB (pts)</th>
                  <th className="px-3 py-2 font-medium text-right">OAB (pts)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {newScheme.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{row.position}</td>
                    <td className="px-3 py-2 bg-yellow-50">
                      <input type="number" min="0" step="1" value={row.minPoints} onChange={(e) => updateNewRow(idx, 'minPoints', parseFloat(e.target.value) || 0)} className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="1" value={row.gatePoints} onChange={(e) => updateNewRow(idx, 'gatePoints', parseFloat(e.target.value) || 0)} className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="1" value={row.otbPoints} onChange={(e) => updateNewRow(idx, 'otbPoints', parseFloat(e.target.value) || 0)} className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="1" value={row.oabPoints} onChange={(e) => updateNewRow(idx, 'oabPoints', parseFloat(e.target.value) || 0)} className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
