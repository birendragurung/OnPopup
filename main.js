const { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');

let mainWindow = null;
let tray = null;
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const logPath = path.join(app.getPath('userData'), 'translation_errors.log');

// Clipboard History State
let clipboardHistory = [];
const historyPath = path.join(app.getPath('userData'), 'clipboard_history.json');
let isInternalClipboardChange = false;
let lastClipboardText = '';
let lastActiveApp = null;

// Capture the currently active application name on macOS
function updateLastActiveApp() {
  try {
    const activeApp = execSync(`osascript -e 'tell application "System Events" to name of first application process whose frontmost is true'`).toString().trim();
    const ignoredApps = ['OnPopup', 'onpopup', 'TransPop', 'transpop', 'Electron', 'System Events', 'SystemUIServer', 'loginwindow'];
    if (activeApp && !ignoredApps.includes(activeApp)) {
      lastActiveApp = activeApp.replace(/"/g, '');
    }
  } catch (err) {
    console.error('Failed to get active app:', err);
  }
}

// Load clipboard history on startup
function loadClipboardHistory() {
  try {
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf8');
      clipboardHistory = JSON.parse(data);
      if (!Array.isArray(clipboardHistory)) {
        clipboardHistory = [];
      }
    }
  } catch (err) {
    console.error('Failed to load clipboard history:', err);
  }
}

// Save clipboard history to disk
function saveClipboardHistory() {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(clipboardHistory, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save clipboard history:', err);
  }
}

// Add an item to history
function addToClipboardHistory(text) {
  if (!text || text.trim() === '') return;
  text = text.trim();

  // Move to top if already exists
  const index = clipboardHistory.indexOf(text);
  if (index !== -1) {
    clipboardHistory.splice(index, 1);
  }

  clipboardHistory.unshift(text);

  // Keep last 50 items
  if (clipboardHistory.length > 50) {
    clipboardHistory = clipboardHistory.slice(0, 50);
  }

  saveClipboardHistory();

  // Send update to renderer if window exists
  if (mainWindow) {
    mainWindow.webContents.send('clipboard-history-updated', clipboardHistory);
  }
}

// Clipboard watcher interval
function startClipboardPoller() {
  lastClipboardText = clipboard.readText();
  setInterval(() => {
    if (isInternalClipboardChange) return;
    try {
      const currentText = clipboard.readText();
      if (currentText && currentText.trim() !== '' && currentText !== lastClipboardText) {
        lastClipboardText = currentText;
        addToClipboardHistory(currentText);
      }
    } catch (err) {
      console.error('Clipboard polling error:', err);
    }
  }, 500);
}

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
  targetLang: 'en',
  autoSwapEnabled: false,
  autoSwapLangA: 'en',
  autoSwapLangB: 'ja'
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
    minWidth: 350,
    minHeight: 260,
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
    if (process.platform === 'darwin') {
      updateLastActiveApp();
    }
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
  tray.setToolTip('OnPopup - Quick Translator');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Translator', accelerator: 'Option+T', click: () => triggerTranslation() },
    { label: 'Clipboard History', accelerator: 'Option+V', click: () => triggerClipboardHistory() },
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
    { label: 'Quit OnPopup', click: () => app.quit() }
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
  isInternalClipboardChange = true;
  try {
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
  } finally {
    isInternalClipboardChange = false;
    lastClipboardText = clipboard.readText();
  }
}

// Trigger the translation flow
async function triggerTranslation() {
  if (process.platform === 'darwin') {
    updateLastActiveApp();
  }

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

// Register global keyboard shortcuts
function registerShortcuts() {
  const translateShortcut = process.platform === 'darwin' ? 'Option+T' : 'Alt+T';
  const clipboardShortcut = process.platform === 'darwin' ? 'Option+V' : 'Alt+V';

  try {
    globalShortcut.unregisterAll();

    // Register translation shortcut
    const transRegistered = globalShortcut.register(translateShortcut, () => {
      triggerTranslation();
    });
    if (!transRegistered) {
      console.error(`Shortcut registration failed for ${translateShortcut}`);
    }

    // Register clipboard history shortcut
    const clipRegistered = globalShortcut.register(clipboardShortcut, () => {
      triggerClipboardHistory();
    });
    if (!clipRegistered) {
      console.error(`Shortcut registration failed for ${clipboardShortcut}`);
    }
  } catch (err) {
    console.error('Error registering shortcuts:', err);
  }
}

// Trigger the clipboard history drawer
async function triggerClipboardHistory() {
  if (process.platform === 'darwin') {
    updateLastActiveApp();
  }

  // Ensure window is created
  if (!mainWindow) {
    createWindow();
    // Wait for the window to load if it was just created
    await new Promise(resolve => {
      mainWindow.webContents.once('did-finish-load', resolve);
    });
  }

  // Position window near the cursor
  positionWindowNearCursor();

  // Show and focus the window
  mainWindow.show();
  mainWindow.focus();

  // Send the current clipboard history to renderer
  mainWindow.webContents.send('show-clipboard-history', clipboardHistory);
}

// App Lifecycle
app.whenReady().then(() => {
  // Hide Dock icon on macOS so it runs purely as a menu bar app
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  loadSettings();
  loadClipboardHistory();
  createWindow();
  registerShortcuts();
  createTray();
  startClipboardPoller();

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
      fs.writeFileSync(logPath, `--- OnPopup Error Log initialized at ${new Date().toISOString()} ---\n`, 'utf8');
    }
    await shell.openPath(logPath);
    return true;
  } catch (err) {
    console.error('Failed to open log file:', err);
    return false;
  }
});

// Clipboard History IPC Handlers
ipcMain.handle('get-clipboard-history', () => {
  return clipboardHistory;
});

ipcMain.handle('clear-clipboard-history', () => {
  clipboardHistory = [];
  saveClipboardHistory();
  return true;
});

ipcMain.handle('paste-clipboard-item', async (event, text) => {
  if (!text) return false;

  isInternalClipboardChange = true;
  try {
    clipboard.writeText(text);
    // Explicitly update history order
    addToClipboardHistory(text);
    lastClipboardText = text;
  } finally {
    isInternalClipboardChange = false;
  }

  if (mainWindow) {
    mainWindow.hide();
  }

  await simulatePaste();
  return true;
});

async function simulatePaste() {
  // Wait 150ms to allow the previous window to focus
  await new Promise(resolve => setTimeout(resolve, 150));

  if (process.platform === 'darwin') {
    try {
      if (lastActiveApp) {
        // Bring target app to front and trigger cmd+v
        const appleScript = `
          tell application "${lastActiveApp}" to activate
          delay 0.1
          tell application "System Events" to keystroke "v" using {command down}
        `;
        execSync(`osascript -e '${appleScript}'`);
      } else {
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`);
      }
    } catch (err) {
      console.error('AppleScript paste failed:', err);
    }
  } else if (process.platform === 'win32') {
    try {
      const vbsPath = path.join(app.getPath('temp'), 'paste.vbs');
      fs.writeFileSync(vbsPath, 'Set wshShell = CreateObject("WScript.Shell")\nwshShell.SendKeys "^v"', 'utf8');
      const { exec } = require('child_process');
      exec(`wscript.exe "${vbsPath}"`);
    } catch (err) {
      exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`);
    }
  } else {
    const { exec } = require('child_process');
    exec('xdotool key ctrl+v');
  }
}

// Determine target language based on script-detection heuristic for Auto-Swap
function determineTargetLanguage(text) {
  const langA = settings.autoSwapLangA || 'en';
  const langB = settings.autoSwapLangB || 'ja';

  // Script detection ranges
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
  const hasRussian = /[\u0400-\u04ff]/.test(text);
  const hasHindi = /[\u0900-\u097f]/.test(text);
  const hasArabic = /[\u0600-\u06ff]/.test(text);
  const hasChinese = /[\u4e00-\u9fff]/.test(text) && !hasJapanese;

  // Swap check logic
  if (langA === 'ja' || langB === 'ja') {
    const otherLang = langA === 'ja' ? langB : langA;
    return hasJapanese ? otherLang : 'ja';
  }
  if (langA === 'ru' || langB === 'ru') {
    const otherLang = langA === 'ru' ? langB : langA;
    return hasRussian ? otherLang : 'ru';
  }
  if (langA === 'hi' || langB === 'hi') {
    const otherLang = langA === 'hi' ? langB : langA;
    return hasHindi ? otherLang : 'hi';
  }
  if (langA === 'ar' || langB === 'ar') {
    const otherLang = langA === 'ar' ? langB : langA;
    return hasArabic ? otherLang : 'ar';
  }
  if (langA === 'zh' || langB === 'zh') {
    const otherLang = langA === 'zh' ? langB : langA;
    return hasChinese ? otherLang : 'zh';
  }

  // Fallback to Language B for same-script pairs
  return langB;
}

// Translation Engine Fetching (handled in main to avoid CORS & hide secrets)
ipcMain.handle('translate-api', async (event, { text, service, targetLang, apiKey }) => {
  if (!text || text.trim() === '') return '';

  const payloadLength = text.length;
  const payloadPreview = text.slice(0, 500) + (text.length > 500 ? '...' : '');

  try {
    let actualTargetLang = targetLang;
    let isAutoSwapped = false;

    if (settings.autoSwapEnabled) {
      actualTargetLang = determineTargetLanguage(text);
      isAutoSwapped = true;
    }

    const runTranslation = async (targetL) => {
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
                text: `Translate the following text into the language with code '${targetL}'. Return ONLY the direct translation. Do not wrap in quotes or add any conversational intro, outro, markdown formatting or explanation. Keep line breaks intact. Text to translate:\n\n${text}`
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
        return { translation: result.trim(), detectedLang: null };
      } else {
        // Google Translate Free Mirror API
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetL}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);
        if (!response.ok) {
          const error = new Error(`Google Translate API returned status ${response.status}`);
          error.status = response.status;
          try {
            error.responseBody = await response.text();
          } catch (_) { }
          throw error;
        }

        const data = await response.json();
        if (!data || !data[0]) {
          throw new Error('Invalid response structure from Google Translate');
        }

        const translated = data[0].map(sentence => sentence[0]).join('');
        const detectedLang = data[2];
        return { translation: translated, detectedLang: detectedLang };
      }
    };

    let result = await runTranslation(actualTargetLang);

    // If same-script Auto-Swap is active (e.g. en <-> es) and the source language matches the translated target,
    // we run it again using the opposite target language.
    // If Auto-Swap is active and the detected source language matches the target language,
    // it means the input text was already in the target language (e.g. we translated Spanish to Spanish).
    // In this case, we swap the target to the alternate language and run it again.
    if (isAutoSwapped && service === 'google') {
      const langA = settings.autoSwapLangA || 'en';
      const langB = settings.autoSwapLangB || 'ja';

      const baseDetected = result.detectedLang ? result.detectedLang.split('-')[0].toLowerCase() : '';
      const baseActual = actualTargetLang ? actualTargetLang.split('-')[0].toLowerCase() : '';

      if (baseDetected === baseActual) {
        const alternateTarget = actualTargetLang === langB ? langA : langB;
        if (alternateTarget !== actualTargetLang) {
          result = await runTranslation(alternateTarget);
        }
      }
    }

    return result.translation;

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
