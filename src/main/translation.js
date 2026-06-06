const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const settingsManager = require('./settings');

const logPath = path.join(app.getPath('userData'), 'translation_errors.log');

function getLogPath() {
  return logPath;
}

function logTranslationError(error, details) {
  if (app.isPackaged) return;

  try {
    const timestamp = new Date().toISOString();
    const divider = '='.repeat(60);
    const logMessage = `
${divider}
TIMESTAMP: ${timestamp}
SERVICE: ${details.service || 'unknown'}
TARGET LANG: ${details.targetLang || 'unknown'}
PAYLOAD LENGTH: ${details.payloadLength || 0} characters
PAYLOAD PREVIEW:
${details.payloadPreview || 'N/A'}
ERROR MESSAGE: ${error.message || error}
ERROR STATUS: ${error.status || 'N/A'}
RESPONSE BODY: ${error.responseBody || 'N/A'}
ERROR STACK:
${error.stack || 'N/A'}
${divider}
`;
    fs.appendFileSync(logPath, logMessage, 'utf8');
    console.log(`Error logged to: ${logPath}`);
  } catch (err) {
    console.error('Failed to write to translation error log file:', err);
  }
}

function determineTargetLanguage(text) {
  const settings = settingsManager.getSettings();
  const langA = settings.autoSwapLangA || 'en';
  const langB = settings.autoSwapLangB || 'ja';

  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
  const hasRussian = /[\u0400-\u04ff]/.test(text);
  const hasHindi = /[\u0900-\u097f]/.test(text);
  const hasArabic = /[\u0600-\u06ff]/.test(text);
  const hasChinese = /[\u4e00-\u9fff]/.test(text) && !hasJapanese;

  if (langA === 'ja' || langB === 'ja') {
    const otherLang = langA === 'ja' ? langB : langA;
    return hasJapanese ? otherLang : 'ja';
  }
  if (langA === 'ru' || langB === 'ru') {
    const otherLang = langA === 'ru' ? langB : langA;
    return hasRussian ? otherLang : 'ru';
  }
  if (langA === 'hi' || langB === 'hi') {
    const otherLang = langA === 'hi' ? langB : langA;
    return hasHindi ? otherLang : 'hi';
  }
  if (langA === 'ar' || langB === 'ar') {
    const otherLang = langA === 'ar' ? langB : langA;
    return hasArabic ? otherLang : 'ar';
  }
  if (langA === 'zh' || langB === 'zh') {
    const otherLang = langA === 'zh' ? langB : langA;
    return hasChinese ? otherLang : 'zh';
  }

  return langB;
}

async function translate({ text, service, targetLang, apiKey }) {
  if (!text || text.trim() === '') return '';

  const settings = settingsManager.getSettings();
  const payloadLength = text.length;
  const payloadPreview = text.slice(0, 500) + (text.length > 500 ? '...' : '');

  try {
    let actualTargetLang = targetLang;
    let isAutoSwapped = false;

    if (settings.autoSwapEnabled) {
      actualTargetLang = determineTargetLanguage(text);
      isAutoSwapped = true;
    }

    const runTranslation = async (targetL) => {
      if (service === 'gemini') {
        if (!apiKey) {
          throw new Error('Gemini API key is required. Please set it in Settings.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following text into the language with code '${targetL}'. Return ONLY the direct translation. Do not wrap in quotes or add any conversational intro, outro, markdown formatting or explanation. Keep line breaks intact. Text to translate:\n\n${text}`
              }]
            }]
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMessage = errData.error?.message || `Gemini API returned status ${response.status}`;
          const error = new Error(errMessage);
          error.status = response.status;
          error.responseBody = JSON.stringify(errData);
          throw error;
        }

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!result) throw new Error('Invalid response structure from Gemini API');
        return { translation: result.trim(), detectedLang: null };
      } else {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetL}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url);
        if (!response.ok) {
          const error = new Error(`Google Translate API returned status ${response.status}`);
          error.status = response.status;
          try {
            error.responseBody = await response.text();
          } catch (_) { }
          throw error;
        }

        const data = await response.json();
        if (!data || !data[0]) {
          throw new Error('Invalid response structure from Google Translate');
        }

        const translated = data[0].map(sentence => sentence[0]).join('');
        const detectedLang = data[2];
        return { translation: translated, detectedLang: detectedLang };
      }
    };

    let result = await runTranslation(actualTargetLang);

    if (isAutoSwapped && service === 'google') {
      const langA = settings.autoSwapLangA || 'en';
      const langB = settings.autoSwapLangB || 'ja';

      const baseDetected = result.detectedLang ? result.detectedLang.split('-')[0].toLowerCase() : '';
      const baseActual = actualTargetLang ? actualTargetLang.split('-')[0].toLowerCase() : '';

      if (baseDetected === baseActual) {
        const alternateTarget = actualTargetLang === langB ? langA : langB;
        if (alternateTarget !== actualTargetLang) {
          result = await runTranslation(alternateTarget);
          actualTargetLang = alternateTarget;
        }
      }
    }

    return {
      translation: result.translation,
      targetLang: actualTargetLang
    };

  } catch (error) {
    logTranslationError(error, {
      service,
      targetLang,
      payloadLength,
      payloadPreview
    });
    throw error;
  }
}

module.exports = {
  determineTargetLanguage,
  translate,
  logTranslationError,
  getLogPath
};
