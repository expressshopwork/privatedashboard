'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, ShoppingCart, Zap, Settings } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/sales', label: 'Daily Sales', icon: ShoppingCart },
  { href: '/topup', label: 'Top Up', icon: Zap },
  { href: '/settings', label: 'KPI Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-slate-800 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">Shop Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Performance Monitor</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-400 text-xs text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
