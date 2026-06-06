import { escapeHtml } from './utils.js';

let config = {
  drawerEl: null,
  searchInputEl: null,
  clearBtnEl: null,
  listEl: null,
  onPasteCallback: null,
  onTranslateCallback: null,
  onClearCallback: null,
  onCloseCallback: null
};

let clipboardHistory = [];
let filteredHistory = [];
let activeHistoryIndex = 0;

export function initClipboardDrawer(options) {
  config = { ...config, ...options };

  config.searchInputEl.addEventListener('input', () => {
    activeHistoryIndex = 0;
    renderList();
  });

  if (config.clearBtnEl) {
    config.clearBtnEl.addEventListener('click', handleClearAll);
  }
}

export function toggleClipboardDrawer(show, history = []) {
  if (show) {
    config.drawerEl.classList.remove('hidden');
    clipboardHistory = history;
    config.searchInputEl.value = '';
    activeHistoryIndex = 0;
    renderList();
    setTimeout(() => {
      config.searchInputEl.focus();
    }, 50);
  } else {
    config.drawerEl.classList.add('hidden');
    if (config.onCloseCallback) config.onCloseCallback();
  }
}

export function handleKeyDown(e) {
  if (config.drawerEl.classList.contains('hidden')) return false;

  if (e.key === 'Escape') {
    e.preventDefault();
    toggleClipboardDrawer(false);
    return true;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredHistory.length > 0) {
      activeHistoryIndex = (activeHistoryIndex + 1) % filteredHistory.length;
      renderList();
    }
    return true;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredHistory.length > 0) {
      activeHistoryIndex = (activeHistoryIndex - 1 + filteredHistory.length) % filteredHistory.length;
      renderList();
    }
    return true;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeHistoryIndex >= 0 && activeHistoryIndex < filteredHistory.length) {
      const selectedItem = filteredHistory[activeHistoryIndex];
      if (e.shiftKey) {
        if (config.onTranslateCallback) config.onTranslateCallback(selectedItem);
      } else {
        if (config.onPasteCallback) config.onPasteCallback(selectedItem);
      }
    }
    return true;
  } else if (/^[1-9]$/.test(e.key) && config.searchInputEl.value === '') {
    const num = parseInt(e.key, 10);
    const index = num - 1;
    if (index >= 0 && index < filteredHistory.length) {
      e.preventDefault();
      if (config.onPasteCallback) config.onPasteCallback(filteredHistory[index]);
    }
    return true;
  }

  return false;
}

export function renderList(newHistory) {
  if (newHistory) {
    clipboardHistory = newHistory;
  }

  const query = config.searchInputEl.value.toLowerCase().trim();
  
  filteredHistory = clipboardHistory.filter(item => 
    item.toLowerCase().includes(query)
  );

  config.listEl.innerHTML = '';

  if (filteredHistory.length === 0) {
    config.listEl.innerHTML = `
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

    itemDiv.addEventListener('click', () => {
      if (config.onPasteCallback) config.onPasteCallback(text);
    });

    const translateBtn = itemDiv.querySelector('.translate-action');
    translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (config.onTranslateCallback) config.onTranslateCallback(text);
    });

    const pasteBtn = itemDiv.querySelector('.paste-action');
    pasteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (config.onPasteCallback) config.onPasteCallback(text);
    });

    config.listEl.appendChild(itemDiv);
  });

  const activeItem = config.listEl.querySelector('.clipboard-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest' });
  }
}

async function handleClearAll() {
  if (confirm('Are you sure you want to clear all clipboard history?')) {
    if (config.onClearCallback) {
      await config.onClearCallback();
      clipboardHistory = [];
      renderList();
    }
  }
}

export function isVisible() {
  return !config.drawerEl.classList.contains('hidden');
}
