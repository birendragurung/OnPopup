const { app, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let getMainWindowInstance = () => null;

let clipboardHistory = [];
const historyPath = path.join(app.getPath('userData'), 'clipboard_history.json');
let isInternalClipboardChange = false;
let lastClipboardText = '';
let lastActiveApp = null;

function initClipboard(getMainWindow) {
  getMainWindowInstance = getMainWindow;
}

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

function saveClipboardHistory() {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(clipboardHistory, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save clipboard history:', err);
  }
}

function addToClipboardHistory(text) {
  if (!text || text.trim() === '') return;
  text = text.trim();

  const index = clipboardHistory.indexOf(text);
  if (index !== -1) {
    clipboardHistory.splice(index, 1);
  }

  clipboardHistory.unshift(text);

  if (clipboardHistory.length > 50) {
    clipboardHistory = clipboardHistory.slice(0, 50);
  }

  saveClipboardHistory();

  const mainWindow = getMainWindowInstance();
  if (mainWindow) {
    mainWindow.webContents.send('clipboard-history-updated', clipboardHistory);
  }
}

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

async function getSelectedText() {
  isInternalClipboardChange = true;
  try {
    const originalText = clipboard.readText();
    const originalHtml = clipboard.readHTML();

    clipboard.clear();

    await new Promise(resolve => setTimeout(resolve, 150));

    if (process.platform === 'darwin') {
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        if (lastActiveApp) {
          execSync(`osascript -e 'tell application "${lastActiveApp}" to activate'`);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Use native CGEvent helper to bypass osascript Automation (1002) errors
        const helperPath = path.join(__dirname, '..', '..', 'assets', 'copy-helper');
          
        let helperExecuted = false;
        if (fs.existsSync(helperPath)) {
          try {
            let execPath = helperPath;
            if (app.isPackaged) {
              execPath = path.join(app.getPath('temp'), 'copy-helper-bin');
              // Extract from ASAR to physical file system
              const buffer = fs.readFileSync(helperPath);
              fs.writeFileSync(execPath, buffer);
              execSync(`chmod +x "${execPath}"`);
            }
            execSync(`"${execPath}"`);
            helperExecuted = true;
          } catch (err) {
            console.error('Failed to run copy-helper, falling back to osascript:', err);
          }
        }
        
        if (!helperExecuted) {
          execSync(`osascript -e 'tell application "System Events" to keystroke "c" using {command down}'`);
        }
      } catch (asErr) {
        console.error('Copy simulation failed:', asErr);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } else if (process.platform === 'win32') {
      try {
        const vbsPath = path.join(app.getPath('temp'), 'copy.vbs');
        fs.writeFileSync(vbsPath, 'Set wshShell = CreateObject("WScript.Shell")\nwshShell.SendKeys "^c"', 'utf8');
        const { exec } = require('child_process');
        exec(`wscript.exe "${vbsPath}"`);
      } catch (err) {
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`);
      }
    } else {
      const { exec } = require('child_process');
      exec('xdotool key ctrl+c');
    }

    let copiedText = '';
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      copiedText = clipboard.readText();
      if (copiedText && copiedText.trim() !== '') {
        break;
      }
    }

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

async function pasteClipboardItem(text) {
  if (!text) return false;

  isInternalClipboardChange = true;
  try {
    clipboard.writeText(text);
    addToClipboardHistory(text);
    lastClipboardText = text;
  } finally {
    isInternalClipboardChange = false;
  }

  const mainWindow = getMainWindowInstance();
  if (mainWindow) {
    mainWindow.hide();
  }

  await simulatePaste();
  return true;
}

async function simulatePaste() {
  await new Promise(resolve => setTimeout(resolve, 150));

  if (process.platform === 'darwin') {
    try {
      if (lastActiveApp) {
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

function clearClipboardHistory() {
  clipboardHistory = [];
  saveClipboardHistory();
}

function getClipboardHistory() {
  return clipboardHistory;
}

function getLastActiveApp() {
  return lastActiveApp;
}

module.exports = {
  initClipboard,
  updateLastActiveApp,
  loadClipboardHistory,
  saveClipboardHistory,
  addToClipboardHistory,
  startClipboardPoller,
  getSelectedText,
  pasteClipboardItem,
  simulatePaste,
  clearClipboardHistory,
  getClipboardHistory,
  getLastActiveApp
};
