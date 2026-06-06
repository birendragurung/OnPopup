export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getLanguageName(code) {
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
