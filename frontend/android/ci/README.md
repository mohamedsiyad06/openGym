# CI debug key

`debug.keystore` signs the APK that `.github/workflows/phone-apk.yml` builds for this fork. It is
a standard Android debug key (store and key password `android`, alias `androiddebugkey`), kept in
the repository so every cloud build is signed the same way and a new APK installs over the last
one without losing data. It is not a secret and must never sign a build for anyone else: the
public releases are signed on the release machine (docs/APP_STORES.md).

Replacing it means uninstalling the app once (Android refuses an update signed with another key),
which deletes the app's data. Export a backup first (Settings → Data).
