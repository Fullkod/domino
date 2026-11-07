'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DownloadAppButton } from '@/features/app-update/components/DownloadAppButton'
import { Spinner } from '@/shared/components/ui'
import { Logo } from '@/shared/components/Logo'
import { BRAND } from '@/shared/constants/brand'
import { useSession } from '@/shared/hooks/session'

// Auth guard for every private screen (client-side: static export has no middleware).
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { loading, session, profile } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !session) router.replace('/login/')
  }, [loading, session, router])

  if (loading || !session) return <Spinner />

  const links = [
    { href: '/clubs/', label: 'Clubes' },
    ...(profile?.role === 'platform' ? [{ href: '/platform/', label: 'Plataforma' }] : []),
    ...(profile?.role === 'auditor' || profile?.role === 'platform' ? [{ href: '/supervision/', label: 'Supervisión' }] : []),
    { href: '/perfil/', label: 'Perfil' },
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <Link href="/clubs/" aria-label={BRAND.appName}>
          <Logo height={26} />
        </Link>
        <nav className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname?.startsWith(link.href.slice(0, -1)) ? 'bg-neutral-800 text-white' : 'text-neutral-400'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <DownloadAppButton variant="banner" />
      {profile?.status === 'suspended' && (
        <p className="bg-red-950 px-4 py-2 text-center text-sm text-red-200">Tu cuenta está suspendida.</p>
      )}
      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  )
}
