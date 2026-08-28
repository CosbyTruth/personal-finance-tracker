# Kora Money Mobile

Expo/React Native client for Kora Money. The first slice includes secure sign-in, light and dark themes, a dashboard, accounts, transaction activity, and monthly budget visibility.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the deployed Kora HTTPS URL when testing on a physical phone.
3. From the repository root, run `npm run mobile:start`.
4. Scan the QR code with Expo Go, or press `a` for an Android emulator.

`localhost` works for iOS Simulator. Android Emulator automatically uses `10.0.2.2` when the environment variable is omitted. A physical phone cannot reach the computer through `localhost`; use the deployed API or your computer's LAN IP.

The existing `android/` Capacitor project remains untouched while this Expo client is developed and validated.
