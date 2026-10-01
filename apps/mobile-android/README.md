# HydiEdge Mobile Companion (Android Native)

Official Native Android Companion Application for the **HydiEdge Workforce Management & Productivity Suite**.

## Architecture & Features

- **Telephony & Call Logs (`TelephonyCallReceiver.kt`)**: Intercepts native incoming, outgoing, and missed calls with contact resolution, call duration, and auto-spooling.
- **Screen Time & Application Usage (`ScreenTimeTracker.kt`)**: Leverages `UsageStatsManager` to aggregate daily foreground app usage into Productive, Neutral, and Non-Productive time categories.
- **GPS Breadcrumb Tracking (`GpsBreadcrumbService.kt`)**: High-accuracy foreground location service logging latitude, longitude, speed, battery percentage, and mock-location detection.
- **Periodic & Triggered Batch Sync (`BatchSyncWorker.kt`)**: WorkManager job batching calls, screen time, contacts, and GPS breadcrumbs to `POST /api/v1/mobile/telephony-batch` on `https://api.hydiedge.com`.
- **Jetpack Compose Modern UI (`MainActivity.kt`)**: Modern Material 3 dashboard displaying active status, telephony statistics, screen time category breakdown, GPS status, and manual "Sync Now" trigger.

## Prerequisites

- Android Studio Koala / Ladybug or newer
- Android SDK 35 (Android 15) with minimum SDK 26 (Android 8.0 Oreo)
- Java 17 / JDK 17
- Gradle 8.7+

## Build & Release Instructions

### Debug Build
```bash
./gradlew assembleDebug
```
Output APK: `app/build/outputs/apk/debug/app-debug.apk`

### Production Release Build
```bash
./gradlew assembleRelease
```
Output APK: `app/build/outputs/apk/release/app-release.apk`

## Production API Target
- **Endpoint**: `https://api.hydiedge.com/api/v1/mobile/telephony-batch`
- **Authentication**: Bearer Token or Device Key stored securely in Android EncryptedSharedPreferences.
