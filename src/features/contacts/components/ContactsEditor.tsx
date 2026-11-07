'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button, Card, Field, Input, Notice } from '@/shared/components/ui'
import { errorMessage } from '@/shared/lib/errors'
import { addContact, deleteContact, isValidPhone, listContacts, type Contact } from '../services/contacts-service'

/** Manage up to 5 contacts. `clubId` null = the platform's own contacts. */
export function ContactsEditor({ clubId, intro }: { clubId: string | null; intro: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [label, setLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let current = true
    listContacts(clubId).then(
      (list) => current && setContacts(list),
      (err) => current && setMessage({ tone: 'error', text: errorMessage(err) }),
    )
    return () => {
      current = false
    }
  }, [clubId, version])

  async function run(fn: () => Promise<void>, success: string) {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      setMessage({ tone: 'success', text: success })
      reload()
      return true
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (label.trim().length < 2) return setMessage({ tone: 'error', text: 'Pon un nombre de al menos 2 letras.' })
    if (!isValidPhone(phone)) {
      return setMessage({ tone: 'error', text: 'Escribe el teléfono con el código del país, por ejemplo +53 51234567.' })
    }
    const ok = await run(() => addContact(clubId, label, phone), 'Contacto añadido.')
    if (ok) {
      setLabel('')
      setPhone('')
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Contactos</h2>
      <p className="text-sm text-neutral-400">{intro}</p>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {contacts.length > 0 && (
        <ul className="divide-y divide-neutral-800 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-neutral-500">{c.phone}</p>
              </div>
              <Button variant="ghost" disabled={busy} onClick={() => run(() => deleteContact(c.id), 'Contacto quitado.')}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {contacts.length < 5 && (
        <form onSubmit={submit} className="space-y-2">
          <Field label="Nombre">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Ej.: Pedro" />
          </Field>
          <Field label="Teléfono (WhatsApp)" hint="Con el código del país.">
            <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+53 51234567" />
          </Field>
          <Button type="submit" disabled={busy}>
            Añadir contacto
          </Button>
        </form>
      )}
    </Card>
  )
}
