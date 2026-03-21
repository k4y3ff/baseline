# Baseline

A local-first wellness dashboard that correlates [Oura](https://ouraring.com) ring data (sleep, HRV, readiness, activity) with daily mood and energy check-ins. All data is stored on your device as plain Markdown and CSV files — no cloud, no accounts.

Available on **macOS** (Electron) and **Android** (Capacitor).

## Features

- **Daily check-ins** — log mood (1–5) and energy (1–5) with optional notes, saved as `YYYY-MM-DD.md`
- **Oura sync** — pulls sleep score, sleep hours, HRV, readiness, activity, and steps via the Oura v2 API
- **YNAB sync** — tracks daily spending from your YNAB budget
- **7-day dashboard** — combined chart of sleep hours and mood, plus today's key metrics at a glance
- **Plain-file vault** — your data lives in files you control; back it up with iCloud, Dropbox, or anything

## Requirements

- [Node.js](https://nodejs.org) 20+
- An [Oura ring](https://ouraring.com) (optional — the app works without one)
- **Android builds only:** [Android Studio](https://developer.android.com/studio) with Android SDK

## Setup

```bash
git clone <repo>
cd baseline
npm install
```

## Desktop (macOS)

### Development

```bash
npm run dev
```

Launches the Electron app with hot reload. On first run you'll be prompted to choose a vault folder and optionally connect your Oura ring.

### Building a distributable

```bash
npm run dist:mac
```

Produces a `dist/Baseline-*.dmg` you can install like any other macOS app.

## Android

Baseline uses [Capacitor](https://capacitorjs.com) to wrap the same React UI in a native Android WebView. All features work on Android except LLM summaries/chat (which require a local Ollama server).

### First-time setup

After cloning and running `npm install`, build the renderer and sync it to the Android project:

```bash
npm run android:sync
```

Then open Android Studio:

```bash
npm run android:open
```

Build and run the app from Android Studio (Run → Run 'app'), or use:

```bash
npm run android:run
```

### Subsequent builds

Whenever you change renderer code, re-sync before building:

```bash
npm run android:sync   # rebuilds renderer and syncs to android/
npm run android:open   # open Android Studio to build/run
```

### Android scripts

| Command | What it does |
|---|---|
| `npm run android:sync` | Builds the renderer and syncs assets to `android/` |
| `npm run android:open` | Opens Android Studio |
| `npm run android:run` | Builds and runs on a connected device or emulator |

### Android data storage

On Android, Baseline stores all data in app-private storage (no folder picker required). The vault directory structure is identical to desktop:

```
(app private storage)/vault/
  .baseline/config.json
  check-ins/YYYY-MM-DD.md
  oura/oura.csv
  ynab/spending.csv
  screenings/
```

Data does not leave the device unless you explicitly export it. Google Drive sync (for desktop↔mobile sync) is planned for a future release.

## Project structure

```
electron/
  main.ts       # Main process — file I/O, Oura API sync, IPC handlers
  preload.ts    # Exposes window.baseline bridge to renderer

src/renderer/src/
  pages/        # Setup, Dashboard, CheckIn, Analyze, History, Settings
  components/   # Nav, chart wrappers
  hooks/        # useDashboard, useConfig, useVault
  lib/
    baseline.ts           # Platform bridge installer (runs at boot)
    platformDetect.ts     # isCapacitor() helper
    capacitorBaseline.ts  # Android implementation of window.baseline
    devMock.ts            # Browser dev preview mock
    checkInFormat.ts      # Markdown serialiser/parser
  types/        # Shared TypeScript types

android/        # Capacitor Android project (open in Android Studio)
capacitor.config.ts  # Capacitor configuration
```

## Vault layout

```
YourVault/
  .baseline/
    config.json          # OAuth tokens and settings (plaintext for now)
  check-ins/
    2026-03-20.md        # One file per day
    ...
  oura/
    oura.csv             # Daily Oura metrics, appended on each sync
  ynab/
    spending.csv         # Daily spending totals from YNAB
  screenings/            # PHQ-9 and other questionnaire results
  summaries/             # Reserved for future LLM-generated summaries
```

Check-in files are plain Markdown:

```markdown
# 2026-03-20

**Mood**: 4/5
**Energy**: 3/5

## Notes
Good energy after a solid 7.5h sleep.

---
_Oura: Sleep 7.5h | HRV 50 | Readiness 79_
```

## Connecting Oura

Baseline uses Oura's OAuth 2.0 API (v2).

### Register an OAuth app

1. Go to [cloud.ouraring.com/oauth/apps](https://cloud.ouraring.com/oauth/apps) and create a new app
2. Set the redirect URI(s):
   - **Desktop:** `http://localhost:35791/callback`
   - **Android:** `baseline://oura-auth`
   - You can register both in the same app
3. Copy the **Client ID** and **Client Secret**

### Connect in Baseline

1. Open **Settings → Oura Ring**
2. Paste your Client ID and Client Secret
3. Click **Connect Oura** — your browser will open the Oura authorization page
4. Approve the permissions; the app handles the redirect automatically
5. Once connected, click **Sync now** to pull data

Oura credentials and tokens are stored in `.baseline/config.json` inside your vault. Access tokens are refreshed automatically before they expire.

## Roadmap

- [ ] Master password + AES-256 encryption of config
- [ ] Google Drive sync (desktop ↔ Android)
- [ ] Weekly narrative summaries via [Ollama](https://ollama.com) (local LLM, desktop only)
- [ ] iOS support
