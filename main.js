const { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');

let mainWindow = null;
let tray = null;
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const logPath = path.join(app.getPath('userData'), 'translation_errors.log');

// Function to log errors (only in development mode)
function logTranslationError(error, details) {
  if (app.isPackaged) return; // Do not log in production mode

  try {
    const timestamp = new Date().toISOString();
    const divider = '='.repeat(60);
    const logMessage = `
${divider}
TIMESTAMP: ${timestamp}
SERVICE: ${details.service || 'unknown'}
TARGET LANG: ${details.targetLang || 'unknown'}
PAYLOAD LENGTH: ${details.payloadLength || 0} characters
PAYLOAD PREVIEW:
${details.payloadPreview || 'N/A'}
ERROR MESSAGE: ${error.message || error}
ERROR STATUS: ${error.status || 'N/A'}
RESPONSE BODY: ${error.responseBody || 'N/A'}
ERROR STACK:
${error.stack || 'N/A'}
${divider}
`;
    fs.appendFileSync(logPath, logMessage, 'utf8');
    console.log(`Error logged to: ${logPath}`);
  } catch (err) {
    console.error('Failed to write to translation error log file:', err);
  }
}

// Default Settings
let settings = {
  service: 'google',
  geminiKey: '',
  targetLang: 'en'
};

// Load settings on startup
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      settings = { ...settings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Save settings to disk
function saveSettings(newSettings) {
  try {
    settings = { ...settings, ...newSettings };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

function createWindow() {
  // Check if window already exists
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: settings.width || 440,
    height: settings.height || 340,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 320,
    minHeight: 240,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');

  // Save bounds to settings
  function saveWindowBounds() {
    if (!mainWindow) return;
    const [width, height] = mainWindow.getSize();
    saveSettings({ width, height });
  }

  // Hide the window when it loses focus (blur) and save bounds
  mainWindow.on('blur', () => {
    saveWindowBounds();
    mainWindow.hide();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Position the window near the current cursor location and clamp inside viewport
function positionWindowNearCursor() {
  if (!mainWindow) return;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const bounds = display.bounds;

  const winSize = mainWindow.getSize();
  const winWidth = winSize[0];
  const winHeight = winSize[1];

  // Position: centered horizontally relative to cursor, and slightly below it
  let x = cursor.x - Math.round(winWidth / 2);
  let y = cursor.y + 15;

  // Clamp horizontally
  if (x < bounds.x) {
    x = bounds.x + 10;
  } else if (x + winWidth > bounds.x + bounds.width) {
    x = bounds.x + bounds.width - winWidth - 10;
  }

  // Clamp vertically (if it goes off the bottom, display it above the cursor)
  if (y + winHeight > bounds.y + bounds.height) {
    y = cursor.y - winHeight - 15;
  }
  // Make sure it doesn't go off the top either
  if (y < bounds.y) {
    y = bounds.y + 10;
  }

  mainWindow.setPosition(x, y);
}

// Position the window near the system tray icon
function positionWindowNearTray() {
  if (!mainWindow || !tray) return;

  const trayBounds = tray.getBounds();
  const winSize = mainWindow.getSize();
  const winWidth = winSize[0];
  const winHeight = winSize[1];

  // Center horizontally under the tray icon
  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (winWidth / 2));
  // Position slightly below the tray icon
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  // Clamp inside display bounds
  const display = screen.getDisplayNearestPoint({ x, y });
  const bounds = display.bounds;

  if (x < bounds.x) {
    x = bounds.x + 10;
  } else if (x + winWidth > bounds.x + bounds.width) {
    x = bounds.x + bounds.width - winWidth - 10;
  }

  // If the tray is at the bottom (Windows/Linux taskbars), position above it
  if (y + winHeight > bounds.y + bounds.height) {
    y = Math.round(trayBounds.y - winHeight - 4);
  }

  mainWindow.setPosition(x, y);
}

// Toggle window visibility near the tray icon
function toggleWindowNearTray() {
  if (!mainWindow) {
    createWindow();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    positionWindowNearTray();
    mainWindow.show();
    mainWindow.focus();
  }
}

// Set up the menu bar / system tray icon
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  if (!fs.existsSync(iconPath)) {
    console.error('Tray icon not found at:', iconPath);
    return;
  }

  // Load image
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Resize the icon dynamically to 22x22 to fit perfectly in the macOS status bar
    trayIcon = trayIcon.resize({ width: 22, height: 22 });
  } catch (err) {
    console.error('Failed to load tray icon:', err);
    return;
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('TransPop - Quick Translator');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Translator', accelerator: 'Option+T', click: () => triggerTranslation() },
    {
      label: 'Settings...',
      click: () => {
        if (!mainWindow) {
          createWindow();
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('open-settings');
          });
        } else {
          mainWindow.webContents.send('open-settings');
        }
        positionWindowNearTray();
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    { label: 'Quit TransPop', click: () => app.quit() }
  ]);

  // Toggle window on left click
  tray.on('click', () => {
    toggleWindowNearTray();
  });

  // Show context menu on right click
  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });
}

// Function to simulate copying currently highlighted text to clipboard
async function getSelectedText() {
  const originalText = clipboard.readText();
  const originalHtml = clipboard.readHTML();

  // Clear clipboard so we can reliably detect when copy completes
  clipboard.clear();

  // Wait 150ms to allow the user to release the physical hotkeys (Option/Alt), preventing modifier collision (e.g. Option+Cmd+C)
  await new Promise(resolve => setTimeout(resolve, 150));

  // Trigger copy shortcut based on OS
  if (process.platform === 'darwin') {
    const { execSync } = require('child_process');
    // Short wait to ensure application focus
    await new Promise(resolve => setTimeout(resolve, 100));
    // Use System Events to send Cmd+C
    try {
      execSync(`osascript -e 'tell application "System Events" to keystroke "c" using {command down}'`);
    } catch (asErr) {
      console.error('AppleScript copy failed:', asErr);
    }
    // Small pause to ensure clipboard is updated
    await new Promise(resolve => setTimeout(resolve, 300));
  } else if (process.platform === 'win32') {
    // Windows: Create a temp VBScript for instantaneous keypress simulation (faster than PowerShell)
    try {
      const vbsPath = path.join(app.getPath('temp'), 'copy.vbs');
      fs.writeFileSync(vbsPath, 'Set wshShell = CreateObject("WScript.Shell")\nwshShell.SendKeys "^c"', 'utf8');
      const { exec } = require('child_process');
      exec(`wscript.exe "${vbsPath}"`);
    } catch (err) {
      // Fallback to powershell if VBScript fails
      exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`);
    }
  } else {
    // Linux: xdotool
    const { exec } = require('child_process');
    exec('xdotool key ctrl+c');
  }

  // Wait for the copy operation to complete (up to 600ms)
  let copiedText = '';
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    copiedText = clipboard.readText();
    if (copiedText && copiedText.trim() !== '') {
      break;
    }
  }

  // Restore the original clipboard state so we don't pollute user's copy history
  if (originalText) {
    clipboard.write({
      text: originalText,
      html: originalHtml
    });
  } else {
    clipboard.clear();
  }

  return copiedText ? copiedText.trim() : '';
}

// Trigger the translation flow
async function triggerTranslation() {
  // 1. Get the selected text FIRST, while the target window is still focused
  const selectedText = await getSelectedText();

  // 2. Ensure window is created
  if (!mainWindow) {
    createWindow();
    // Wait for the window to load if it was just created
    await new Promise(resolve => {
      mainWindow.webContents.once('did-finish-load', resolve);
    });
  }

  // 3. Position window near the cursor
  positionWindowNearCursor();

  // 4. Show and focus the window
  mainWindow.show();
  mainWindow.focus();

  // 5. Send the captured text to renderer
  mainWindow.webContents.send('translate-text', selectedText);
}

// Register global keyboard shortcut
function registerShortcut() {
  const shortcut = process.platform === 'darwin' ? 'Option+T' : 'Alt+T';

  try {
    globalShortcut.unregisterAll();
    const registered = globalShortcut.register(shortcut, () => {
      triggerTranslation();
    });

    if (!registered) {
      console.error(`Shortcut registration failed for ${shortcut}`);
    }
  } catch (err) {
    console.error('Error registering shortcut:', err);
  }
}

// App Lifecycle
app.whenReady().then(() => {
  // Hide Dock icon on macOS so it runs purely as a menu bar app
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  loadSettings();
  createWindow();
  registerShortcut();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Communications
ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('get-settings', () => {
  return { ...settings, isDev: !app.isPackaged };
});

ipcMain.handle('save-settings', (event, newSettings) => {
  return saveSettings(newSettings);
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('open-log-file', async () => {
  if (app.isPackaged) return false;
  try {
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `--- TransPop Error Log initialized at ${new Date().toISOString()} ---\n`, 'utf8');
    }
    await shell.openPath(logPath);
    return true;
  } catch (err) {
    console.error('Failed to open log file:', err);
    return false;
  }
});

// Translation Engine Fetching (handled in main to avoid CORS & hide secrets)
ipcMain.handle('translate-api', async (event, { text, service, targetLang, apiKey }) => {
  if (!text || text.trim() === '') return '';

  const payloadLength = text.length;
  const payloadPreview = text.slice(0, 500) + (text.length > 500 ? '...' : '');

  try {
    if (service === 'gemini') {
      if (!apiKey) {
        throw new Error('Gemini API key is required. Please set it in Settings.');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate the following text into the language with code '${targetLang}'. Return ONLY the direct translation. Do not wrap in quotes or add any conversational intro, outro, markdown formatting or explanation. Keep line breaks intact. Text to translate:\n\n${text}`
            }]
          }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMessage = errData.error?.message || `Gemini API returned status ${response.status}`;
        const error = new Error(errMessage);
        error.status = response.status;
        error.responseBody = JSON.stringify(errData);
        throw error;
      }

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!result) throw new Error('Invalid response structure from Gemini API');
      return result.trim();
    } else {
      // Google Translate Free Mirror API
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error(`Google Translate API returned status ${response.status}`);
        error.status = response.status;
        try {
          error.responseBody = await response.text();
        } catch (_) {}
        throw error;
      }

      const data = await response.json();
      if (!data || !data[0]) {
        throw new Error('Invalid response structure from Google Translate');
      }

      const translated = data[0].map(sentence => sentence[0]).join('');
      return translated;
    }
  } catch (error) {
    // Log details only in development
    logTranslationError(error, {
      service,
      targetLang,
      payloadLength,
      payloadPreview
    });
    throw error;
  }
});
