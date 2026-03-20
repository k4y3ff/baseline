# Privacy Policy

**App:** Baseline
**Last updated:** March 20, 2026

---

## Overview

Baseline is a local-first wellness application. Your data is stored exclusively on your own device, in a folder you choose. Baseline does not operate any servers, does not collect analytics, and does not transmit your personal data to any third party — with the limited exception of the Oura API, which is described below.

---

## Data We Collect

Baseline does not collect data. All information you enter into the app — daily check-ins, mood and energy scores, notes — is written directly to files on your computer and never leaves your device unless you choose to back them up yourself.

---

## Data Stored Locally

The following data is stored in the vault folder you designate on your computer:

| File | Contents |
|---|---|
| `check-ins/YYYY-MM-DD.md` | Mood score, energy score, and optional notes you enter |
| `oura/oura.csv` | Sleep, HRV, readiness, and activity metrics retrieved from the Oura API |
| `.baseline/config.json` | Your Oura OAuth credentials (Client ID, Client Secret, access token, refresh token) |

No data is transmitted to Baseline or any service operated by Baseline.

---

## Oura API Integration

If you choose to connect your Oura ring, Baseline will:

1. Redirect you to Oura's authorization page at `cloud.ouraring.com` to complete an OAuth 2.0 login flow. This interaction is between you and Oura directly.
2. Start a temporary local HTTP server on `127.0.0.1` to receive Oura's redirect after you approve. This server exists only for the duration of the login flow and accepts no connections from outside your machine.
3. Receive an access token and refresh token from Oura upon your approval, and store them in `.baseline/config.json` on your device.
3. Use those tokens to make read-only requests to the [Oura v2 API](https://cloud.ouraring.com/docs) to retrieve your daily sleep, readiness, HRV, and activity data.
4. Write the retrieved data to `oura/oura.csv` on your device.

Baseline requests only the `daily` scope, which covers daily summaries. No other Oura data is accessed.

Your Oura credentials are stored in plaintext in `config.json` inside your vault. We recommend using a vault folder covered by your operating system's disk encryption (e.g., macOS FileVault). Future versions of Baseline will encrypt this file with a master password.

Oura's own privacy practices are governed by the [Oura Privacy Policy](https://ouraring.com/privacy-policy).

---

## Third-Party Services

Baseline does not integrate with any analytics, advertising, crash reporting, or cloud storage services. The only external network requests made by the app are the OAuth token exchange and data sync calls to `api.ouraring.com`, described above.

---

## Data Retention and Deletion

Because all data is stored locally, you are in full control of retention and deletion. To remove your data, delete the files in your vault folder. To revoke Oura access, use the Disconnect button in Settings or revoke the token directly in your [Oura account settings](https://cloud.ouraring.com/oauth/apps).

---

## Children's Privacy

Baseline is not directed at children under 13 and does not knowingly collect information from children.

---

## Changes to This Policy

If this policy changes in a meaningful way, the updated version will be included with the app and the "Last updated" date above will be revised.

---

## Contact

If you have questions about this privacy policy, please open an issue in the project repository.
