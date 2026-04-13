'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Settings,
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Target,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react'
import Modal from '@/components/Modal'
import {
  getKPIs,
  addKPI,
  updateKPI,
  deleteKPI,
  getServicePointRules,
  saveServicePointRules,
  addServicePointRule,
  deleteServicePointRule,
  getUsers,
  UNIT_GROUP_ITEMS,
  DOLLAR_GROUP_ITEMS,
  type KPIRecord,
  type KPIMode,
  type KPIAssigneeType,
  type KPIPeriod,
  type VolumeValueMode,
  type CurrencyType,
  type ServicePointRule,
  type AppUser,
} from '@/lib/store'
import { syncToGoogleSheets, getLastSyncTime, type SyncResult } from '@/lib/syncGoogleSheets'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

const PRODUCT_OPTIONS = [
  ...UNIT_GROUP_ITEMS.map((i) => i.name),
  ...DOLLAR_GROUP_ITEMS.map((i) => i.name),
]

interface KPIFormData {
  name: string
  mode: KPIMode
  assigneeType: KPIAssigneeType
  assigneeId: number
  period: KPIPeriod
  volumeValueMode: VolumeValueMode
  currencyType: CurrencyType
  volumeProductFilter: string | null
  volumeTarget: number
  pointMin: number
  pointGate: number
  pointOtb: number
  pointOab: number
}

const defaultForm: KPIFormData = {
  name: '',
  mode: 'volume',
  assigneeType: 'agent',
  assigneeId: 0,
  period: 'monthly',
  volumeValueMode: 'unit',
  currencyType: 'USD',
  volumeProductFilter: null,
  volumeTarget: 0,
  pointMin: 0,
  pointGate: 0,
  pointOtb: 0,
  pointOab: 0,
}

export default function SettingsPage() {
  const [month, setMonth] = useState(currentMonth)
  const [kpis, setKpis] = useState<KPIRecord[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [rules, setRules] = useState<ServicePointRule[]>([])

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<KPIFormData>({ ...defaultForm })

  // Rule inline add
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleRate, setNewRuleRate] = useState('1')
  const [newRuleAddOn, setNewRuleAddOn] = useState('0')

  const refresh = useCallback(() => {
    setKpis(getKPIs({ month }))
    setUsers(getUsers())
    setRules(getServicePointRules())
  }, [month])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    setLastSync(getLastSyncTime())
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    const result = await syncToGoogleSheets()
    setSyncing(false)
    setSyncResult(result)
    if (result.success) {
      setLastSync(getLastSyncTime())
    }
    setTimeout(() => setSyncResult(null), 5000)
  }

  // Helpers
  const getUserName = (id: number) => users.find((u) => u.id === id)?.fullName ?? `User #${id}`

  const assigneeCandidates = form.assigneeType === 'shop'
    ? users.filter((u) => u.role === 'sup' && u.status === 'active')
    : users.filter((u) => u.role === 'agent' && u.status === 'active')

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setModalOpen(true)
  }

  const openEdit = (kpi: KPIRecord) => {
    setEditingId(kpi.id)
    setForm({
      name: kpi.name,
      mode: kpi.mode,
      assigneeType: kpi.assigneeType,
      assigneeId: kpi.assigneeId,
      period: kpi.period,
      volumeValueMode: kpi.volumeValueMode ?? 'unit',
      currencyType: kpi.currencyType ?? 'USD',
      volumeProductFilter: kpi.volumeProductFilter ?? null,
      volumeTarget: kpi.volumeTarget ?? 0,
      pointMin: kpi.pointMin ?? 0,
      pointGate: kpi.pointGate ?? 0,
      pointOtb: kpi.pointOtb ?? 0,
      pointOab: kpi.pointOab ?? 0,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: number) => {
    deleteKPI(id)
    refresh()
  }

  const handleSave = () => {
    const payload = {
      name: form.name,
      mode: form.mode,
      assigneeType: form.assigneeType,
      assigneeId: form.assigneeId,
      month,
      period: form.period,
      ...(form.mode === 'volume'
        ? {
            volumeValueMode: form.volumeValueMode,
            currencyType: form.volumeValueMode === 'currency' ? form.currencyType : undefined,
            volumeProductFilter: form.volumeProductFilter,
            volumeTarget: form.volumeTarget,
          }
        : {
            pointMin: form.pointMin,
            pointGate: form.pointGate,
            pointOtb: form.pointOtb,
            pointOab: form.pointOab,
          }),
    } as Omit<KPIRecord, 'id' | 'createdAt'>
    if (editingId !== null) {
      updateKPI(editingId, payload)
    } else {
      addKPI(payload)
    }
    setModalOpen(false)
    refresh()
  }

  const targetSummary = (kpi: KPIRecord) => {
    if (kpi.mode === 'volume') {
      const label = kpi.volumeValueMode === 'currency' ? (kpi.currencyType ?? 'USD') : 'units'
      return `${kpi.volumeTarget ?? 0} ${label}`
    }
    return `${kpi.pointMin ?? 0}/${kpi.pointGate ?? 0}/${kpi.pointOtb ?? 0}/${kpi.pointOab ?? 0}`
  }

  // Rule handlers
  const handleAddRule = () => {
    if (!newRuleName.trim()) return
    addServicePointRule({
      serviceName: newRuleName.trim(),
      rate: parseFloat(newRuleRate) || 0,
      addOn: parseFloat(newRuleAddOn) || 0,
    })
    setNewRuleName('')
    setNewRuleRate('1')
    setNewRuleAddOn('0')
    refresh()
  }

  const handleDeleteRule = (id: number) => {
    deleteServicePointRule(id)
    refresh()
  }

  const handleRuleFieldChange = (id: number, field: 'rate' | 'addOn', value: string) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, [field]: parseFloat(value) || 0 } : r
    )
    setRules(updated)
  }

  const handleSaveRules = () => {
    saveServicePointRules(rules)
    refresh()
  }

  const set = <K extends keyof KPIFormData>(key: K, val: KPIFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={24} /> KPI Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage KPI targets for agents and shops</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="p-2 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="p-2 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Google Sheets Sync */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 pb-4 border-b mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileSpreadsheet size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Google Sheets Sync</h2>
            <p className="text-sm text-gray-500">
              {lastSync
                ? `Last synced: ${new Date(lastSync).toLocaleString()}`
                : 'Not synced yet'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors text-sm"
          >
            {syncing ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            {syncing ? 'Syncing...' : 'Sync to Google Sheets'}
          </button>
          {syncResult && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                syncResult.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {syncResult.success && syncResult.counts
                ? `✓ Synced: ${syncResult.counts.customers} customers, ${syncResult.counts.sales} sales, ${syncResult.counts.topups} top-ups, ${syncResult.counts.kpis} KPIs`
                : `✗ Error: ${syncResult.error ?? 'Unknown error'}`}
            </div>
          )}
        </div>
      </div>

      {/* KPI List */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Target size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">KPIs for {formatMonth(month)}</h2>
              <p className="text-sm text-gray-500">{kpis.length} target{kpis.length !== 1 ? 's' : ''} configured</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            <Plus size={16} /> Add KPI
          </button>
        </div>

        {kpis.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Target size={40} className="mx-auto mb-3 opacity-40" />
            <p>No KPIs configured for {formatMonth(month)}.</p>
            <p className="text-sm mt-1">Click &quot;Add KPI&quot; to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">Assignee Type</th>
                  <th className="px-3 py-2 font-medium">Assigned To</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Target Summary</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {kpis.map((kpi, idx) => (
                  <tr key={kpi.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{kpi.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${kpi.mode === 'volume' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {kpi.mode === 'volume' ? 'Volume' : 'Point'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${kpi.assigneeType === 'shop' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {kpi.assigneeType === 'shop' ? 'Shop' : 'Agent'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{getUserName(kpi.assigneeId)}</td>
                    <td className="px-3 py-2 text-gray-700 capitalize">{kpi.period}</td>
                    <td className="px-3 py-2 text-gray-700 font-mono text-xs">
                      {kpi.mode === 'point' && <span className="text-gray-400 mr-1">MIN/Gate/OTB/OAB: </span>}
                      {targetSummary(kpi)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => openEdit(kpi)} className="text-gray-400 hover:text-indigo-600 p-1 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(kpi.id)} className="text-gray-400 hover:text-red-600 p-1 ml-1 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Service Point Rules */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Settings size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Service Point Rules</h2>
              <p className="text-sm text-gray-500">Configure point rates for service types used in point-based KPIs</p>
            </div>
          </div>
          <button
            onClick={handleSaveRules}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            Save Rules
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2 font-medium">Service Name</th>
                <th className="px-3 py-2 font-medium text-right">Rate (multiplier)</th>
                <th className="px-3 py-2 font-medium text-right">Add-on (flat bonus)</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900">{rule.serviceName}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={rule.rate}
                      onChange={(e) => handleRuleFieldChange(rule.id, 'rate', e.target.value)}
                      className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={rule.addOn}
                      onChange={(e) => handleRuleFieldChange(rule.id, 'addOn', e.target.value)}
                      className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDeleteRule(rule.id)} className="text-gray-400 hover:text-red-600 p-1 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Add row */}
              <tr className="bg-gray-50/50">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="Service name"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newRuleRate}
                    onChange={(e) => setNewRuleRate(e.target.value)}
                    className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newRuleAddOn}
                    onChange={(e) => setNewRuleAddOn(e.target.value)}
                    className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={handleAddRule} className="text-green-600 hover:text-green-800 p-1 transition-colors" title="Add Rule">
                    <Plus size={16} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit KPI Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId !== null ? 'Edit KPI' : 'Add KPI'}>
        <div className="space-y-6">
          {/* Step 1 — Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Step 1 — Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => set('mode', 'volume')}
                className={`p-4 border-2 rounded-xl text-left transition-colors ${form.mode === 'volume' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <p className="font-semibold text-gray-900">Volume-based</p>
                <p className="text-xs text-gray-500 mt-1">Track quantity or revenue against a single target</p>
              </button>
              <button
                type="button"
                onClick={() => set('mode', 'point')}
                className={`p-4 border-2 rounded-xl text-left transition-colors ${form.mode === 'point' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <p className="font-semibold text-gray-900">Point-based</p>
                <p className="text-xs text-gray-500 mt-1">Multi-tier point targets (MIN / Gate / OTB / OAB)</p>
              </button>
            </div>
          </div>

          {/* Step 2 — Assignee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Step 2 — Assignee</label>
            <div className="flex gap-2 mb-3">
              {(['shop', 'agent'] as KPIAssigneeType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { set('assigneeType', t); set('assigneeId', 0) }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.assigneeType === t ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t === 'shop' ? 'Shop' : 'Agent'}
                </button>
              ))}
            </div>
            <select
              value={form.assigneeId}
              onChange={(e) => set('assigneeId', parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value={0}>Select {form.assigneeType === 'shop' ? 'supervisor' : 'agent'}...</option>
              {assigneeCandidates.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
              ))}
            </select>
          </div>

          {/* Step 3 — Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Step 3 — Target</label>
            {form.mode === 'volume' ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(['unit', 'currency'] as VolumeValueMode[]).map((vm) => (
                    <button
                      key={vm}
                      type="button"
                      onClick={() => set('volumeValueMode', vm)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.volumeValueMode === vm ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {vm === 'unit' ? 'Unit' : 'Currency'}
                    </button>
                  ))}
                </div>
                {form.volumeValueMode === 'currency' && (
                  <select
                    value={form.currencyType}
                    onChange={(e) => set('currencyType', e.target.value as CurrencyType)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="USD">USD</option>
                    <option value="KHR">KHR</option>
                  </select>
                )}
                <select
                  value={form.volumeProductFilter ?? ''}
                  onChange={(e) => set('volumeProductFilter', e.target.value || null)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">All products</option>
                  {PRODUCT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target</label>
                  <input
                    type="number"
                    min="0"
                    value={form.volumeTarget}
                    onChange={(e) => set('volumeTarget', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['pointMin', 'MIN — Minimum threshold'],
                  ['pointGate', 'Gate — Main benchmark'],
                  ['pointOtb', 'OTB — On-target bonus'],
                  ['pointOab', 'OAB — Over-achievement bonus'],
                ] as [keyof KPIFormData, string][]).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      min="0"
                      value={form[key] as number}
                      onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 4 — Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Step 4 — Period</label>
            <select
              value={form.period}
              onChange={(e) => set('period', e.target.value as KPIPeriod)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>

          {/* KPI Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">KPI Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Agent Monthly Volume Target"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Month (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <input
              type="month"
              value={month}
              readOnly
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim() || form.assigneeId === 0}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {editingId !== null ? 'Update KPI' : 'Create KPI'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
