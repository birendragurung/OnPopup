# OnPopup 🌐

OnPopup is a premium, lightweight, cross-platform desktop utility that combines **instant language translation** and **advanced clipboard history management** into a single, beautiful glassmorphic popup drawer.

Designed for maximum productivity, OnPopup is completely keyboard-driven. It lives in your status bar / system tray and appears exactly where you need it, when you need it.

---

## 🎯 Objective

Modern workflows require constant switching between copy-pasting text, translating phrases, and configuring api interfaces. **OnPopup** was built to solve this by providing:
1. **Zero-Friction Access:** Highlighting text anywhere and pressing a hotkey instantly pulls up a translation.
2. **Unified Clipboard & Translation Flow:** Seamlessly selecting previous copies from your history and translating them in one keystroke, or pasting them into another app immediately.
3. **Context Retention:** Explicitly tracking the active background app on macOS so that selecting a clipboard history item automatically focuses back to the target text field and triggers an OS-level paste event.

---

## 🎨 Feature Guide

### 1. Translation & Language Settings
* **Auto-Detect Source:** Type or highlight any language; the system automatically detects the source.
* **Dual Engines:**
  * **Google Translate (Free):** Fast, default out-of-the-box translations.
  * **Gemini AI:** Select Gemini in settings, paste your key, and get high-quality contextual translations.
* **Smart Auto-Swap (Bidirectional Translation):**
  * Define two core languages (e.g., English $\leftrightarrow$ Japanese) in Settings.
  * When enabled, if your input language is English, it translates to Japanese. If your input is Japanese, it automatically translates to English.
  * Includes a simple toggle to enable/disable this feature.
* **Text-to-Speech (TTS):** Click the speaker button to hear translation pronunciation.
* **Window Persistence:** Drag window edges to resize. OnPopup remembers your custom window dimensions for subsequent launches.
* **Quick-Clear:** A fast `(×)` action button inside the input area to wipe text in one click.

#### ⌨️ Translation Shortcuts
| Action | Shortcut |
| :--- | :--- |
| **Summon Translator Popup** | `Option + T` (macOS) / `Alt + T` (Windows/Linux) |
| **Close / Hide Window** | `Escape` |

---

### 2. Clipboard History & Drawer
* **Background Monitoring:** Safely monitors your system clipboard in the background, updating your history drawer list in real-time.
* **Smart Auto-Paste:** Select an item from your history; the app restores focus to your previous frontmost window and automatically executes a native `Cmd + V` (macOS) or `Ctrl + V` paste event.
* **Drawer Switcher UI:** Quickly toggle between the Translator, Clipboard History, and Settings panels from the top bar.
* **Translate from History:** Send any clipboard history item directly into the translator input to convert it to your target language.
* **Fuzzy Search:** Type in the clipboard search field to instantly filter through your copy history.
* **Persisted History:** Copy history is saved securely to disk so it survives system reboots.

#### ⌨️ Clipboard Drawer Shortcuts
| Action | Shortcut |
| :--- | :--- |
| **Summon Clipboard History Drawer** | `Option + V` (macOS) / `Alt + V` (Windows/Linux) |
| **Navigate List** | `Up Arrow` / `Down Arrow` |
| **Paste Selected Item** | `Enter` |
| **Translate Selected Item** | `Shift + Enter` |
| **Quick-Paste Item (1st - 9th)** | `1` to `9` (when clipboard search is empty) |
| **Dismiss Drawer / Close Window** | `Escape` |

---

## 🛠 Developer Guide

### Prerequisites
* **Node.js** (v16.4.0 or higher recommended)
* **npm** (Node package manager)
* **Swift Compiler (`swiftc`)** *(macOS packaging only)*: The app compiles a helper binary (`assets/copy-helper.swift`) on macOS during build time to ensure reliable native paste injection.

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd mac-trans
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### NPM Development Commands
| Command | Purpose |
| :--- | :--- |
| **`npm start`** | Runs the app in development mode with live logs. |
| **`npm run package`** | Bundles the application locally for your target architecture. |
| **`npm run make`** | Generates platform-specific installers (e.g. `.dmg` for macOS, Squirrel for Windows). |

---

## ⚙️ Configuration & Persistent Data

OnPopup stores user data locally in your operating system's standard application support folders:
* **Settings:** `settings.json` contains target languages, selected engines, Gemini keys, window sizes, and auto-swap toggles.
* **Clipboard History:** `clipboard_history.json` houses your cached copies.
* **Troubleshooting Logs:** In developer mode, API errors, timeouts, or payload failures are written to `translation_errors.log`. You can open this file using the log shortcut link in the settings panel.

### Directory Locations
* **macOS:** `~/Library/Application Support/onpopup/`
* **Windows:** `%APPDATA%\onpopup\`
* **Linux:** `~/.config/onpopup/`

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.