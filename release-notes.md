## What's Changed in v1.1.0

* **Fix macOS Accessibility Permissions**: Solved the issue where OnPopup would not prompt for Accessibility permissions at startup or when using the translation shortcut.
* **Restore Selected Text Translation**: Fixed the failed text copy operation when Accessibility permissions were missing, adding user-friendly setup dialogs.
* **Persistent Permission Identity**: Reverted dynamic app names and bundle IDs to static values (`OnPopup` / `com.onpopup.app`) so macOS TCC remembers the user's permission grants between launches and updates.
* **Build Stability**: Reverted the Node.js environment to version 20 to ensure Electron Forge and DMG builders compile natively and upload DMG files successfully.
