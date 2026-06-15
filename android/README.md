# Silverwolf — Android app

A thin **Jetpack Compose + WebView** wrapper around the live Silverwolf site
(`https://bot.silverwolf.dev`). Online pages and games are served straight from
the server; a small **offline hub** (a handful of self-contained games) is
bundled in the APK and shown when the device is offline or the server can't be
reached.

> Client only. This app is **not** part of the server Docker image or its
> deploy — it's excluded via the repo's `.dockerignore` and `deploy.yml`
> `paths-ignore`, so changes here never trigger a website redeploy.

## Prerequisites

- **JDK 17** — the build pins a Java 17 toolchain. macOS/Homebrew:
  `brew install openjdk@17` then `export JAVA_HOME=/opt/homebrew/opt/openjdk@17`.
- **Android SDK** (compileSdk 36, minSdk 26). Easiest to get via Android Studio;
  it usually installs to `~/Library/Android/sdk` →
  `export ANDROID_HOME=$HOME/Library/Android/sdk`.
- An emulator (AVD) or a physical device with USB debugging enabled.

CLI commands below assume `JAVA_HOME`, `ANDROID_HOME`, and both
`$ANDROID_HOME/platform-tools` (adb) and `$ANDROID_HOME/emulator` are on your
`PATH`. Or just open this `android/` folder in **Android Studio** and press
**Run** — it handles all of the above.

## Run (debug)

```bash
# from android/
emulator -avd medium_phone &     # or plug in a device
./gradlew installDebug           # build + install the debug APK
adb shell monkey -p com.example.silverwolf -c android.intent.category.LAUNCHER 1
```

The app defaults to production. Tap the **gear** (top-right) to change the
**server URL** or toggle **Force Offline**:

- To test a local Hono dev server (`bun run dev`, port 6769) from an emulator,
  set the URL to `http://10.0.2.2:6769` (`10.0.2.2` is the host machine; cleartext
  HTTP is allowed).
- **Force Offline Mode** loads the bundled offline hub directly.

## Debug

- **Logs:** `adb logcat`. WebView `console.*` and JS errors appear under the
  `chromium` tag (e.g. `adb logcat | grep -i chromium`).
- **DevTools:** debug builds enable WebView inspection — open `chrome://inspect`
  in desktop Chrome and pick the device to get full DevTools on the page.
- **Offline assets** live in `app/src/main/assets/offline/` (hub `index.html`,
  shared `styles.css`, per-game pages under `games/`). Edit and re-run
  `installDebug` to iterate.
- If a remote load fails while the device is online (server down, DNS, timeout),
  the app falls back to the offline hub instead of Chrome's "Webpage not
  available" page. **Refresh** (top bar) retries the server.

## Build for production

Bump `versionCode` / `versionName` in `app/build.gradle.kts`, then:

```bash
./gradlew assembleRelease   # APK -> app/build/outputs/apk/release/app-release-unsigned.apk
# or, for the Play Store:
./gradlew bundleRelease      # AAB -> app/build/outputs/bundle/release/
```

The release artifact is **unsigned** — no signing config is committed. Sign it
before distributing: use `apksigner`, add a `signingConfigs` block to
`app/build.gradle.kts`, or use Android Studio's
**Build → Generate Signed Bundle / APK**. Code minification (R8) is currently
off.
