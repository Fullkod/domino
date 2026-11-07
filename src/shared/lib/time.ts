// Dates for lists: "hace 5 min" plus the exact date and time.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Relative time in Spanish ("ahora", "hace 5 min", "hace 2 h", "hace 3 días"). */
export function timeAgo(date: string | Date, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(date).getTime())
  if (diff < MINUTE) return 'ahora'
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`
  const days = Math.floor(diff / DAY)
  if (days < 30) return days === 1 ? 'hace 1 día' : `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
  const years = Math.floor(days / 365)
  return years <= 1 ? 'hace 1 año' : `hace ${years} años`
}

/** Exact local date and time, e.g. "7/11/26, 16:49". */
export function exactTime(date: string | Date): string {
  return new Date(date).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
}

/** "hace 5 min · 7/11/26, 16:49" */
export function whenLabel(date: string | Date, now?: number): string {
  return `${timeAgo(date, now)} · ${exactTime(date)}`
}
