'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { getCurrentUser } from '@/lib/store'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  const isLoginPage = pathname === '/login'

  useEffect(() => {
    const user = getCurrentUser()
    if (!user && !isLoginPage) {
      router.replace('/login')
    } else {
      setChecked(true)
    }
  }, [pathname, isLoginPage, router])

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
