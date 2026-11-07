// Where the GitHub Action "APK release" publishes the app (public bucket `apk`).
const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/apk`

/** Always the latest APK (overwritten on every release). */
export const APK_URL = `${STORAGE}/domino.apk`
/** { versionCode, versionName, url, publishedAt } of the latest release. */
export const LATEST_URL = `${STORAGE}/latest.json`
