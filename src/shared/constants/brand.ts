// White-label brand (BUSINESS_LOGIC.md §8). Every user-facing name comes from here;
// the developer's name must never appear in the app, the APK or the public web.
export const BRAND = {
  appName: 'Dominó',
  tagline: 'Dominó online con tu club',
  /**
   * Public web address (invitation links, password reset, Android App Links). NEXT_PUBLIC_APP_URL
   * overrides it (e.g. when the operator's own domain arrives); no trailing slash.
   */
  webUrl: (process.env.NEXT_PUBLIC_APP_URL || 'https://domino-jet-kappa.vercel.app').replace(/\/+$/, ''),
} as const
