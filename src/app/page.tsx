'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Spinner } from '@/shared/components/ui'
import { useSession } from '@/shared/hooks/session'

// Static export: no server redirects, so the entry page routes on the client.
export default function Home() {
  const { loading, session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!loading) router.replace(session ? '/clubs/' : '/login/')
  }, [loading, session, router])

  return <Spinner />
}
