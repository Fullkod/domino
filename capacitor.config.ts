import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fullkod.domino',
  appName: 'Dominó',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // Local development with live reload (never commit enabled):
    // url: 'http://192.168.1.100:3000',
    // cleartext: true,
  },
}

export default config
