const { app, ipcMain, clipboard, shell, BrowserWindow } = require('electron');
const fs = require('fs');

// Import sub-modules
const settingsManager = require('./src/main/settings');
const translationManager = require('./src/main/translation');
const clipboardManager = require('./src/main/clipboard');
const windowManager = require('./src/main/window');

// Initialize dependencies
clipboardManager.initClipboard(windowManager.getMainWindow);
windowManager.initWindow({
  onTriggerTranslation: triggerTranslation,
  onTriggerClipboardHistory: triggerClipboardHistory
});

// Orchestrate the translation capture & window presentation flow
async function triggerTranslation() {
  if (process.platform === 'darwin') {
    clipboardManager.updateLastActiveApp();
  }

  // Get selected text first while target window is focused
  const selectedText = await clipboardManager.getSelectedText();

  const currentSettings = settingsManager.getSettings();

  if (!windowManager.getMainWindow()) {
    windowManager.createWindow(currentSettings, settingsManager.saveSettings);
    // Wait for the window to load if it was just created
    await new Promise(resolve => {
      windowManager.getMainWindow().webContents.once('did-finish-load', resolve);
    });
  }

  windowManager.positionWindowNearCursor();

  const mainWindow = windowManager.getMainWindow();
  mainWindow.show();
  mainWindow.focus();

  mainWindow.webContents.send('translate-text', selectedText);
}

// Orchestrate clipboard history drawer trigger
async function triggerClipboardHistory() {
  if (process.platform === 'darwin') {
    clipboardManager.updateLastActiveApp();
  }

  const currentSettings = settingsManager.getSettings();

  if (!windowManager.getMainWindow()) {
    windowManager.createWindow(currentSettings, settingsManager.saveSettings);
    await new Promise(resolve => {
      windowManager.getMainWindow().webContents.once('did-finish-load', resolve);
    });
  }

  windowManager.positionWindowNearCursor();

  const mainWindow = windowManager.getMainWindow();
  mainWindow.show();
  mainWindow.focus();

  mainWindow.webContents.send('show-clipboard-history', clipboardManager.getClipboardHistory());
}

// App Lifecycles
app.whenReady().then(() => {
  // Hide Dock icon on macOS so it runs purely as a status bar app
  if (process.platform === 'darwin') {
    if (app.dock) app.dock.hide();
    
    // Prompt for accessibility permissions (required for clipboard shortcuts)
    const { systemPreferences } = require('electron');
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  }

  const currentSettings = settingsManager.loadSettings();
  clipboardManager.loadClipboardHistory();
  
  windowManager.createWindow(currentSettings, settingsManager.saveSettings);
  windowManager.registerShortcuts();
  windowManager.createTray(clipboardManager.updateLastActiveApp);
  
  clipboardManager.startClipboardPoller();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow(settingsManager.getSettings(), settingsManager.saveSettings);
    }
  });
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler Registrations
ipcMain.on('hide-window', () => {
  const mw = windowManager.getMainWindow();
  if (mw) mw.hide();
});

ipcMain.handle('get-settings', () => {
  return { ...settingsManager.getSettings(), isDev: !app.isPackaged };
});

ipcMain.handle('save-settings', (event, newSettings) => {
  return settingsManager.saveSettings(newSettings);
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    if (url.startsWith('https://github.com/')) {
      await shell.openExternal(url);
      return true;
    }
  } catch (err) {
    console.error('Failed to open external url:', err);
  }
  return false;
});

ipcMain.handle('open-log-file', async () => {
  if (app.isPackaged) return false;
  try {
    const logPath = translationManager.getLogPath();
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

ipcMain.handle('get-clipboard-history', () => {
  return clipboardManager.getClipboardHistory();
});

ipcMain.handle('clear-clipboard-history', () => {
  clipboardManager.clearClipboardHistory();
  return true;
});

ipcMain.handle('paste-clipboard-item', async (event, text) => {
  return clipboardManager.pasteClipboardItem(text);
});

ipcMain.handle('translate-api', async (event, { text, service, targetLang, apiKey }) => {
  return translationManager.translate({ text, service, targetLang, apiKey });
});
