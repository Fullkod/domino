'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { APK_URL, LATEST_URL } from '../lib/apk'

function noSubscribe() {
  return () => undefined
}

/** True only in a browser (not inside the APK); false while prerendering. */
function useIsWeb(): boolean {
  return useSyncExternalStore(noSubscribe, () => !Capacitor.isNativePlatform(), () => false)
}

/**
 * "Download the app" for visitors of the public web. Renders nothing inside the APK.
 * `variant="banner"` is a slim strip for the top of the private screens.
 */
export function DownloadAppButton({ variant = 'button' }: { variant?: 'button' | 'banner' }) {
  const isWeb = useIsWeb()
  const [version, setVersion] = useState<{ code: number; name: string } | null>(null)

  useEffect(() => {
    if (!isWeb) return
    let current = true
    fetch(`${LATEST_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ versionCode: number; versionName: string }>) : null))
      .then(
        (latest) => current && latest && setVersion({ code: latest.versionCode, name: latest.versionName }),
        () => undefined,
      )
    return () => {
      current = false
    }
  }, [isWeb])

  if (!isWeb) return null
  // Same file name for every release: the query string skips any cached copy.
  const href = version ? `${APK_URL}?v=${version.code}` : APK_URL
  const label = `Descargar la app para Android${version ? ` (v${version.name})` : ''}`

  if (variant === 'banner') {
    return (
      <a
        href={href}
        className="flex items-center justify-center gap-2 bg-emerald-950 px-4 py-2 text-sm font-medium text-emerald-200"
      >
        <DownloadIcon />
        {label}
      </a>
    )
  }
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-950"
    >
      <DownloadIcon />
      {label}
    </a>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  )
}
