/** Returns true when running inside a Capacitor WebView (Android / iOS). */
export const isCapacitor = (): boolean =>
  typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
