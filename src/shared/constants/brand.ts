// White-label brand (BUSINESS_LOGIC.md §8). Every user-facing name comes from here;
// the developer's name must never appear in the app, the APK or the public web.
export const BRAND = {
  appName: 'Dominó',
  tagline: 'Dominó online con tu club',
  /**
   * Public web address (invitation links, password reset, Android App Links). Set with
   * NEXT_PUBLIC_APP_URL, without a trailing slash. Empty = no shareable links yet.
   */
  webUrl: (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, ''),
} as const
