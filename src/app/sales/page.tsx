'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, ShoppingCart, Filter } from 'lucide-react'
import Modal from '@/components/Modal'
import { format } from 'date-fns'

interface Sale {
  id: number
  type: string
  quantity: number | null
  unitPrice: number | null
  totalAmount: number
  pointsEarned: number | null
  date: string
  notes: string | null
  customer: { name: string } | null
}

interface Customer {
  id: number
  name: string
  phone: string
}

const todayStr = () => new Date().toISOString().split('T')[0]

const emptyForm = {
  customerId: '',
  type: 'unit',
  quantity: '',
  unitPrice: '',
  totalAmount: '',
  pointsEarned: '',
  amountSpent: '',
  date: todayStr(),
  notes: '',
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const fetchSales = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType) params.set('type', filterType)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    const res = await fetch(`/api/sales?${params}`)
    const data = await res.json()
    setSales(data)
    setLoading(false)
  }

  const fetchCustomers = async () => {
    const res = await fetch('/api/customers')
    setCustomers(await res.json())
  }

  useEffect(() => {
    fetchSales()
    fetchCustomers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterFrom, filterTo])

  const handleTypeChange = (type: string) => {
    setForm({ ...form, type, quantity: '', unitPrice: '', totalAmount: '', pointsEarned: '', amountSpent: '' })
  }

  const handleUnitCalc = (field: string, value: string) => {
    const updated = { ...form, [field]: value }
    const qty = parseFloat(field === 'quantity' ? value : form.quantity)
    const price = parseFloat(field === 'unitPrice' ? value : form.unitPrice)
    if (!isNaN(qty) && !isNaN(price)) {
      updated.totalAmount = (qty * price).toFixed(2)
    }
    setForm(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      customerId: form.customerId || null,
      type: form.type,
      quantity: form.type === 'unit' ? form.quantity : null,
      unitPrice: form.type === 'unit' ? form.unitPrice : null,
      totalAmount: form.type === 'unit' ? form.totalAmount : form.amountSpent,
      pointsEarned: form.type === 'point' ? form.pointsEarned : null,
      date: form.date,
      notes: form.notes,
    }
    await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setModalOpen(false)
    setForm(emptyForm)
    fetchSales()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this sale?')) return
    await fetch(`/api/sales/${id}`, { method: 'DELETE' })
    fetchSales()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Sales</h1>
          <p className="text-gray-500 text-sm mt-1">{sales.length} records</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setModalOpen(true) }}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus size={18} />
          Add Sale
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
        <Filter size={16} className="text-gray-400" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">All Types</option>
          <option value="unit">Unit Based</option>
          <option value="point">Point Based</option>
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>From</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>To</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        {(filterType || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterType(''); setFilterFrom(''); setFilterTo('') }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ShoppingCart size={40} className="mb-2 opacity-30" />
            <p>No sales found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Details</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Notes</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{s.customer?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      s.type === 'unit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {s.type === 'unit' ? 'Unit' : 'Point'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {s.type === 'unit'
                      ? `${s.quantity ?? 0} × $${s.unitPrice?.toFixed(2) ?? '0'}`
                      : `${s.pointsEarned ?? 0} pts`}
                  </td>
                  <td className="px-6 py-4 font-medium">${s.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-500">{format(new Date(s.date), 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{s.notes ?? '—'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Sale">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Walk-in customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
            <div className="flex gap-3">
              {['unit', 'point'].map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.type === t ? 'bg-slate-800 text-white border-slate-800' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t === 'unit' ? 'Unit Based' : 'Point Based'}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'unit' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => handleUnitCalc('quantity', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                  <input
                    type="number"
                    value={form.unitPrice}
                    onChange={(e) => handleUnitCalc('unitPrice', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                <input
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Auto-calculated"
                  step="0.01"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points Earned</label>
                <input
                  type="number"
                  value={form.pointsEarned}
                  onChange={(e) => setForm({ ...form, pointsEarned: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Spent</label>
                <input
                  type="number"
                  value={form.amountSpent}
                  onChange={(e) => setForm({ ...form, amountSpent: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Sale'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
