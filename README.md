# Baseline

A local-first wellness dashboard that correlates [Oura](https://ouraring.com) ring data (sleep, HRV, readiness, activity) with daily mood and energy check-ins. All data is stored on your machine as plain Markdown and CSV files — no cloud, no accounts.

## Features

- **Daily check-ins** — log mood (1–5) and energy (1–5) with optional notes, saved as `YYYY-MM-DD.md`
- **Oura sync** — pulls sleep score, sleep hours, HRV, readiness, activity, and steps via the Oura v2 API
- **7-day dashboard** — combined chart of sleep hours and mood, plus today's key metrics at a glance
- **Plain-file vault** — your data lives in a folder you choose; back it up with iCloud, Dropbox, or anything

## Requirements

- [Node.js](https://nodejs.org) 20+
- An [Oura ring](https://ouraring.com) with a Personal Access Token (optional — the app works without one)

## Setup

```bash
git clone <repo>
cd baseline
npm install
```

## Running in development

```bash
npm run dev
```

This launches the Electron app with hot reload. On first run you'll be prompted to choose a vault folder and optionally connect your Oura ring.

## Building a distributable

```bash
npm run dist:mac
```

Produces a `dist/Baseline-*.dmg` you can install like any other macOS app.

## Project structure

```
electron/
  main.ts       # Main process — file I/O, Oura API sync, IPC handlers
  preload.ts    # Exposes window.baseline bridge to renderer

src/renderer/src/
  pages/        # Setup, Dashboard, CheckIn, Settings
  components/   # Nav, chart wrappers
  hooks/        # useDashboard, useConfig, useVault
  lib/          # checkInFormat.ts (Markdown parser), devMock.ts
  types/        # Shared TypeScript types
```

## Vault layout

After setup, your chosen folder will contain:

```
YourVault/
  .baseline/
    config.json          # Oura PAT and settings
  check-ins/
    2026-03-20.md        # One file per day
    2026-03-21.md
    ...
  oura/
    oura.csv             # Daily Oura metrics, appended on each sync
  summaries/             # Reserved for future LLM-generated summaries
```

Check-in files are plain Markdown and look like this:

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

Baseline uses Oura's OAuth 2.0 API (v2). Personal Access Tokens were deprecated by Oura in December 2025.

### Register an OAuth app

1. Go to [cloud.ouraring.com/oauth/apps](https://cloud.ouraring.com/oauth/apps) and create a new app
2. Set the redirect URI to: `http://127.0.0.1`
3. Copy the **Client ID** and **Client Secret**

### Connect in Baseline

1. Open **Settings → Oura Ring**
2. Paste your Client ID and Client Secret
3. Click **Connect Oura** — your browser will open the Oura authorization page
4. Approve the permissions and your browser will redirect back to Baseline automatically
5. Once connected, click **Sync now** to pull data

Oura data is written to `oura/oura.csv`. Your credentials and tokens are stored in `.baseline/config.json` inside your vault. Access tokens are refreshed automatically before they expire.

## Roadmap

- [ ] Master password + AES-256 encryption of config
- [ ] Weekly narrative summaries via [Ollama](https://ollama.com) (local LLM)
- [ ] Native macOS app
