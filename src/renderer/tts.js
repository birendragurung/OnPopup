let currentUtterance = null;

const PREFERRED_VOICES = {
  en: ['samantha', 'alex', 'daniel', 'karen', 'google'],
  ja: ['kyoko', 'otoya', 'google'],
  es: ['monica', 'jorge', 'google'],
  fr: ['thomas', 'aurélie', 'google'],
  de: ['anna', 'google'],
  zh: ['tingting', 'google'],
  ko: ['yuna', 'google'],
  ru: ['milena', 'google'],
  pt: ['luciana', 'google'],
  it: ['alice', 'google'],
  hi: ['lekha', 'google'],
  ar: ['maged', 'google'],
  ne: ['google']
};

function selectVoice(targetLang) {
  const voices = speechSynthesis.getVoices();
  let cleanLang = targetLang.toLowerCase().split('-')[0];
  
  let matchingVoices = voices.filter(v => {
    const voiceLang = v.lang.toLowerCase().replace('_', '-');
    return voiceLang.startsWith(cleanLang);
  });

  // If no matching voices for Nepali, fallback to Hindi since both use Devanagari script
  if (matchingVoices.length === 0 && cleanLang === 'ne') {
    cleanLang = 'hi';
    matchingVoices = voices.filter(v => {
      const voiceLang = v.lang.toLowerCase().replace('_', '-');
      return voiceLang.startsWith(cleanLang);
    });
  }

  if (matchingVoices.length === 0) return null;

  const preferences = PREFERRED_VOICES[cleanLang] || [];
  for (const pref of preferences) {
    const found = matchingVoices.find(v => v.name.toLowerCase().includes(pref));
    if (found) return found;
  }

  return matchingVoices[0];
}

export function speak(text, targetLang, { onStart, onEnd, onError } = {}) {
  if (!text || text.trim() === '') return;

  if (speechSynthesis.speaking) {
    stop();
    return;
  }

  currentUtterance = new SpeechSynthesisUtterance(text);
  
  const selectedVoice = selectVoice(targetLang);
  if (selectedVoice) {
    currentUtterance.voice = selectedVoice;
    currentUtterance.lang = selectedVoice.lang;
  } else {
    currentUtterance.lang = targetLang;
  }

  currentUtterance.onstart = () => {
    if (onStart) onStart();
  };

  currentUtterance.onend = () => {
    if (onEnd) onEnd();
    currentUtterance = null;
  };

  currentUtterance.onerror = (err) => {
    if (onError) onError(err);
    currentUtterance = null;
  };

  speechSynthesis.speak(currentUtterance);
}

export function stop() {
  speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeaking() {
  return speechSynthesis.speaking;
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {};
}
