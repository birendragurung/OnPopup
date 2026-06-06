let config = {
  textareaEl: null,
  outputDivEl: null,
  outputContainerEl: null,
  clearBtnEl: null,
  loaderEl: null,
  getSettingsCallback: null,
  performTranslateCallCallback: null,
  onLogOpenCallback: null,
  isDev: false
};

let currentTranslation = '';
let currentTranslationLang = '';
let debounceTimer = null;

export function initTranslator(options) {
  config = { ...config, ...options };

  config.textareaEl.addEventListener('input', handleSourceTextInput);
  
  if (config.clearBtnEl) {
    config.clearBtnEl.addEventListener('click', () => {
      config.textareaEl.value = '';
      toggleClearBtnVisibility();
      performTranslation('');
      config.textareaEl.focus();
    });
  }
}

export function getCurrentTranslation() {
  return currentTranslation;
}

export function getCurrentTranslationLang() {
  return currentTranslationLang || (config.getSettingsCallback ? config.getSettingsCallback().targetLang : 'en');
}

export function setCurrentTranslation(val) {
  currentTranslation = val;
  config.outputDivEl.textContent = val;
}

export function showLoader(show) {
  if (show) {
    config.loaderEl.classList.remove('hidden');
  } else {
    config.loaderEl.classList.add('hidden');
  }
}

export function toggleClearBtnVisibility() {
  if (!config.clearBtnEl) return;
  if (config.textareaEl.value && config.textareaEl.value.length > 0) {
    config.clearBtnEl.classList.remove('hidden');
  } else {
    config.clearBtnEl.classList.add('hidden');
  }
}

export function handleSourceTextInput() {
  toggleClearBtnVisibility();
  clearTimeout(debounceTimer);
  const text = config.textareaEl.value;
  
  debounceTimer = setTimeout(() => {
    performTranslation(text);
  }, 600);
}

export function triggerImmediateTranslation() {
  clearTimeout(debounceTimer);
  performTranslation(config.textareaEl.value);
}

export async function performTranslation(text) {
  if (!text || text.trim() === '') {
    config.outputDivEl.innerHTML = '<span class="empty">Translation will appear here...</span>';
    currentTranslation = '';
    currentTranslationLang = '';
    return;
  }

  showLoader(true);
  config.outputDivEl.textContent = 'Translating...';

  const settings = config.getSettingsCallback();

  try {
    const result = await config.performTranslateCallCallback(
      text,
      settings.service,
      settings.targetLang,
      settings.geminiKey
    );
    
    if (result && typeof result === 'object') {
      currentTranslation = result.translation;
      currentTranslationLang = result.targetLang;
    } else {
      currentTranslation = result;
      currentTranslationLang = settings.targetLang;
    }
    config.outputDivEl.textContent = currentTranslation;
    
    if (config.outputContainerEl) config.outputContainerEl.scrollTop = 0;
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

    if (config.isDev) {
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
    config.outputDivEl.innerHTML = errorHtml;
    currentTranslation = '';

    if (config.isDev) {
      const openLogBtn = document.getElementById('open-log-btn');
      if (openLogBtn && config.onLogOpenCallback) {
        openLogBtn.addEventListener('click', config.onLogOpenCallback);
      }
    }
  } finally {
    showLoader(false);
  }
}
