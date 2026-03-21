/// <reference types="vite/client" />
import { installDevMock } from './devMock'

export async function installBaseline(): Promise<void> {
  if (import.meta.env.DEV) {
    installDevMock()
  }
  // production Electron — preload already injected window.baseline
}
