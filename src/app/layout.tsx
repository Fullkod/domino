import type { Metadata, Viewport } from 'next'
import { UpdateGate } from '@/features/app-update/components/UpdateGate'
import { BRAND } from '@/shared/constants/brand'
import { SessionProvider } from '@/shared/hooks/session'
import './globals.css'

export const metadata: Metadata = {
  title: BRAND.appName,
  description: BRAND.tagline,
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <UpdateGate>
          <SessionProvider>{children}</SessionProvider>
        </UpdateGate>
      </body>
    </html>
  )
}
