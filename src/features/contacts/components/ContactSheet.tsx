'use client'

import { useEffect, useState } from 'react'
import { Button, Notice, Spinner } from '@/shared/components/ui'
import { errorMessage } from '@/shared/lib/errors'
import { callUrl, listContacts, whatsappUrl, type Contact } from '../services/contacts-service'

interface ContactSheetProps {
  /** Club whose contacts to show; null = the platform operator. */
  clubId: string | null
  title: string
  /** Why the sheet opened, e.g. "Te faltan fichas para esta mesa." */
  reason?: string
  /** Pre-filled WhatsApp text. Neutral on purpose: no amounts, no money. */
  message: string
  onClose: () => void
}

export function ContactSheet({ clubId, title, reason, message, onClose }: ContactSheetProps) {
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    listContacts(clubId).then(
      (list) => current && setContacts(list),
      (err) => current && setError(errorMessage(err)),
    )
    return () => {
      current = false
    }
  }, [clubId])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md space-y-3 rounded-t-2xl border border-neutral-800 bg-neutral-900 p-4 pb-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="px-2 text-2xl leading-none text-neutral-400" aria-label="Cerrar">
            ×
          </button>
        </div>
        {reason && <p className="text-sm text-neutral-300">{reason}</p>}
        {error && <Notice>{error}</Notice>}
        {contacts === null && !error && <Spinner />}
        {contacts?.length === 0 && (
          <Notice tone="info">
            {clubId ? 'El club todavía no ha puesto contactos. Habla con su administrador.' : 'La plataforma todavía no ha puesto contactos.'}
          </Notice>
        )}
        <ul className="space-y-2">
          {contacts?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.label}</p>
                <p className="text-xs text-neutral-500">{c.phone}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a href={whatsappUrl(c.phone, message)} target="_blank" rel="noopener noreferrer">
                  <Button className="px-3 py-1.5">WhatsApp</Button>
                </a>
                <a href={callUrl(c.phone)}>
                  <Button variant="secondary" className="px-3 py-1.5">
                    Llamar
                  </Button>
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
