'use client'

import { useEffect, useState } from 'react'
import { Shield, Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import { getUsers, addUser, updateUser, deleteUser, getCurrentUser, type AppUser } from '@/lib/store'
import { useRouter } from 'next/navigation'

type UserForm = {
  fullName: string
  username: string
  password: string
  role: 'admin' | 'agent' | 'sup'
  status: 'active' | 'inactive'
}

const emptyForm: UserForm = {
  fullName: '',
  username: '',
  password: '',
  role: 'agent',
  status: 'active',
}

export default function PermissionsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AppUser[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const current = getCurrentUser()
    if (!current || current.role !== 'admin') {
      router.replace('/')
      return
    }
    setUsers(getUsers())
  }, [router])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const handleSave = () => {
    setError('')
    setSuccess('')

    if (!form.fullName.trim() || !form.username.trim()) {
      setError('Full name and username are required')
      return
    }

    if (!editingId && !form.password) {
      setError('Password is required for new users')
      return
    }

    try {
      if (editingId) {
        updateUser(editingId, {
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          password: form.password || undefined,
          role: form.role,
          status: form.status,
        })
        setSuccess('User updated successfully')
      } else {
        addUser({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          status: form.status,
        })
        setSuccess('User created successfully')
      }
      setUsers(getUsers())
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleEdit = (user: AppUser) => {
    setForm({
      fullName: user.fullName,
      username: user.username,
      password: '',
      role: user.role,
      status: user.status,
    })
    setEditingId(user.id)
    setShowForm(true)
    setError('')
  }

  const handleDelete = (user: AppUser) => {
    if (user.username === 'admin') {
      setError('Cannot delete the default admin account')
      return
    }
    if (!confirm(`Delete user "${user.fullName}"?`)) return
    deleteUser(user.id)
    setUsers(getUsers())
    setSuccess('User deleted')
    setTimeout(() => setSuccess(''), 3000)
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    sup: 'bg-blue-100 text-blue-700',
    agent: 'bg-green-100 text-green-700',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-200 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Permissions</h1>
          <p className="text-gray-500 text-sm mt-1">Manage users and roles</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: '#2C9E47' }}
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5">
          ✓ {success}
        </div>
      )}

      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      {/* User Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#2C9E47' }}>
                <Shield size={20} className="text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">
                {editingId ? 'Edit User' : 'Create New User'}
              </h2>
            </div>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {error && showForm && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password {editingId && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder={editingId ? '••••••••' : 'Enter password'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserForm['role'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="agent">Agent</option>
                  <option value="sup">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as UserForm['status'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: '#2C9E47' }}
            >
              <Save size={16} />
              {editingId ? 'Update User' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b">
                <th className="px-6 py-3 font-medium">Full Name</th>
                <th className="px-6 py-3 font-medium">Username</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{user.fullName}</td>
                  <td className="px-6 py-4 text-gray-600">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${roleColors[user.role] ?? ''}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[user.status] ?? ''}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {user.username !== 'admin' && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
