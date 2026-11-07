'use client'

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Android App Links: https://<web>/unirse/… and /restablecer/… open the APK (intent filter in
// AndroidManifest.xml, verified by /.well-known/assetlinks.json). Capacitor hands the URL over
// here, both when the app is already running and when the link started it.
const HANDLED = ['/unirse', '/restablecer']

function targetOf(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!HANDLED.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null
    const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
    return `${path}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function DeepLinks() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let last: string | null = null
    const go = (raw: string | undefined) => {
      const target = raw ? targetOf(raw) : null
      if (!target || target === last) return
      last = target
      router.push(target)
    }
    void App.getLaunchUrl().then((launch) => go(launch?.url))
    const listener = App.addListener('appUrlOpen', (event) => go(event.url))
    return () => {
      void listener.then((l) => l.remove())
    }
  }, [router])

  return null
}
