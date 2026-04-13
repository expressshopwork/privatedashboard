'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Zap, Settings, Shield, LogOut, Target, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { getCurrentUser, logoutUser } from '@/lib/store'
import { syncToGoogleSheets } from '@/lib/syncGoogleSheets'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'Daily Sales', icon: ShoppingCart },
  { href: '/topup', label: 'Top Up', icon: Zap },
  { href: '/sale-tracking', label: 'Performance', icon: Target },
  { href: '/settings', label: 'KPI Settings', icon: Settings },
]

const adminNavItems = [
  { href: '/settings/permissions', label: 'Permissions', icon: Shield },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const allNavItems = currentUser?.role === 'admin'
    ? [...navItems, ...adminNavItems]
    : navItems

  const handleLogout = () => {
    logoutUser()
    router.push('/login')
  }

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setToast(null)
    const result = await syncToGoogleSheets()
    setSyncing(false)
    if (result.success && result.counts) {
      setToast({
        ok: true,
        msg: `Synced: ${result.counts.customers} customers, ${result.counts.sales} sales, ${result.counts.topups} top-ups, ${result.counts.kpis} KPIs`,
      })
    } else {
      setToast({ ok: false, msg: result.error ?? 'Sync failed' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <aside className="w-64 flex flex-col" style={{ backgroundColor: '#34914A' }}>
      <div className="p-6 border-b border-white/20">
        <h1 className="text-xl font-semibold text-white tracking-tight">Shop Dashboard</h1>
        <p className="text-white/70 text-sm mt-1 font-light">Performance Monitor</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {allNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white/25 text-white font-medium'
                  : 'text-white/80 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/20 space-y-2">
        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors text-sm disabled:opacity-60"
          title="Sync to Google Sheets"
        >
          {syncing ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={16} />
          )}
          <span className="font-medium">{syncing ? 'Syncing...' : 'Sync to Sheets'}</span>
        </button>
        {toast && (
          <div
            className={`text-xs px-3 py-1.5 rounded-lg ${
              toast.ok ? 'bg-green-700/50 text-white' : 'bg-red-700/50 text-white'
            }`}
          >
            {toast.ok ? '✓ ' : '✗ '}{toast.msg}
          </div>
        )}
        {currentUser && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">{currentUser.fullName}</p>
              <p className="text-white/60 text-xs capitalize">{currentUser.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/70 hover:text-white transition-colors p-1"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <p className="text-white/50 text-xs text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
