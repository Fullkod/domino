import Link from 'next/link'
import { BRAND } from '@/shared/constants/brand'
import { LEGAL, PRIVACY, TERMS, type LegalSection } from '@/shared/constants/legal'

// Public page (no session needed): linked from sign-up, login and the profile.
export const metadata = { title: `Términos y condiciones · ${BRAND.appName}` }

function fill(text: string): string {
  return text.replaceAll('{operator}', LEGAL.operatorName).replaceAll('{age}', String(LEGAL.minimumAge))
}

function Sections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="space-y-2">
          <h3 className="font-semibold text-neutral-100">{s.title}</h3>
          {s.paragraphs.map((p) => (
            <p key={p}>{fill(p)}</p>
          ))}
        </section>
      ))}
    </>
  )
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 text-sm leading-relaxed text-neutral-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Términos y condiciones</h1>
        <Link href="/" className="text-sm text-violet-400">
          Volver
        </Link>
      </div>
      <p className="text-xs text-neutral-500">
        {BRAND.appName} · Actualizado el {LEGAL.updatedAt}
        {!LEGAL.reviewed && ' · Versión provisional, pendiente de revisión legal'}
      </p>

      <Sections sections={TERMS} />

      <h2 id="privacidad" className="pt-4 text-xl font-bold text-white">
        Privacidad
      </h2>
      <Sections sections={PRIVACY} />

      <p className="border-t border-neutral-800 pt-4 text-xs text-neutral-500">
        {LEGAL.contactEmail
          ? `Para cualquier consulta sobre estos términos o tus datos: ${LEGAL.contactEmail}.`
          : 'Para cualquier consulta sobre estos términos o tus datos, habla con tu club.'}
      </p>
    </div>
  )
}
