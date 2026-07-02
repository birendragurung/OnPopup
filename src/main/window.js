const { app, BrowserWindow, globalShortcut, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;

let onTriggerTranslationCallback = null;
let onTriggerClipboardHistoryCallback = null;

function initWindow({ onTriggerTranslation, onTriggerClipboardHistory }) {
  onTriggerTranslationCallback = onTriggerTranslation;
  onTriggerClipboardHistoryCallback = onTriggerClipboardHistory;
}

function getMainWindow() {
  return mainWindow;
}

function createWindow(settings, saveWindowBounds) {
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
    fullscreenable: false,
    minWidth: 350,
    minHeight: 260,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.platform === 'darwin') {
    // Join the currently active Space (including fullscreen ones) when shown,
    // instead of forcing macOS to switch to the Space the window was last on.
    // Without this, triggering the shortcut from another workspace switches
    // Spaces, the window briefly loses focus mid-transition, and the blur
    // handler below hides it immediately.
    mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreenSpaces: true,
      skipTransformProcessType: true
    });
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  }

  mainWindow.loadFile(path.join(__dirname, '..', '..', 'index.html'));

  mainWindow.on('blur', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      saveWindowBounds({ width, height });
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function positionWindowNearCursor() {
  if (!mainWindow) return;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const bounds = display.bounds;

  const winSize = mainWindow.getSize();
  const winWidth = winSize[0];
  const winHeight = winSize[1];

  let x = cursor.x - Math.round(winWidth / 2);
  let y = cursor.y + 15;

  if (x < bounds.x) {
    x = bounds.x + 10;
  } else if (x + winWidth > bounds.x + bounds.width) {
    x = bounds.x + bounds.width - winWidth - 10;
  }

  if (y + winHeight > bounds.y + bounds.height) {
    y = cursor.y - winHeight - 15;
  }
  if (y < bounds.y) {
    y = bounds.y + 10;
  }

  mainWindow.setPosition(x, y);
}

function positionWindowNearTray() {
  if (!mainWindow || !tray) return;

  const trayBounds = tray.getBounds();
  const winSize = mainWindow.getSize();
  const winWidth = winSize[0];
  const winHeight = winSize[1];

  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (winWidth / 2));
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  const display = screen.getDisplayNearestPoint({ x, y });
  const bounds = display.bounds;

  if (x < bounds.x) {
    x = bounds.x + 10;
  } else if (x + winWidth > bounds.x + bounds.width) {
    x = bounds.x + bounds.width - winWidth - 10;
  }

  if (y + winHeight > bounds.y + bounds.height) {
    y = Math.round(trayBounds.y - winHeight - 4);
  }

  mainWindow.setPosition(x, y);
}

function toggleWindowNearTray(updateLastActiveApp) {
  if (!mainWindow) {
    // If it doesn't exist, we let the coordinator trigger creation
    return;
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

function createTray(updateLastActiveApp) {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');

  if (!fs.existsSync(iconPath)) {
    console.error('Tray icon not found at:', iconPath);
    return;
  }

  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({ width: 22, height: 22 });
  } catch (err) {
    console.error('Failed to load tray icon:', err);
    return;
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('OnPopup - Quick Translator');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Translator', accelerator: 'Option+T', click: () => onTriggerTranslationCallback() },
    { label: 'Clipboard History', accelerator: 'Option+V', click: () => onTriggerClipboardHistoryCallback() },
    {
      label: 'Settings',
      click: () => {
        const mw = getMainWindow();
        if (mw) {
          mw.webContents.send('open-settings');
          positionWindowNearTray();
          mw.show();
          mw.focus();
        }
      }
    },
    { label: 'About', click: () => shell.openExternal('https://github.com/MrBhola/translaPop#onpopup-') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.on('click', () => {
    toggleWindowNearTray(updateLastActiveApp);
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });
}

function registerShortcuts() {
  const translateShortcut = process.platform === 'darwin' ? 'Option+T' : 'Alt+T';
  const clipboardShortcut = process.platform === 'darwin' ? 'Option+V' : 'Alt+V';

  try {
    globalShortcut.unregisterAll();

    const transRegistered = globalShortcut.register(translateShortcut, () => {
      onTriggerTranslationCallback();
    });
    if (!transRegistered) {
      console.error(`Shortcut registration failed for ${translateShortcut}`);
    }

    const clipRegistered = globalShortcut.register(clipboardShortcut, () => {
      onTriggerClipboardHistoryCallback();
    });
    if (!clipRegistered) {
      console.error(`Shortcut registration failed for ${clipboardShortcut}`);
    }
  } catch (err) {
    console.error('Error registering shortcuts:', err);
  }
}

module.exports = {
  initWindow,
  getMainWindow,
  createWindow,
  positionWindowNearCursor,
  positionWindowNearTray,
  toggleWindowNearTray,
  createTray,
  registerShortcuts
};
