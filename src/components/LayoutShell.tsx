'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { getCurrentUser, isSessionExpired, logoutUser, touchSession } from '@/lib/store'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const isLoginPage = normalizedPath === '/login'

  const checkSession = useCallback(() => {
    const user = getCurrentUser()
    if (!user || isSessionExpired()) {
      logoutUser()
      router.replace('/login')
      return false
    }
    return true
  }, [router])

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true)
      return
    }

    if (!checkSession()) return
    setChecked(true)

    // Touch session on user activity
    const handleActivity = () => {
      if (getCurrentUser()) touchSession()
    }
    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)

    // Periodic session check every 60 seconds
    const interval = setInterval(() => {
      if (!checkSession()) {
        clearInterval(interval)
      }
    }, 60_000)

    return () => {
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      clearInterval(interval)
    }
  }, [pathname, isLoginPage, router, checkSession])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
