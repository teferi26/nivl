# NIVL 1.0.7 native screenshot harness

This isolated branch renders the actual React Native screens from commit
`7a5e6e13d08076cbc06298d47ccbe329facd26b5` in an iOS Simulator. It is not a
production build, an OTA update, or a web imitation of the interface.

The workflow compiles a Release `.app` with the separate bundle identifier
`com.teferi.nivl.screenshots`. It needs no Expo, Supabase, RevenueCat, Apple, or
review-account credentials. It never signs or submits an application.

`prepare.mjs` checks that `src/`, assets and the dependency lock match the release,
then changes only the runner's entry point and native capture configuration.
With `EXPO_PUBLIC_SCREENSHOT_MODE=1`, Metro replaces Supabase and the RevenueCat
JavaScript SDK with deterministic local adapters. All unknown calls and writes
fail explicitly. The bootstrap rejects fetch, XMLHttpRequest and WebSocket;
Metro also replaces Expo's separate native fetch path with a rejecting adapter,
and the capture build disables Expo Updates. Fixtures use no remote images.
Notifications have an existing permission-denied fixture, preventing native
permission dialogs and scheduled notifications from covering the screenshots.

The example account, friends, mission history, conversations, workouts and money
are entirely fictional. The coach conversation identifies itself as an example
and contains no invented tool execution. The Pro route uses a free-account
scenario to show the existing catalogue; purchase and restore always fail without
opening StoreKit. Nothing here proves or pretends a completed transaction.

The macOS job chooses an available iPhone Pro Max, launches in Spanish and dark
mode, sets its status bar to 9:41 and full battery, then opens real app routes.
PNG files come directly from `xcrun simctl io screenshot` after load/animation
waits. They require human visual review before upload to App Store Connect.
The artifact includes source/harness commits, dimensions, timestamps, simulator
details, SHA-256 hashes and diagnostic logs. Only the reviewed PNGs go into final
App Store compositions; the original screenshots remain preserved.

Dispatch `ios-screenshots.yml` on this branch, or push a change to its capture
files. The workflow has only read repository permissions and uses no secrets.
The fictional simulator app is cached by its source/fixture hash, so changing
only the camera/navigation script does not require compiling again.
