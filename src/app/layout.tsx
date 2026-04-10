import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'

const inter = localFont({
  src: [
    { path: '../fonts/inter-latin-300.woff2', weight: '300', style: 'normal' },
    { path: '../fonts/inter-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/inter-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/inter-latin-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/inter-latin-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Shop Dashboard',
  description: 'Private shop performance dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
