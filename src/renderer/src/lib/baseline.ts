/// <reference types="vite/client" />
/**
 * Platform bridge installer.
 *
 * Call once and await before React renders.  Injects the correct
 * window.baseline implementation for the current runtime:
 *   - Capacitor (Android) → capacitorBaseline (dynamically imported)
 *   - Electron            → already injected by preload, nothing to do
 *   - Browser dev preview → devMock
 *
 * The Capacitor import is intentionally dynamic so that @capacitor/* packages
 * are never evaluated in the Electron renderer, where their initialization
 * code interferes with the native process bridge and causes a blank window.
 */
import { isCapacitor } from './platformDetect'
import { installDevMock } from './devMock'

export async function installBaseline(): Promise<void> {
  if (isCapacitor()) {
    const { createCapacitorBaseline } = await import('./capacitorBaseline')
    ;(window as unknown as { baseline: typeof window.baseline }).baseline =
      createCapacitorBaseline()
  } else if (import.meta.env.DEV) {
    // installDevMock guards against double-install (Electron injects it first)
    installDevMock()
  }
  // else: production Electron — preload already injected window.baseline
}
