'use client'

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/shared/constants/brand'
import { compareVersions } from '@/shared/lib/version'
import { LATEST_URL } from '../lib/apk'

// APK updates (BUSINESS_LOGIC §7). The GitHub Action publishes the latest APK and
// `latest.json` to the public `apk` bucket; the installed app compares its own versionCode
// with it. Below `app_settings.min_app_version` the app is blocked until it is updated.
// In the browser there is nothing to update.

interface Latest {
  versionCode: number
  versionName: string
  url: string
}

type State = { kind: 'ok' } | { kind: 'available'; latest: Latest } | { kind: 'required'; latest: Latest | null }


async function check(): Promise<State> {
  const [info, latest, settings] = await Promise.all([
    App.getInfo(),
    fetch(`${LATEST_URL}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Latest>) : null))
      .catch(() => null),
    createClient().from('app_settings').select('min_app_version').maybeSingle(),
  ])
  const minVersion = settings.data?.min_app_version
  if (minVersion && compareVersions(info.version, minVersion) < 0) return { kind: 'required', latest }
  if (latest && latest.versionCode > Number.parseInt(info.build, 10)) return { kind: 'available', latest }
  return { kind: 'ok' }
}

function downloadUrl(latest: Latest): string {
  // Same file name for every release: the query string skips any cached copy.
  return `${latest.url}?v=${latest.versionCode}`
}

export function UpdateGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'ok' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let active = true
    const run = () =>
      check().then(
        (next) => active && setState(next),
        () => undefined, // Offline or storage down: never block the app because of the check.
      )
    void run()
    const listener = App.addListener('resume', () => void run())
    return () => {
      active = false
      void listener.then((l) => l.remove())
    }
  }, [])

  if (state.kind === 'required') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">{BRAND.appName}</h1>
        <p className="text-neutral-300">Hay que actualizar la app para seguir jugando.</p>
        {state.latest ? (
          <a
            href={downloadUrl(state.latest)}
            className="rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-neutral-950"
            target="_blank"
            rel="noopener noreferrer"
          >
            Descargar la versión {state.latest.versionName}
          </a>
        ) : (
          <p className="text-sm text-neutral-500">Pide el enlace de descarga a tu club.</p>
        )}
        <p className="text-xs text-neutral-500">Al terminar la descarga, ábrela y pulsa «Instalar».</p>
      </div>
    )
  }

  return (
    <>
      {state.kind === 'available' && !dismissed && (
        <div className="flex items-center justify-between gap-3 bg-emerald-900 px-4 py-2 text-sm text-emerald-50">
          <span>Hay una versión nueva de la app.</span>
          <span className="flex shrink-0 gap-3">
            <a href={downloadUrl(state.latest)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Actualizar
            </a>
            <button onClick={() => setDismissed(true)} aria-label="Ahora no" className="text-emerald-200">
              Ahora no
            </button>
          </span>
        </div>
      )}
      {children}
    </>
  )
}
