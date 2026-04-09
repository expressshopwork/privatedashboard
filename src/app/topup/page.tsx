'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import Modal from '@/components/Modal'
import { format, addMonths, differenceInDays } from 'date-fns'

interface TopUp {
  id: number
  customerName: string
  customerPhone: string
  product: string
  lastTopUpDate: string
  paymentPeriod: number
  expireDate: string
}

interface Customer {
  id: number
  name: string
  phone: string
}

const todayStr = () => new Date().toISOString().split('T')[0]

const emptyForm = {
  customerId: '',
  customerPhone: '',
  customerName: '',
  product: '',
  lastTopUpDate: todayStr(),
  paymentPeriod: '1',
}

function getStatus(expireDate: string) {
  const exp = new Date(expireDate)
  const days = differenceInDays(exp, new Date())
  if (days < 0) return { label: 'Expired', className: 'bg-red-100 text-red-700' }
  if (days <= 30) return { label: `Expiring (${days}d)`, className: 'bg-amber-100 text-amber-700' }
  return { label: 'Active', className: 'bg-green-100 text-green-700' }
}

export default function TopUpPage() {
  const [topups, setTopups] = useState<TopUp[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const computedExpire = () => {
    try {
      return addMonths(new Date(form.lastTopUpDate), parseInt(form.paymentPeriod) || 0)
    } catch {
      return null
    }
  }

  const fetchTopups = async () => {
    setLoading(true)
    const res = await fetch('/api/topup')
    setTopups(await res.json())
    setLoading(false)
  }

  const fetchCustomers = async () => {
    const res = await fetch('/api/customers')
    setCustomers(await res.json())
  }

  useEffect(() => {
    fetchTopups()
    fetchCustomers()
  }, [])

  const handleCustomerSelect = (id: string) => {
    const c = customers.find((c) => String(c.id) === id)
    if (c) {
      setForm({ ...form, customerId: id, customerName: c.name, customerPhone: c.phone })
    } else {
      setForm({ ...form, customerId: '', customerName: '', customerPhone: '' })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setModalOpen(false)
    setForm(emptyForm)
    fetchTopups()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this top-up?')) return
    await fetch(`/api/topup/${id}`, { method: 'DELETE' })
    fetchTopups()
  }

  const expirePreview = computedExpire()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top Up</h1>
          <p className="text-gray-500 text-sm mt-1">{topups.length} subscriptions</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setModalOpen(true) }}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus size={18} />
          Add Top Up
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
          </div>
        ) : topups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Zap size={40} className="mb-2 opacity-30" />
            <p>No top-ups yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">Last Top Up</th>
                <th className="px-6 py-3 font-medium">Period</th>
                <th className="px-6 py-3 font-medium">Expire Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topups.map((t) => {
                const status = getStatus(t.expireDate)
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{t.customerName}</td>
                    <td className="px-6 py-4 text-gray-600">{t.customerPhone}</td>
                    <td className="px-6 py-4 text-gray-700">{t.product}</td>
                    <td className="px-6 py-4 text-gray-500">{format(new Date(t.lastTopUpDate), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4 text-gray-500">{t.paymentPeriod} mo</td>
                    <td className="px-6 py-4 font-medium">{format(new Date(t.expireDate), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Top Up">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer (optional)</label>
            <select
              value={form.customerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Select customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="text"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="+1 555 0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
              <input
                type="text"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Full name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Premium Plan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Top Up Date *</label>
            <input
              type="date"
              value={form.lastTopUpDate}
              onChange={(e) => setForm({ ...form, lastTopUpDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Period (months) *</label>
            <input
              type="number"
              value={form.paymentPeriod}
              onChange={(e) => setForm({ ...form, paymentPeriod: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. 1, 3, 6, 12"
              min="1"
            />
          </div>
          {expirePreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
              <span className="font-medium text-blue-800">Expire Date: </span>
              <span className="text-blue-700">{format(expirePreview, 'MMMM d, yyyy')}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.customerPhone || !form.customerName || !form.product}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Top Up'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
