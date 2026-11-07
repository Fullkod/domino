// Club invitations by link: https://<web>/unirse/?c=CODE (BUSINESS_LOGIC §3.1).
// The link opens the APK through Android App Links; without the app it shows a download page.
// A code received before signing in is kept until the user is in, then the join screen resumes.
// Relative import: Vitest runs without the @/ alias.
import { BRAND } from '../../../shared/constants/brand'

const PENDING_KEY = 'domino.pendingInvite'
const CODE_PATTERN = /^[A-Z0-9]{6}$/

/** Normalized club code, or null if it does not look like one. */
export function cleanCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export function invitePath(code: string): string {
  return `/unirse/?c=${encodeURIComponent(code)}`
}

/** Shareable link; null while there is no public web address configured. */
export function inviteUrl(code: string): string | null {
  return BRAND.webUrl ? `${BRAND.webUrl}${invitePath(code)}` : null
}

export function inviteMessage(clubName: string, code: string): string {
  const url = inviteUrl(code)
  return url
    ? `Te invito a mi club «${clubName}» en ${BRAND.appName}. Entra con este enlace: ${url}`
    : `Te invito a mi club «${clubName}» en ${BRAND.appName}. Busca el club con el código ${code}.`
}

// localStorage can throw (private mode, blocked storage): an invitation is a convenience.
export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(PENDING_KEY, code)
  } catch {
    /* ignore */
  }
}

export function readPendingInvite(): string | null {
  try {
    return cleanCode(localStorage.getItem(PENDING_KEY))
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

/** Where to go after signing in: the pending invitation if there is one. */
export function afterSignInPath(): string {
  const code = readPendingInvite()
  return code ? invitePath(code) : '/clubs/'
}
