'use client'

import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { useState } from 'react'
import { Button } from '@/shared/components/ui'
import { inviteMessage, inviteUrl } from '../lib/invite'

/** Shares the club's invitation link (native share sheet in the APK, WhatsApp/copy on the web). */
export function InviteButton({ clubName, code }: { clubName: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const text = inviteMessage(clubName, code)
  const url = inviteUrl(code)

  async function share() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: `Invitación a ${clubName}`, text, dialogTitle: 'Invitar al club' })
      } catch {
        // The user closed the share sheet.
      }
      return
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Invitación a ${clubName}`, text })
        return
      } catch {
        // Cancelled or not allowed: fall back to WhatsApp.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url ?? code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button className="flex-1" onClick={share}>
        Invitar
      </Button>
      <Button variant="secondary" onClick={copy}>
        {copied ? 'Copiado' : url ? 'Copiar enlace' : 'Copiar código'}
      </Button>
    </div>
  )
}
