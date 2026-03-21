# Baseline

A local-first wellness dashboard that correlates [Oura](https://ouraring.com) ring data (sleep, HRV, readiness, activity) with daily mood and energy check-ins. All data is stored on your device as plain Markdown and CSV files — no cloud, no accounts.

Available on **macOS** (Electron).

## Features

- **Daily check-ins** — log mood (1–5) and energy (1–5) with optional notes; optional fields: weight, medication, menstrual flow, and nutrition (calories + macros)
- **Oura sync** — pulls sleep score, sleep hours, HRV, readiness, activity, and steps via the Oura v2 API
- **YNAB sync** — tracks daily spending from your YNAB budget
- **Dashboard** — today's key metrics, check-in CTA, screening reminders, and optional AI readiness summary
- **Analyze** — compare any two variables over 7 days–1 year; optional AI data chat powered by Ollama
- **Screenings** — PHQ-9 (extensible to other questionnaires) with configurable frequency reminders
- **Prepare tab** — clinician preparation tool: save snippets from check-ins and charts, create appointments, and drag-and-drop snippets onto appointment cards
- **History** — 14-day log of check-ins (clickable to edit) and past screening results
- **Plain-file vault** — your data lives in files you control; back it up with iCloud, Dropbox, or anything
- **Local AI (optional)** — health warnings and narrative summaries via a local [Ollama](https://ollama.com) server

## Requirements

- [Node.js](https://nodejs.org) 20+
- An [Oura ring](https://ouraring.com) (optional — the app works without one)

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

## Project structure

```
electron/
  main.ts       # Main process — file I/O, Oura API sync, IPC handlers
  preload.ts    # Exposes window.baseline bridge to renderer

src/renderer/src/
  pages/        # Setup, Dashboard, CheckIn, Analyze, History, Prepare, Screening, Settings
  components/   # Nav, chart wrappers
  hooks/        # useDashboard, useConfig, useVault
  lib/
    baseline.ts           # Platform bridge installer (runs at boot)
    devMock.ts            # Browser dev preview mock
    checkInFormat.ts      # Markdown serialiser/parser
  types/        # Shared TypeScript types
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
2. Set the redirect URI to `http://localhost:35791/callback`
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
- [x] Weekly narrative summaries via [Ollama](https://ollama.com) (local LLM, desktop only)
- [ ] iOS support
