# Mobile App Roadmap — after Milestone 10

The mobile app will use Capacitor 8 so the existing React/Vite UI can be reused on Android and iOS.

## Why deployment comes first

The native app needs a stable HTTPS backend. Netlify Functions + Neon will provide that API.

## Mobile Milestone 11A — Shared mobile foundation

- Add Capacitor 8 to the existing React/Vite project.
- Configure app ID and app name.
- Add Android and iOS projects.
- Change frontend API configuration so native builds call the deployed Netlify API URL.
- Add CORS for approved native origins.
- Add a mobile authentication mode using Authorization Bearer tokens while retaining HttpOnly-cookie auth for the web app.
- Store mobile credentials/tokens using an appropriate secure native storage mechanism.
- Add app icons and splash screen.
- Add network-state handling and loading/error states.

## Milestone 11B — Android

- Install Android Studio and required SDK.
- Build and run on emulator.
- Test on a physical Android phone.
- Generate signed Android App Bundle/APK when ready.

## Milestone 11C — iOS

- Requires macOS and Xcode for normal local development/signing.
- Build and test on iPhone/simulator.
- Prepare App Store signing when ready.

## Important

The native app will not maintain a second finance database. Web and mobile will use the same Netlify API and Neon PostgreSQL data.
