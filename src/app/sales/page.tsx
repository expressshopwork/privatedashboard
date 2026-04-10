'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, ShoppingCart, Filter, Pencil, Search } from 'lucide-react'
import Modal from '@/components/Modal'
import { format } from 'date-fns'
import {
  getSales,
  addSale,
  deleteSale,
  updateSale,
  getCurrentUser,
  type Sale,
  UNIT_GROUP_ITEMS,
  DOLLAR_GROUP_ITEMS,
  POINT_BASED_ITEMS,
  getPointCategories,
} from '@/lib/store'

const todayStr = () => new Date().toISOString().split('T')[0]

type SaleMode = 'unit' | 'point'

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterPhone, setFilterPhone] = useState('')
  const currentUser = getCurrentUser()

  // Form state
  const [formMode, setFormMode] = useState<SaleMode>('unit')
  const [formDate, setFormDate] = useState(todayStr())
  const [formNotes, setFormNotes] = useState('')
  const [formPhone, setFormPhone] = useState('')

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [editForm, setEditForm] = useState({
    quantity: '',
    totalAmount: '',
    pointsEarned: '',
    date: '',
    notes: '',
  })

  // Unit-based form: quantities for unit group, amounts for dollar group
  const [unitGroupValues, setUnitGroupValues] = useState<Record<string, string>>({})
  const [dollarGroupValues, setDollarGroupValues] = useState<Record<string, string>>({})

  // Point-based form: quantities for each service
  const [pointValues, setPointValues] = useState<Record<string, string>>({})

  const resetForm = useCallback(() => {
    setFormDate(todayStr())
    setFormNotes('')
    setFormPhone('')
    const ugv: Record<string, string> = {}
    for (const item of UNIT_GROUP_ITEMS) ugv[item.name] = ''
    setUnitGroupValues(ugv)
    const dgv: Record<string, string> = {}
    for (const item of DOLLAR_GROUP_ITEMS) dgv[item.name] = ''
    setDollarGroupValues(dgv)
    const pv: Record<string, string> = {}
    for (const item of POINT_BASED_ITEMS) pv[item.name] = ''
    setPointValues(pv)
  }, [])

  const fetchSales = useCallback(() => {
    setLoading(true)
    setSales(
      getSales({
        type: filterType || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      })
    )
    setLoading(false)
  }, [filterType, filterFrom, filterTo])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  useEffect(() => {
    resetForm()
  }, [resetForm])

  // Computed: total revenue from dollar group
  const dollarGroupTotal = Object.values(dollarGroupValues).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  )

  // Computed: total points
  const computeItemPoints = (itemName: string, qty: number) => {
    const def = POINT_BASED_ITEMS.find((i) => i.name === itemName)
    if (!def) return 0
    let pts = qty * (def.pointMultiplier ?? 0)
    if (qty > 0 && def.bonusPoints) pts += def.bonusPoints
    return pts
  }

  const totalPoints = Object.entries(pointValues).reduce(
    (sum, [name, v]) => sum + computeItemPoints(name, parseInt(v) || 0),
    0
  )

  const handleSave = () => {
    setSaving(true)
    // Build combined notes with agent/phone info
    const noteParts: string[] = []
    if (currentUser?.fullName) noteParts.push(`Agent: ${currentUser.fullName}`)
    if (formPhone.trim()) noteParts.push(`Phone: ${formPhone.trim()}`)
    if (formNotes.trim()) noteParts.push(formNotes.trim())
    const combinedNotes = noteParts.length > 0 ? noteParts.join(' | ') : null

    try {
      if (formMode === 'unit') {
        // Save unit group items
        for (const item of UNIT_GROUP_ITEMS) {
          const qty = parseInt(unitGroupValues[item.name]) || 0
          if (qty > 0) {
            addSale({
              type: 'unit',
              serviceName: item.name,
              category: item.category,
              quantity: qty,
              totalAmount: 0,
              date: formDate,
              notes: combinedNotes,
              createdBy: currentUser?.fullName ?? '',
            })
          }
        }
        // Save dollar group items
        for (const item of DOLLAR_GROUP_ITEMS) {
          const amt = parseFloat(dollarGroupValues[item.name]) || 0
          if (amt > 0) {
            addSale({
              type: 'unit',
              serviceName: item.name,
              category: item.category,
              quantity: 1,
              totalAmount: amt,
              date: formDate,
              notes: combinedNotes,
              createdBy: currentUser?.fullName ?? '',
            })
          }
        }
      } else {
        // Save point-based items
        for (const item of POINT_BASED_ITEMS) {
          const qty = parseInt(pointValues[item.name]) || 0
          if (qty > 0) {
            const pts = computeItemPoints(item.name, qty)
            addSale({
              type: 'point',
              serviceName: item.name,
              category: item.category,
              quantity: qty,
              totalAmount: 0,
              pointsEarned: pts,
              date: formDate,
              notes: combinedNotes,
              createdBy: currentUser?.fullName ?? '',
            })
          }
        }
      }
    } finally {
      setSaving(false)
    }
    setModalOpen(false)
    resetForm()
    fetchSales()
  }

  const handleDelete = (id: number) => {
    if (!confirm('Delete this sale?')) return
    deleteSale(id)
    fetchSales()
  }

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale)
    setEditForm({
      quantity: String(sale.quantity ?? ''),
      totalAmount: String(sale.totalAmount ?? ''),
      pointsEarned: String(sale.pointsEarned ?? ''),
      date: sale.date ? new Date(sale.date).toISOString().split('T')[0] : todayStr(),
      notes: sale.notes ?? '',
    })
    setEditModalOpen(true)
  }

  const handleEditSave = () => {
    if (!editingSale) return
    setSaving(true)
    try {
      updateSale(editingSale.id, {
        quantity: editingSale.type === 'unit' && editingSale.category !== 'Dollar Group'
          ? parseInt(editForm.quantity) || 0
          : editingSale.quantity,
        totalAmount: editingSale.category === 'Dollar Group'
          ? parseFloat(editForm.totalAmount) || 0
          : editingSale.totalAmount,
        pointsEarned: editingSale.type === 'point'
          ? parseInt(editForm.pointsEarned) || 0
          : editingSale.pointsEarned,
        date: editForm.date,
        notes: editForm.notes || null,
      })
    } finally {
      setSaving(false)
    }
    setEditModalOpen(false)
    setEditingSale(null)
    fetchSales()
  }

  const pointCategories = getPointCategories()

  const filteredSales = filterPhone.trim()
    ? sales.filter((s) => s.notes?.toLowerCase().includes(filterPhone.trim().toLowerCase()))
    : sales

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Sales</h1>
          <p className="text-gray-500 text-sm mt-1">{filteredSales.length} records</p>
        </div>
        <button
          onClick={() => { resetForm(); setModalOpen(true) }}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus size={18} />
          Add Sale
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
        <Filter size={16} className="text-gray-400" />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            value={filterPhone}
            onChange={(e) => setFilterPhone(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="Search by phone"
          />
        </div>
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
        {(filterType || filterFrom || filterTo || filterPhone) && (
          <button
            onClick={() => { setFilterType(''); setFilterFrom(''); setFilterTo(''); setFilterPhone('') }}
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
        ) : filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ShoppingCart size={40} className="mb-2 opacity-30" />
            <p>No sales found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Service</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Details</th>
                <th className="px-6 py-3 font-medium">Agent</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Notes</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{s.serviceName ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{s.category ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      s.type === 'unit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {s.type === 'unit' ? 'Unit' : 'Point'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {s.type === 'unit'
                      ? s.category === 'Dollar Group'
                        ? `$${s.totalAmount.toFixed(2)}`
                        : `${s.quantity ?? 0} units`
                      : `${s.quantity ?? 0} qty → ${s.pointsEarned ?? 0} pts`}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{s.createdBy || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{format(new Date(s.date), 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{s.notes ?? '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(s)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Daily Sale">
        <div className="space-y-4">
          {/* Mode toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type</label>
            <div className="flex gap-3">
              {(['unit', 'point'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFormMode(t)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    formMode === t ? 'bg-slate-800 text-white border-slate-800' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t === 'unit' ? 'Unit Based' : 'Point Based'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Agent & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
              <input
                type="text"
                value={currentUser?.fullName ?? ''}
                readOnly
                aria-label="Agent name (auto-filled from login)"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Phone number"
              />
            </div>
          </div>

          {formMode === 'unit' ? (
            <>
              {/* Unit Group */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Unit Group
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {UNIT_GROUP_ITEMS.map((item) => (
                    <div key={item.name}>
                      <label className="block text-xs text-gray-600 mb-1">{item.name}</label>
                      <input
                        type="number"
                        value={unitGroupValues[item.name] ?? ''}
                        onChange={(e) =>
                          setUnitGroupValues({ ...unitGroupValues, [item.name]: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Dollar Group */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Dollar Group
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {DOLLAR_GROUP_ITEMS.map((item) => (
                    <div key={item.name}>
                      <label className="block text-xs text-gray-600 mb-1">{item.name}</label>
                      <input
                        type="number"
                        value={dollarGroupValues[item.name] ?? ''}
                        onChange={(e) =>
                          setDollarGroupValues({ ...dollarGroupValues, [item.name]: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="$0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
                {/* Total Revenue */}
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
                  <span className="font-medium text-green-800">Total Revenue</span>
                  <span className="font-bold text-green-700">${dollarGroupTotal.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Point Based - grouped by category */}
              {pointCategories.map((cat) => {
                const items = POINT_BASED_ITEMS.filter((i) => i.category === cat)
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      {cat}
                    </h3>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const qty = parseInt(pointValues[item.name]) || 0
                        const pts = computeItemPoints(item.name, qty)
                        const multiplierLabel =
                          item.bonusPoints
                            ? `×${item.pointMultiplier ?? 0} +${item.bonusPoints} pts`
                            : `×${item.pointMultiplier ?? 0} pts`
                        return (
                          <div key={item.name} className="flex items-center gap-3">
                            <div className="flex-1">
                              <span className="text-xs text-gray-600">
                                {item.name}{' '}
                                <span className="text-gray-400">({multiplierLabel})</span>
                              </span>
                            </div>
                            <input
                              type="number"
                              value={pointValues[item.name] ?? ''}
                              onChange={(e) =>
                                setPointValues({ ...pointValues, [item.name]: e.target.value })
                              }
                              className="w-20 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-300"
                              placeholder="0"
                              min="0"
                            />
                            <span className="text-xs text-purple-600 w-14 text-right font-medium">
                              {pts > 0 ? `${pts} pts` : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {/* Total Points */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
                <span className="font-medium text-purple-800">Total Points</span>
                <span className="font-bold text-purple-700">{totalPoints} pts</span>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
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

      {/* Edit Sale Modal */}
      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingSale(null) }} title="Edit Sale">
        {editingSale && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-gray-800">{editingSale.serviceName ?? '—'}</p>
              <p className="text-gray-500 text-xs mt-0.5">{editingSale.category ?? '—'} · {editingSale.type === 'unit' ? 'Unit Based' : 'Point Based'}</p>
            </div>

            {/* Editable value field */}
            {editingSale.type === 'unit' && editingSale.category !== 'Dollar Group' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  min="0"
                />
              </div>
            )}

            {editingSale.category === 'Dollar Group' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={editForm.totalAmount}
                  onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  step="0.01"
                  min="0"
                />
              </div>
            )}

            {editingSale.type === 'point' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points Earned</label>
                  <input
                    type="number"
                    value={editForm.pointsEarned}
                    onChange={(e) => setEditForm({ ...editForm, pointsEarned: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    min="0"
                  />
                </div>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setEditModalOpen(false); setEditingSale(null) }}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
