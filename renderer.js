import { getLanguageName, SUPPORTED_LANGUAGES } from './src/renderer/utils.js';
import * as tts from './src/renderer/tts.js';
import * as settingsDrawer from './src/renderer/settingsDrawer.js';
import * as clipboardDrawer from './src/renderer/clipboardDrawer.js';
import * as translator from './src/renderer/translator.js';

// Selectors
const sourceTextarea = document.getElementById('source-text');
const translatedTextDiv = document.getElementById('translated-text');
const targetLanguageSelect = document.getElementById('target-language');
const settingsToggleBtn = document.getElementById('settings-toggle');
const settingsCloseBtn = document.getElementById('settings-close');
const settingsSaveBtn = document.getElementById('settings-save');
const settingsDrawerEl = document.getElementById('settings-drawer');
const copyBtn = document.getElementById('copy-btn');
const speakBtn = document.getElementById('speak-btn');
const loader = document.getElementById('loader');
const serviceProviderSelect = document.getElementById('service-provider');
const geminiKeyInput = document.getElementById('gemini-key');
const geminiConfigDiv = document.getElementById('gemini-config');
const copyIcon = document.getElementById('copy-icon');
const checkIcon = document.getElementById('check-icon');
const clearBtn = document.getElementById('clear-btn');
const githubLink = document.getElementById('github-link');

// Clipboard Selectors
const clipboardDrawerEl = document.getElementById('clipboard-drawer');
const clipboardToTranslatorBtn = document.getElementById('clipboard-to-translator');
const clipboardToSettingsBtn = document.getElementById('clipboard-to-settings');
const clipboardToggleBtn = document.getElementById('clipboard-toggle');
const clipboardSearchInput = document.getElementById('clipboard-search');
const clipboardClearHistoryBtn = document.getElementById('clipboard-clear-history');
const clipboardListDiv = document.getElementById('clipboard-list');

// Auto-Swap Selectors
const autoswapEnableInput = document.getElementById('autoswap-enable');
const autoswapConfigDiv = document.getElementById('autoswap-config');
const autoswapLangASelect = document.getElementById('autoswap-lang-a');
const autoswapLangBSelect = document.getElementById('autoswap-lang-b');

// App State
let settings = {
  service: 'google',
  geminiKey: '',
  targetLang: 'en',
  autoSwapEnabled: false,
  autoSwapLangA: 'en',
  autoSwapLangB: 'ja'
};

let clipboardHistory = [];
let previousDrawer = null;

function populateLanguageDropdowns() {
  const selects = [targetLanguageSelect, autoswapLangASelect, autoswapLangBSelect];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '';
    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      select.appendChild(option);
    });
  });
}

function showSettingsDrawer(show) {
  if (show) {
    if (clipboardDrawer.isVisible()) {
      previousDrawer = 'clipboard';
    } else {
      previousDrawer = 'translator';
    }
    clipboardDrawer.toggleClipboardDrawer(false);
    settingsDrawer.toggleSettingsDrawer(true, settings);
  } else {
    settingsDrawer.toggleSettingsDrawer(false, settings);
    if (previousDrawer === 'clipboard') {
      showClipboardDrawer(true, clipboardHistory);
    } else {
      sourceTextarea.focus();
    }
    previousDrawer = null;
  }
}

function showClipboardDrawer(show, history) {
  if (show) {
    settingsDrawer.toggleSettingsDrawer(false);
  }
  clipboardDrawer.toggleClipboardDrawer(show, history);
}

async function init() {
  populateLanguageDropdowns();

  // Load settings from Main
  const loadedSettings = await window.electronAPI.getSettings();
  if (loadedSettings) {
    settings = { ...settings, ...loadedSettings };
  }

  // Populate UI inputs
  targetLanguageSelect.value = settings.targetLang;
  serviceProviderSelect.value = settings.service;
  geminiKeyInput.value = settings.geminiKey || '';

  // Populate Auto-Swap inputs
  autoswapEnableInput.checked = settings.autoSwapEnabled || false;
  autoswapLangASelect.value = settings.autoSwapLangA || 'en';
  autoswapLangBSelect.value = settings.autoSwapLangB || 'ja';

  updateTargetLanguageSelectState();

  // Show/hide developer troubleshooting tools based on isDev
  const devTroubleDiv = document.getElementById('dev-troubleshooting');
  if (devTroubleDiv) {
    if (settings.isDev) {
      devTroubleDiv.classList.remove('hidden');
    } else {
      devTroubleDiv.classList.add('hidden');
    }
  }

  // Initialize Settings Drawer Controller
  settingsDrawer.initSettingsDrawer({
    drawerEl: settingsDrawerEl,
    providerSelectEl: serviceProviderSelect,
    keyInputEl: geminiKeyInput,
    keyConfigEl: geminiConfigDiv,
    autoswapEnableEl: autoswapEnableInput,
    autoswapConfigEl: autoswapConfigDiv,
    langASelectEl: autoswapLangASelect,
    langBSelectEl: autoswapLangBSelect,
    saveBtnEl: settingsSaveBtn,
    openLogBtnEl: document.getElementById('settings-open-log'),
    onSaveCallback: handleSaveSettings,
    onOpenLogCallback: () => window.electronAPI.openLogFile(),
    onCloseCallback: null
  });

  // Initialize Clipboard Drawer Controller
  clipboardDrawer.initClipboardDrawer({
    drawerEl: clipboardDrawerEl,
    searchInputEl: clipboardSearchInput,
    clearBtnEl: clipboardClearHistoryBtn,
    listEl: clipboardListDiv,
    onPasteCallback: pasteItem,
    onTranslateCallback: translateClipboardItem,
    onClearCallback: () => window.electronAPI.clearClipboardHistory(),
    onCloseCallback: () => {
      sourceTextarea.focus();
    }
  });

  // Initialize Translator Controller
  translator.initTranslator({
    textareaEl: sourceTextarea,
    outputDivEl: translatedTextDiv,
    outputContainerEl: document.getElementById('translated-container'),
    clearBtnEl: clearBtn,
    loaderEl: loader,
    getSettingsCallback: () => settings,
    performTranslateCallCallback: (text, service, lang, key) => window.electronAPI.translate(text, service, lang, key),
    onLogOpenCallback: () => window.electronAPI.openLogFile(),
    isDev: settings.isDev
  });

  // Listen for text captured from other windows
  window.electronAPI.onTranslateText((text) => {
    translator.showLoader(false);
    showSettingsDrawer(false);
    showClipboardDrawer(false);
    
    if (!text || text.trim() === '') {
      sourceTextarea.value = '';
      translatedTextDiv.innerHTML = '<span class="empty">No text captured. Highlight some text and press Option+T, or type here...</span>';
      sourceTextarea.focus();
    } else {
      sourceTextarea.value = text;
      translator.performTranslation(text);
    }
    translator.toggleClearBtnVisibility();
  });

  // Listen for settings command from system tray
  window.electronAPI.onOpenSettings(() => {
    showSettingsDrawer(true);
  });

  // Listen for clipboard history from global shortcut trigger
  window.electronAPI.onShowClipboardHistory((history) => {
    clipboardHistory = history;
    showClipboardDrawer(true, clipboardHistory);
  });

  // Listen for real-time history updates
  window.electronAPI.onClipboardHistoryUpdated((history) => {
    clipboardHistory = history;
    if (clipboardDrawer.isVisible()) {
      clipboardDrawer.renderList(clipboardHistory);
    }
  });

  // UI action bindings
  targetLanguageSelect.addEventListener('change', handleTargetLanguageChange);
  
  settingsToggleBtn.addEventListener('click', () => showSettingsDrawer(true));
  settingsCloseBtn.addEventListener('click', () => showSettingsDrawer(false));
  
  githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://github.com/MrBhola/translaPop#transpop-');
  });
  
  copyBtn.addEventListener('click', copyTranslation);
  speakBtn.addEventListener('click', speakTranslation);

  clipboardToggleBtn.addEventListener('click', async () => {
    const history = await window.electronAPI.getClipboardHistory();
    clipboardHistory = history;
    showClipboardDrawer(true, clipboardHistory);
  });
  clipboardToTranslatorBtn.addEventListener('click', () => {
    showClipboardDrawer(false);
  });
  clipboardToSettingsBtn.addEventListener('click', () => {
    showSettingsDrawer(true);
  });

  // Global key navigation and triggers
  window.addEventListener('keydown', (e) => {
    const handled = clipboardDrawer.handleKeyDown(e);
    if (handled) return;

    if (e.key === 'Escape') {
      if (!settingsDrawerEl.classList.contains('hidden')) {
        showSettingsDrawer(false);
      } else {
        tts.stop();
        resetSpeakBtn();
        window.electronAPI.hideWindow();
      }
    } else if (e.key === 'Enter' && !e.shiftKey && document.activeElement === sourceTextarea) {
      e.preventDefault();
      translator.triggerImmediateTranslation();
    }
  });

  sourceTextarea.focus();
}

async function handleSaveSettings(newSettings) {
  const success = await window.electronAPI.saveSettings(newSettings);
  if (success) {
    settings = { ...settings, ...newSettings };
    showSettingsDrawer(false);
    updateTargetLanguageSelectState();
    translator.performTranslation(sourceTextarea.value);
  } else {
    alert('Failed to save configurations.');
  }
}

function handleTargetLanguageChange() {
  settings.targetLang = targetLanguageSelect.value;
  window.electronAPI.saveSettings({ targetLang: settings.targetLang });
  translator.performTranslation(sourceTextarea.value);
}

function pasteItem(text) {
  window.electronAPI.pasteClipboardItem(text);
  showClipboardDrawer(false);
}

function translateClipboardItem(text) {
  showClipboardDrawer(false);
  sourceTextarea.value = text;
  translator.toggleClearBtnVisibility();
  translator.performTranslation(text);
}

async function copyTranslation() {
  const translationText = translator.getCurrentTranslation();
  if (!translationText || translationText.trim() === '') return;

  const success = await window.electronAPI.copyToClipboard(translationText);
  if (success) {
    copyIcon.classList.add('hidden');
    checkIcon.classList.remove('hidden');
    const span = copyBtn.querySelector('span');
    span.textContent = 'Copied!';
    span.style.color = '#10b981';

    setTimeout(() => {
      copyIcon.classList.remove('hidden');
      checkIcon.classList.add('hidden');
      span.textContent = 'Copy';
      span.style.color = '';
    }, 1500);
  }
}

function speakTranslation() {
  const translationText = translator.getCurrentTranslation();
  if (!translationText || translationText.trim() === '') return;

  const span = speakBtn.querySelector('span');

  if (tts.isSpeaking()) {
    tts.stop();
    resetSpeakBtn();
    return;
  }

  const speechLang = translator.getCurrentTranslationLang();

  tts.speak(translationText, speechLang, {
    onStart: () => {
      span.textContent = 'Playing...';
      speakBtn.style.color = '#818cf8';
    },
    onEnd: () => {
      resetSpeakBtn();
    },
    onError: () => {
      resetSpeakBtn();
    }
  });
}

function resetSpeakBtn() {
  const span = speakBtn.querySelector('span');
  if (span) {
    span.textContent = 'Listen';
  }
  speakBtn.style.color = '';
}

function updateTargetLanguageSelectState() {
  if (settings.autoSwapEnabled) {
    let indicator = document.getElementById('autoswap-indicator');
    if (!indicator) {
      indicator = document.createElement('option');
      indicator.id = 'autoswap-indicator';
      indicator.value = 'autoswap';
      indicator.textContent = `Auto: ${getLanguageName(settings.autoSwapLangA)} ⇄ ${getLanguageName(settings.autoSwapLangB)}`;
      targetLanguageSelect.appendChild(indicator);
    } else {
      indicator.textContent = `Auto: ${getLanguageName(settings.autoSwapLangA)} ⇄ ${getLanguageName(settings.autoSwapLangB)}`;
    }
    targetLanguageSelect.value = 'autoswap';
    targetLanguageSelect.disabled = true;
    targetLanguageSelect.style.opacity = '0.7';
  } else {
    const indicator = document.getElementById('autoswap-indicator');
    if (indicator) {
      indicator.remove();
    }
    targetLanguageSelect.value = settings.targetLang;
    targetLanguageSelect.disabled = false;
    targetLanguageSelect.style.opacity = '';
  }
}

document.addEventListener('DOMContentLoaded', init);
