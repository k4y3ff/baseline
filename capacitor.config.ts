import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.baseline.app',
  appName: 'Baseline',
  // Points at the same output the electron-vite renderer build produces
  webDir: 'out/renderer',
  plugins: {
    // Enable native HTTP to bypass CORS restrictions for Oura / YNAB API calls
    CapacitorHttp: {
      enabled: true
    }
  }
}

export default config
