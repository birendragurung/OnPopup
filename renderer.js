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

// App State
let settings = {
  service: 'google',
  geminiKey: '',
  targetLang: 'en'
};

let currentTranslation = '';
let debounceTimer = null;
let currentUtterance = null;

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
  settingsSaveBtn.addEventListener('click', saveSettings);
  
  copyBtn.addEventListener('click', copyTranslation);
  speakBtn.addEventListener('click', speakTranslation);

  // Global escape key to close/hide
  window.addEventListener('keydown', (e) => {
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
    // Load fresh inputs
    serviceProviderSelect.value = settings.service;
    geminiKeyInput.value = settings.geminiKey || '';
    toggleGeminiConfigVisibility();
  } else {
    settingsDrawer.classList.add('hidden');
  }
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

  if (service === 'gemini' && !geminiKey) {
    alert('Please enter a valid Gemini API key or switch back to Google Translate.');
    return;
  }

  const success = await window.electronAPI.saveSettings({
    service,
    geminiKey,
    targetLang
  });

  if (success) {
    settings.service = service;
    settings.geminiKey = geminiKey;
    settings.targetLang = targetLang;
    
    toggleSettingsDrawer(false);
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

// Run startup
document.addEventListener('DOMContentLoaded', init);
