export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const SUPPORTED_LANGUAGES = {
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

export function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code] || code.toUpperCase();
}
