# TransPop 🌐

TransPop is a lightweight, cross-platform translation popup desktop utility. Highlight text anywhere on your screen and hit `Option + T` (Mac) or `Alt + T` (Windows/Linux) to instantly translate it.

---

## ✨ Features

- **Instant Popups:** Get rapid translations in a beautiful glassmorphic desktop card that pops up next to your cursor.
- **Resizable Window:** Drag the window edges to resize the utility. It enforces a minimum size of `320x240` to keep the UI clean, and automatically remembers your custom window dimensions for subsequent triggers.
- **Responsive Layout:** Automatically switches layout from vertically stacked to a side-by-side split screen (Source on the left, Translation on the right) when the window is resized wider than `550px`.
- **Text Quick-Clear:** A convenient `(×)` button appears inside the input textarea when text is typed or pasted, allowing you to wipe text and reset translations with a single click.
- **Multi-Engine support:** Choose between the free Google Translate service or configure your own **Gemini AI** key inside the settings for high-quality, long-form content translations.
- **Text-to-Speech (TTS):** Listen to translations read aloud in the target language.
- **Developer Troubleshooting Logs (Dev Mode):** If a translation request fails (e.g., when sending extremely long payloads over the free Google Translate API), detailed logs (timestamp, service, length, payload preview, stack traces) are appended to a log file (`translation_errors.log` in user app data) during development. A shortcut link to open this file is available in the error notification and the settings panel.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd transpop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

---

## 🛠 Usage

### Running in Development

Launch the app locally in development mode:
```bash
npm start
```

### Packaging for Production

To bundle the application into OS-specific installers (e.g., a `.dmg` on macOS, `.exe` on Windows, or `.deb` on Linux), run:
```bash
npm run make
```

---

## ⚙️ Configuration

TransPop is designed to be fully configurable from within the app interface:
1. **Open Settings:** Click the gear/settings icon on the top right of the popup, or click the tray icon and select **Settings...**.
2. **Choose Engine:** Switch between **Google Translate (Free)** and **Gemini AI**.
3. **Gemini Key:** Paste your key from [Google AI Studio](https://aistudio.google.com/) directly into the Settings drawer. 
4. **Target Language:** Select your default translation target language.

Settings are saved persistently in `settings.json` within your system's application data folder.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.