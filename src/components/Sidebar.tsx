'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Zap, Settings, Shield, LogOut, Target } from 'lucide-react'
import { getCurrentUser, logoutUser } from '@/lib/store'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'Daily Sales', icon: ShoppingCart },
  { href: '/topup', label: 'Top Up', icon: Zap },
  { href: '/sale-tracking', label: 'Sale Tracking', icon: Target },
  { href: '/settings', label: 'KPI Settings', icon: Settings },
]

const adminNavItems = [
  { href: '/settings/permissions', label: 'Permissions', icon: Shield },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const currentUser = getCurrentUser()

  const allNavItems = currentUser?.role === 'admin'
    ? [...navItems, ...adminNavItems]
    : navItems

  const handleLogout = () => {
    logoutUser()
    router.push('/login')
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
      <div className="p-4 border-t border-white/20">
        {currentUser && (
          <div className="flex items-center justify-between mb-3">
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
