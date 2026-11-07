import type { NextConfig } from 'next'

// Static export: the same build is packaged into the APK by Capacitor (webDir "out")
// and can be served as a static site on Vercel. That means no middleware, no route
// handlers and no Server Actions: privileged logic lives in Supabase (RLS, RPCs and
// Edge Functions). See AGENTS.md.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
