'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/shared/hooks/session'

// Signed-in users skip the auth screens.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { loading, session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!loading && session) router.replace('/clubs/')
  }, [loading, session, router])

  return <div className="min-h-screen">{children}</div>
}
