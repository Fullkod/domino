import type { ReactNode } from 'react'
import { Logo } from '@/shared/components/Logo'
import { BRAND } from '@/shared/constants/brand'

/** Centered layout of the public auth screens. */
export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <div className="flex justify-center">
            <Logo variant="stacked" height={104} />
          </div>
          <h1 className="sr-only">{BRAND.appName}</h1>
          <p className="text-sm text-neutral-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
