# AI File Manager Android

Native Android implementation of the AI File Manager file explorer. This app uses the device filesystem as the source of truth and does not route local file browsing or file operations through the repo backend.

## Build a Debug APK

```bash
cd artifacts/android-app
./gradlew :app:assembleDebug
```

APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Storage Access

For Android 11 and newer, the app requests whole-device file manager access through Android settings using `MANAGE_EXTERNAL_STORAGE`. If access is denied, the app shows a permission status screen and does not repeatedly prompt.

For older Android versions, the manifest includes legacy external storage permissions.

## Local Safety Model

Destructive and structural operations are executed through the native transaction layer. The app creates an app-private snapshot under `context.filesDir/transaction-snapshots` before applying rename, move, copy, create, or delete actions. Completed transactions can be reverted from the Action Log when a snapshot is available.
