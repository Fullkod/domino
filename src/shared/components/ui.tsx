import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-violet-600 text-white shadow-lg shadow-violet-950/40 hover:bg-violet-500',
  secondary: 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-neutral-300 hover:bg-neutral-800',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-neutral-100 placeholder:text-neutral-500 focus:border-violet-400 focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-neutral-100 focus:border-violet-400 focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-neutral-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 ${className}`}>{children}</section>
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'border-red-800 bg-red-950/60 text-red-200',
    success: 'border-violet-600/60 bg-violet-900/40 text-violet-100',
    info: 'border-neutral-700 bg-neutral-900 text-neutral-300',
  }
  return <p className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>{children}</p>
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-neutral-400" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-oro" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' }) {
  const tones = {
    neutral: 'bg-neutral-800 text-neutral-300',
    green: 'bg-violet-500/20 text-violet-200',
    amber: 'bg-oro/15 text-oro',
    red: 'bg-red-950 text-red-300',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

/** Chip amounts: integers with thousands separators. */
export function formatChips(value: number | bigint | null | undefined): string {
  return new Intl.NumberFormat('es').format(Number(value ?? 0))
}
