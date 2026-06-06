let config = {
  drawerEl: null,
  providerSelectEl: null,
  keyInputEl: null,
  keyConfigEl: null,
  autoswapEnableEl: null,
  autoswapConfigEl: null,
  langASelectEl: null,
  langBSelectEl: null,
  saveBtnEl: null,
  openLogBtnEl: null,
  onSaveCallback: null,
  onOpenLogCallback: null,
  onCloseCallback: null
};

export function initSettingsDrawer(options) {
  config = { ...config, ...options };

  config.providerSelectEl.addEventListener('change', () => toggleGeminiConfigVisibility(config.providerSelectEl.value));
  config.autoswapEnableEl.addEventListener('change', () => toggleAutoswapConfigVisibility(config.autoswapEnableEl.checked));
  
  if (config.saveBtnEl) {
    config.saveBtnEl.addEventListener('click', handleSave);
  }

  if (config.openLogBtnEl) {
    config.openLogBtnEl.addEventListener('click', () => {
      if (config.onOpenLogCallback) config.onOpenLogCallback();
    });
  }
}

export function toggleSettingsDrawer(show, currentSettings) {
  if (show) {
    config.drawerEl.classList.remove('hidden');

    config.providerSelectEl.value = currentSettings.service;
    config.keyInputEl.value = currentSettings.geminiKey || '';
    config.autoswapEnableEl.checked = currentSettings.autoSwapEnabled || false;
    config.langASelectEl.value = currentSettings.autoSwapLangA || 'en';
    config.langBSelectEl.value = currentSettings.autoSwapLangB || 'ja';

    toggleGeminiConfigVisibility(currentSettings.service);
    toggleAutoswapConfigVisibility(currentSettings.autoSwapEnabled);
  } else {
    config.drawerEl.classList.add('hidden');
    if (config.onCloseCallback) config.onCloseCallback();
  }
}

export function toggleGeminiConfigVisibility(service) {
  if (service === 'gemini') {
    config.keyConfigEl.classList.remove('hidden');
  } else {
    config.keyConfigEl.classList.add('hidden');
  }
}

export function toggleAutoswapConfigVisibility(enabled) {
  if (enabled) {
    config.autoswapConfigEl.classList.remove('hidden');
  } else {
    config.autoswapConfigEl.classList.add('hidden');
  }
}

async function handleSave() {
  const service = config.providerSelectEl.value;
  const geminiKey = config.keyInputEl.value.trim();
  const autoSwapEnabled = config.autoswapEnableEl.checked;
  const autoSwapLangA = config.langASelectEl.value;
  const autoSwapLangB = config.langBSelectEl.value;

  if (service === 'gemini' && !geminiKey) {
    alert('Please enter a valid Gemini API key or switch back to Google Translate.');
    return;
  }

  if (autoSwapEnabled && autoSwapLangA === autoSwapLangB) {
    alert('Language A and Language B must be different for Smart Auto-Swap.');
    return;
  }

  if (config.onSaveCallback) {
    await config.onSaveCallback({
      service,
      geminiKey,
      autoSwapEnabled,
      autoSwapLangA,
      autoSwapLangB
    });
  }
}
