'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { signOut } from '@/features/auth/services/auth-service'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, Field, Input, Notice } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

export default function ProfilePage() {
  const { profile } = useCurrentUser()
  // Remount the form when the profile loads so it starts from the saved name.
  return <ProfileForm key={profile?.id ?? 'loading'} initialName={profile?.display_name ?? ''} />
}

function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter()
  const { email, refreshProfile } = useCurrentUser()
  const [name, setName] = useState(initialName)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 30) {
      setMessage({ tone: 'error', text: 'El nombre debe tener entre 2 y 30 caracteres.' })
      return
    }
    setBusy(true)
    const { error } = await createClient().rpc('update_my_display_name', { p_name: trimmed })
    setBusy(false)
    if (error) setMessage({ tone: 'error', text: errorMessage(error) })
    else {
      setMessage({ tone: 'success', text: 'Nombre guardado.' })
      await refreshProfile()
    }
  }

  async function logout() {
    await signOut()
    router.replace('/login/')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <Card>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nombre de jugador">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </Field>
          <p className="text-sm text-neutral-400">Correo: {email}</p>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Button type="submit" disabled={busy}>
            Guardar
          </Button>
        </form>
      </Card>
      <Button variant="secondary" className="w-full" onClick={logout}>
        Cerrar sesión
      </Button>
    </div>
  )
}
