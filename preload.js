const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Listeners from Main to Renderer
  onTranslateText: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('translate-text', subscription);
    return () => ipcRenderer.removeListener('translate-text', subscription);
  },
  onOpenSettings: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('open-settings', subscription);
    return () => ipcRenderer.removeListener('open-settings', subscription);
  },

  // Calls from Renderer to Main
  translate: (text, service, targetLang, apiKey) => 
    ipcRenderer.invoke('translate-api', { text, service, targetLang, apiKey }),
    
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  
  hideWindow: () => ipcRenderer.send('hide-window'),
  
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  openLogFile: () => ipcRenderer.invoke('open-log-file')
});
