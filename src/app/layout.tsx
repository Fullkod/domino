import type { Metadata, Viewport } from 'next'
import { DM_Sans, JetBrains_Mono, Outfit } from 'next/font/google'
import { UpdateGate } from '@/features/app-update/components/UpdateGate'
import { DeepLinks } from '@/features/invites/components/DeepLinks'
import { BRAND } from '@/shared/constants/brand'
import { SessionProvider } from '@/shared/hooks/session'
import './globals.css'

// Brand typefaces (OFL, self-hosted by next/font at build time, so they also work offline in the APK).
const outfit = Outfit({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-outfit', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-dm-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains-mono', display: 'swap' })

export const metadata: Metadata = {
  title: BRAND.appName,
  description: `${BRAND.description}. ${BRAND.tagline}.`,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#170D35',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} ${dmSans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased">
        <UpdateGate>
          <SessionProvider>
            <DeepLinks />
            {children}
          </SessionProvider>
        </UpdateGate>
      </body>
    </html>
  )
}
