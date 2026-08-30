# Kora Money Mobile

Expo/React Native client for Kora Money. It uses the same Express API, PostgreSQL data and append-only double-entry ledger as the web application.

## Mobile feature coverage

- Secure bearer-token registration, sign-in and sign-out with encrypted device storage.
- Automatic light/dark themes, accessible contrast, app icon and splash screen.
- Account balances, account editing, archive and restore.
- Income, expenses and transfers with filters, corrections and ledger-safe reversals.
- Monthly budgets with create, edit and delete controls.
- Savings goals, contribution/withdrawal history, editing and archive/restore.
- Recurring income and bills with forecasts, posting, skipping, pause/resume and safe deletion.
- Ledger-derived insights, date-range reports and protected CSV sharing.
- Financial alerts, per-user seen state and opt-in private daily device reminders.
- Custom income and expense category management.

## Run locally

1. Copy `.env.example` to `.env` and leave `EXPO_PUBLIC_API_URL` empty for local Wi-Fi development.
2. From the repository root, run `npm run dev:server`; the API starts on port `5010`.
3. In another terminal, run `npm run mobile:start`.
4. Keep the phone and computer on the same Wi-Fi, then scan the QR code with Expo Go.

When the environment variable is empty, Kora discovers the computer address from Expo and uses port `5010`. A physical phone cannot reach the computer through `localhost`.

For remote testing or a release build, set `EXPO_PUBLIC_API_URL` to the deployed HTTPS API origin. Add the production mobile origins required by your hosting setup to `APP_ORIGINS` on the API.

## Validate before release

From the repository root:

```text
npm run check
npm run mobile:check
npm run mobile:export:android
```

Test registration, sign-in, transaction creation/correction, account archive/restore, recurring posting, CSV sharing and notification permission on a physical Android phone.

## Build profiles

`eas.json` contains three profiles:

- `development` for a development client.
- `preview` for an internally shared Android APK.
- `production` for store-ready builds with remote version increments.

Before the first EAS build, authenticate with Expo, run `eas build:configure` if the project is not yet linked to an Expo project, and set `EXPO_PUBLIC_API_URL` in the selected EAS environment. Never commit a production secret or database URL to the mobile application.

The existing `android/` Capacitor project remains untouched while the Expo client is developed and validated.

## Use the Kora development build on Android

Expo Go is useful for quick interface checks, but Android notification support and final native behavior must be tested in Kora's own development client.

1. Sign in to Expo from a terminal with `npx eas-cli@latest login`.
2. From the repository root, run `npm run mobile:build:development:android`.
3. Open the EAS build link when it completes and install the APK on the Android phone.
4. Start the API with `npm run dev:server`.
5. Start Metro for the installed Kora client with `npm run mobile:start:dev-client`.

JavaScript and TypeScript edits can then be reloaded without rebuilding the APK. Rebuild only after installing or updating a native dependency, changing native app configuration, or upgrading Expo SDK.
