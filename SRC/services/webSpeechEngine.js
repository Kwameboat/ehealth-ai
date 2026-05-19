/**
 * Direct Web Speech API for mobile browsers (more reliable than async permission chains).
 */

async function ensureWebMicrophone() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (_) {
    return false;
  }
}

export function isWebSpeechSupported() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * @returns {{ start: () => Promise<void>, stop: () => void } | null}
 */
export function createWebSpeechSession({ lang = 'en-US', onTranscript, onListeningChange }) {
  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  if (!SpeechRecognitionCtor) return null;

  let recognition = null;
  let listenTimer = null;

  const clearTimer = () => {
    if (listenTimer) {
      clearTimeout(listenTimer);
      listenTimer = null;
    }
  };

  const stop = () => {
    clearTimer();
    if (!recognition) {
      onListeningChange?.(false);
      return;
    }
    try {
      recognition.stop();
    } catch (_) {
      /* ignore */
    }
    recognition = null;
    onListeningChange?.(false);
  };

  const start = async () => {
    const micOk = await ensureWebMicrophone();
    if (!micOk) {
      throw new Error('Microphone permission is required for voice input.');
    }

    recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.[0]?.transcript) {
          text += result[0].transcript;
        }
        if (result?.isFinal) isFinal = true;
      }
      const trimmed = text.trim();
      if (trimmed && onTranscript) onTranscript(trimmed);
      if (isFinal) stop();
    };

    recognition.onend = () => {
      clearTimer();
      recognition = null;
      onListeningChange?.(false);
    };

    recognition.onerror = (event) => {
      if (event?.error !== 'aborted' && event?.error !== 'no-speech') {
        console.warn('Web speech error:', event?.error);
      }
      stop();
    };

    onListeningChange?.(true);
    recognition.start();

    listenTimer = setTimeout(() => {
      stop();
    }, 30000);
  };

  return { start, stop };
}
