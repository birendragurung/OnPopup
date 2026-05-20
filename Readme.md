# Transpop 🌐

Cross-platform translation popup desktop utility that captures clipboard text and OCR (Optical Character Recognition) data for instant translations.

---

## ✨ Features

*   **Popup Translations:** Get instant translations in a lightweight, native-feeling desktop popup.
*   **OCR Support:** Extract and translate text from images, screenshots, or un-copyable UI elements.
*   **Clipboard Monitoring:** Automatically capture or trigger translations from your clipboard.
*   **Cross-Platform:** Built with Electron, supporting macOS, Windows, and Linux out of the box.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd transpop
   npm install
   ```

## 🛠 Usage

### Development

Run the app in development mode:
```bash
npm start
```

To bundle the application into OS-specific distributables (like .dmg or .exe), run:
```bash
npm run make
```

### Configuration

Create a `.env` file in the project root to store your API keys:

```bash
GOOGLE_API_KEY=your-google-api-key
GEMINI_API_KEY=your-gemini-api-key
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.