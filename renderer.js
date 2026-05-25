// Selectors
const sourceTextarea = document.getElementById('source-text');
const translatedTextDiv = document.getElementById('translated-text');
const targetLanguageSelect = document.getElementById('target-language');
const settingsToggleBtn = document.getElementById('settings-toggle');
const settingsCloseBtn = document.getElementById('settings-close');
const settingsSaveBtn = document.getElementById('settings-save');
const settingsDrawer = document.getElementById('settings-drawer');
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
const clipboardDrawer = document.getElementById('clipboard-drawer');
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

let currentTranslation = '';
let debounceTimer = null;
let currentUtterance = null;

// Clipboard History State
let clipboardHistory = [];
let filteredHistory = [];
let activeHistoryIndex = 0;

// Initialize
async function init() {
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

  // Toggle Auto-Swap config and state
  toggleAutoswapConfigVisibility();
  updateTargetLanguageSelectState();

  // Show/hide API key config
  toggleGeminiConfigVisibility();

  // Show/hide developer troubleshooting tools based on isDev
  const devTroubleDiv = document.getElementById('dev-troubleshooting');
  if (devTroubleDiv) {
    if (settings.isDev) {
      devTroubleDiv.classList.remove('hidden');
    } else {
      devTroubleDiv.classList.add('hidden');
    }
  }

  // Handle open log button in Settings drawer
  const settingsOpenLogBtn = document.getElementById('settings-open-log');
  if (settingsOpenLogBtn) {
    settingsOpenLogBtn.addEventListener('click', () => {
      window.electronAPI.openLogFile();
    });
  }

  // Listen for text captured from other windows
  window.electronAPI.onTranslateText((text) => {
    showLoader(false);
    toggleSettingsDrawer(false);
    toggleClipboardDrawer(false);
    
    if (!text || text.trim() === '') {
      sourceTextarea.value = '';
      translatedTextDiv.innerHTML = '<span class="empty">No text captured. Highlight some text and press Option+T, or type here...</span>';
      sourceTextarea.focus();
    } else {
      sourceTextarea.value = text;
      performTranslation(text);
    }
    toggleClearBtnVisibility();
  });

  // Listen for settings command from system tray
  window.electronAPI.onOpenSettings(() => {
    toggleSettingsDrawer(true);
  });

  // Listen for clipboard history from global shortcut trigger
  window.electronAPI.onShowClipboardHistory((history) => {
    clipboardHistory = history;
    toggleClipboardDrawer(true);
  });

  // Listen for real-time history updates
  window.electronAPI.onClipboardHistoryUpdated((history) => {
    clipboardHistory = history;
    if (!clipboardDrawer.classList.contains('hidden')) {
      renderClipboardList();
    }
  });

  // Event Listeners
  sourceTextarea.addEventListener('input', handleSourceTextInput);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      sourceTextarea.value = '';
      toggleClearBtnVisibility();
      performTranslation('');
      sourceTextarea.focus();
    });
  }
  targetLanguageSelect.addEventListener('change', handleTargetLanguageChange);
  
  settingsToggleBtn.addEventListener('click', () => toggleSettingsDrawer(true));
  settingsCloseBtn.addEventListener('click', () => toggleSettingsDrawer(false));
  serviceProviderSelect.addEventListener('change', toggleGeminiConfigVisibility);
  autoswapEnableInput.addEventListener('change', toggleAutoswapConfigVisibility);
  settingsSaveBtn.addEventListener('click', saveSettings);
  githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://github.com/MrBhola/translaPop#transpop-');
  });
  
  copyBtn.addEventListener('click', copyTranslation);
  speakBtn.addEventListener('click', speakTranslation);

  // Clipboard drawer event listeners
  clipboardToggleBtn.addEventListener('click', async () => {
    const history = await window.electronAPI.getClipboardHistory();
    clipboardHistory = history;
    toggleClipboardDrawer(true);
  });
  clipboardToTranslatorBtn.addEventListener('click', () => {
    toggleClipboardDrawer(false);
  });
  clipboardToSettingsBtn.addEventListener('click', () => {
    toggleSettingsDrawer(true);
  });
  clipboardSearchInput.addEventListener('input', () => {
    activeHistoryIndex = 0;
    renderClipboardList();
  });
  clipboardClearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all clipboard history?')) {
      await window.electronAPI.clearClipboardHistory();
      clipboardHistory = [];
      renderClipboardList();
    }
  });

  // Global escape key and keyboard navigation
  window.addEventListener('keydown', (e) => {
    // If clipboard drawer is visible, handle navigation and actions
    if (!clipboardDrawer.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        toggleClipboardDrawer(false);
        window.electronAPI.hideWindow();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredHistory.length > 0) {
          activeHistoryIndex = (activeHistoryIndex + 1) % filteredHistory.length;
          renderClipboardList();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredHistory.length > 0) {
          activeHistoryIndex = (activeHistoryIndex - 1 + filteredHistory.length) % filteredHistory.length;
          renderClipboardList();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeHistoryIndex >= 0 && activeHistoryIndex < filteredHistory.length) {
          if (e.shiftKey) {
            translateClipboardItem(filteredHistory[activeHistoryIndex]);
          } else {
            pasteItem(filteredHistory[activeHistoryIndex]);
          }
        }
      } else if (/^[1-9]$/.test(e.key) && clipboardSearchInput.value === '') {
        // Quick number selection when search is empty
        const num = parseInt(e.key, 10);
        const index = num - 1;
        if (index >= 0 && index < filteredHistory.length) {
          e.preventDefault();
          pasteItem(filteredHistory[index]);
        }
      }
      return;
    }

    if (e.key === 'Escape') {
      if (!settingsDrawer.classList.contains('hidden')) {
        toggleSettingsDrawer(false);
      } else {
        stopSpeech();
        window.electronAPI.hideWindow();
      }
    } else if (e.key === 'Enter' && !e.shiftKey && document.activeElement === sourceTextarea) {
      e.preventDefault();
      clearTimeout(debounceTimer);
      performTranslation(sourceTextarea.value);
    }
  });

  // Focus source text on startup
  sourceTextarea.focus();
}

// Show/hide loader spinner
function showLoader(show) {
  if (show) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

// Translate logic
async function performTranslation(text) {
  if (!text || text.trim() === '') {
    translatedTextDiv.innerHTML = '<span class="empty">Translation will appear here...</span>';
    currentTranslation = '';
    return;
  }

  showLoader(true);
  translatedTextDiv.textContent = 'Translating...';

  try {
    const result = await window.electronAPI.translate(
      text,
      settings.service,
      settings.targetLang,
      settings.geminiKey
    );
    
    currentTranslation = result;
    translatedTextDiv.textContent = result;
    
    // Auto-scroll output container to top
    const outputContainer = document.getElementById('translated-container');
    if (outputContainer) outputContainer.scrollTop = 0;
  } catch (err) {
    console.error('Translation error:', err);
    
    let errorHtml = `
      <div class="error-container">
        <div class="error-header">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="#ef4444" stroke-width="2.5" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span class="error-title">Translation Failed</span>
        </div>
        <div class="error-message">${err.message || 'An unknown API error occurred.'}</div>
    `;

    // Special tips for Google Translate length issues
    if (settings.service === 'google' && text.length > 1500) {
      errorHtml += `
        <div class="error-tip">
          <strong>Tip:</strong> The selected text is very long (${text.length} characters). Google's free translation service has strict length limits. Try selecting a smaller section of text, or configure <strong>Gemini AI</strong> in Settings to translate larger documents.
        </div>
      `;
    } else {
      errorHtml += `
        <div class="error-tip">
          <strong>Tip:</strong> Please check your internet connection and verify that your configurations are valid.
        </div>
      `;
    }

    // Only show Log File action button if we are in development mode
    if (settings.isDev) {
      errorHtml += `
        <div class="error-actions">
          <button id="open-log-btn" class="error-action-btn">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Open Log File
          </button>
        </div>
      `;
    }

    errorHtml += `</div>`;
    translatedTextDiv.innerHTML = errorHtml;
    currentTranslation = '';

    // If dev button is rendered, hook up event listener
    if (settings.isDev) {
      const openLogBtn = document.getElementById('open-log-btn');
      if (openLogBtn) {
        openLogBtn.addEventListener('click', () => {
          window.electronAPI.openLogFile();
        });
      }
    }
  } finally {
    showLoader(false);
  }
}

// Show/hide quick clear button
function toggleClearBtnVisibility() {
  if (!clearBtn) return;
  if (sourceTextarea.value && sourceTextarea.value.length > 0) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }
}

// Handle typing in source text box
function handleSourceTextInput() {
  toggleClearBtnVisibility();
  clearTimeout(debounceTimer);
  const text = sourceTextarea.value;
  
  // Wait 600ms after user stops typing before auto-translating
  debounceTimer = setTimeout(() => {
    performTranslation(text);
  }, 600);
}

// Translate again immediately when target language changes
function handleTargetLanguageChange() {
  settings.targetLang = targetLanguageSelect.value;
  // Save selection instantly
  window.electronAPI.saveSettings({ targetLang: settings.targetLang });
  performTranslation(sourceTextarea.value);
}

// Drawer animation toggles
function toggleSettingsDrawer(show) {
  if (show) {
    settingsDrawer.classList.remove('hidden');
    clipboardDrawer.classList.add('hidden'); // Hide clipboard drawer
    // Load fresh inputs
    serviceProviderSelect.value = settings.service;
    geminiKeyInput.value = settings.geminiKey || '';
    
    // Load fresh Auto-Swap inputs
    autoswapEnableInput.checked = settings.autoSwapEnabled || false;
    autoswapLangASelect.value = settings.autoSwapLangA || 'en';
    autoswapLangBSelect.value = settings.autoSwapLangB || 'ja';
    
    toggleGeminiConfigVisibility();
    toggleAutoswapConfigVisibility();
  } else {
    settingsDrawer.classList.add('hidden');
  }
}

// Clipboard History Drawer Actions
function toggleClipboardDrawer(show) {
  if (show) {
    clipboardDrawer.classList.remove('hidden');
    settingsDrawer.classList.add('hidden'); // Hide settings drawer
    clipboardSearchInput.value = '';
    activeHistoryIndex = 0;
    renderClipboardList();
    setTimeout(() => {
      clipboardSearchInput.focus();
    }, 50);
  } else {
    clipboardDrawer.classList.add('hidden');
    sourceTextarea.focus();
  }
}

function renderClipboardList() {
  const query = clipboardSearchInput.value.toLowerCase().trim();
  
  filteredHistory = clipboardHistory.filter(item => 
    item.toLowerCase().includes(query)
  );

  clipboardListDiv.innerHTML = '';

  if (filteredHistory.length === 0) {
    clipboardListDiv.innerHTML = `
      <div class="clipboard-list-empty">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" style="opacity: 0.5; margin-bottom: 4px;">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>No matching history items</span>
      </div>
    `;
    activeHistoryIndex = -1;
    return;
  }

  if (activeHistoryIndex >= filteredHistory.length) {
    activeHistoryIndex = filteredHistory.length - 1;
  }
  if (activeHistoryIndex < 0 && filteredHistory.length > 0) {
    activeHistoryIndex = 0;
  }

  filteredHistory.forEach((text, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = `clipboard-item ${index === activeHistoryIndex ? 'active' : ''}`;
    itemDiv.dataset.index = index;

    const shortcutText = index < 9 ? `${index + 1}` : '';
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const metaText = `${charCount} char${charCount !== 1 ? 's' : ''} • ${wordCount} word${wordCount !== 1 ? 's' : ''}`;

    itemDiv.innerHTML = `
      <div class="item-shortcut">${shortcutText || '•'}</div>
      <div class="item-content">
        <div class="item-text" title="${escapeHtml(text)}">${escapeHtml(text)}</div>
        <div class="item-meta">${metaText}</div>
      </div>
      <div class="item-actions">
        <button class="item-action-btn translate-action" title="Translate this item (Shift+Enter)">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </button>
        <button class="item-action-btn paste-action" title="Copy & Paste (Enter)">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    `;

    // Clicking the item body copies and pastes
    itemDiv.addEventListener('click', () => {
      pasteItem(text);
    });

    // Translate button click
    const translateBtn = itemDiv.querySelector('.translate-action');
    translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      translateClipboardItem(text);
    });

    // Paste button click
    const pasteBtn = itemDiv.querySelector('.paste-action');
    pasteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pasteItem(text);
    });

    clipboardListDiv.appendChild(itemDiv);
  });

  const activeItem = clipboardListDiv.querySelector('.clipboard-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest' });
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pasteItem(text) {
  window.electronAPI.pasteClipboardItem(text);
  toggleClipboardDrawer(false);
}

function translateClipboardItem(text) {
  // Hide clipboard drawer but keep main translation window open
  toggleClipboardDrawer(false);
  
  // Set translation source textarea
  sourceTextarea.value = text;
  if (typeof toggleClearBtnVisibility === 'function') {
    toggleClearBtnVisibility();
  }
  
  // Trigger translation instantly
  performTranslation(text);
}

function toggleGeminiConfigVisibility() {
  if (serviceProviderSelect.value === 'gemini') {
    geminiConfigDiv.classList.remove('hidden');
  } else {
    geminiConfigDiv.classList.add('hidden');
  }
}

// Save options drawer settings
async function saveSettings() {
  const service = serviceProviderSelect.value;
  const geminiKey = geminiKeyInput.value.trim();
  const targetLang = targetLanguageSelect.value;

  const autoSwapEnabled = autoswapEnableInput.checked;
  const autoSwapLangA = autoswapLangASelect.value;
  const autoSwapLangB = autoswapLangBSelect.value;

  if (service === 'gemini' && !geminiKey) {
    alert('Please enter a valid Gemini API key or switch back to Google Translate.');
    return;
  }

  if (autoSwapEnabled && autoSwapLangA === autoSwapLangB) {
    alert('Language A and Language B must be different for Smart Auto-Swap.');
    return;
  }

  const success = await window.electronAPI.saveSettings({
    service,
    geminiKey,
    targetLang,
    autoSwapEnabled,
    autoSwapLangA,
    autoSwapLangB
  });

  if (success) {
    settings.service = service;
    settings.geminiKey = geminiKey;
    settings.targetLang = targetLang;
    settings.autoSwapEnabled = autoSwapEnabled;
    settings.autoSwapLangA = autoSwapLangA;
    settings.autoSwapLangB = autoSwapLangB;
    
    toggleSettingsDrawer(false);
    updateTargetLanguageSelectState();
    // Refresh translation using new settings
    performTranslation(sourceTextarea.value);
  } else {
    alert('Failed to save configurations.');
  }
}

// Copy translated output to clipboard
async function copyTranslation() {
  if (!currentTranslation || currentTranslation.trim() === '') return;

  const success = await window.electronAPI.copyToClipboard(currentTranslation);
  if (success) {
    // Show checkmark icon
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

// Play TTS audio
function speakTranslation() {
  if (!currentTranslation || currentTranslation.trim() === '') return;

  // Toggle stop if already playing
  if (speechSynthesis.speaking) {
    stopSpeech();
    return;
  }

  currentUtterance = new SpeechSynthesisUtterance(currentTranslation);
  
  // Set language matching target preference
  const voices = speechSynthesis.getVoices();
  const matchedVoice = voices.find(voice => 
    voice.lang.toLowerCase().startsWith(settings.targetLang.toLowerCase())
  );
  
  if (matchedVoice) {
    currentUtterance.voice = matchedVoice;
  }
  currentUtterance.lang = settings.targetLang;

  // Visual cues
  const span = speakBtn.querySelector('span');
  span.textContent = 'Playing...';
  speakBtn.style.color = '#818cf8';

  currentUtterance.onend = () => {
    span.textContent = 'Listen';
    speakBtn.style.color = '';
    currentUtterance = null;
  };

  currentUtterance.onerror = () => {
    span.textContent = 'Listen';
    speakBtn.style.color = '';
    currentUtterance = null;
  };

  speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
  speechSynthesis.cancel();
  const span = speakBtn.querySelector('span');
  span.textContent = 'Listen';
  speakBtn.style.color = '';
  currentUtterance = null;
}

// Make sure voices are loaded (helps Chrome/Electron fetch list asynchronously)
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {};
}

// Toggle Smart Auto-Swap config block visibility
function toggleAutoswapConfigVisibility() {
  if (autoswapEnableInput.checked) {
    autoswapConfigDiv.classList.remove('hidden');
  } else {
    autoswapConfigDiv.classList.add('hidden');
  }
}

// Update the main view target language selector state (disable if Auto-Swap is active)
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

// Language code display name map
function getLanguageName(code) {
  const names = {
    en: 'English',
    ja: 'Japanese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    zh: 'Chinese',
    ko: 'Korean',
    pt: 'Portuguese',
    it: 'Italian',
    ru: 'Russian',
    hi: 'Hindi',
    ar: 'Arabic'
  };
  return names[code] || code.toUpperCase();
}

// Run startup
document.addEventListener('DOMContentLoaded', init);
