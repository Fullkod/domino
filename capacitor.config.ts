import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dominoclubes.app',
  appName: 'Dominó',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // Local development with live reload (never commit enabled):
    // url: 'http://192.168.1.100:3000',
    // cleartext: true,
  },
  plugins: {
    // Dark UI: light status/navigation bar icons. Insets are handled natively (webview padded).
    SystemBars: { style: 'DARK' },
  },
}

export default config
