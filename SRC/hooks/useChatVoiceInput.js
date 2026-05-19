import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { createWebSpeechSession, isWebSpeechSupported } from '../services/webSpeechEngine';
import { isIOSPlatform, isMobileWebUserAgent } from '../utils/deviceUtils';

const LISTEN_TIMEOUT_MS = 30000;

function getExpoResultText(event) {
  const results = event?.results || [];
  const joined = results
    .map((r) => r?.transcript || '')
    .filter(Boolean)
    .join(' ')
    .trim();
  return joined || results[0]?.transcript || '';
}

/**
 * Speech-to-text for chat (native app + mobile web PWA).
 */
export function useChatVoiceInput({ onTranscript, lang = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const transcriptRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const webSessionRef = useRef(null);
  const listenTimerRef = useRef(null);
  const useWebSpeechRef = useRef(Platform.OS === 'web');

  onTranscriptRef.current = onTranscript;

  const applyTranscript = useCallback((text) => {
    const t = (text || '').trim();
    if (t && onTranscriptRef.current) onTranscriptRef.current(t);
  }, []);

  const clearListenTimer = useCallback(() => {
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
  }, []);

  const armListenTimer = useCallback(
    (stopFn) => {
      clearListenTimer();
      listenTimerRef.current = setTimeout(() => {
        stopFn();
      }, LISTEN_TIMEOUT_MS);
    },
    [clearListenTimer]
  );

  const setListening = useCallback((value) => {
    setIsListening(value);
  }, []);

  const stopWeb = useCallback(() => {
    clearListenTimer();
    webSessionRef.current?.stop();
    webSessionRef.current = null;
    setListening(false);
    applyTranscript(transcriptRef.current);
    transcriptRef.current = '';
  }, [applyTranscript, clearListenTimer, setListening]);

  const stopNative = useCallback(() => {
    clearListenTimer();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (_) {
      /* ignore */
    }
    setListening(false);
    applyTranscript(transcriptRef.current);
    transcriptRef.current = '';
  }, [applyTranscript, clearListenTimer, setListening]);

  const stop = useCallback(() => {
    if (useWebSpeechRef.current) stopWeb();
    else stopNative();
  }, [stopNative, stopWeb]);

  useEffect(() => () => {
    clearListenTimer();
    webSessionRef.current?.stop();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (_) {
      /* ignore */
    }
  }, [clearListenTimer]);

  // --- Native (expo-speech-recognition) events ---
  useSpeechRecognitionEvent('start', () => {
    if (!useWebSpeechRef.current) setListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    if (useWebSpeechRef.current) return;
    clearListenTimer();
    setListening(false);
    applyTranscript(transcriptRef.current);
    transcriptRef.current = '';
  });

  useSpeechRecognitionEvent('speechend', () => {
    if (useWebSpeechRef.current) return;
    stopNative();
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (useWebSpeechRef.current) return;
    const text = getExpoResultText(event);
    if (text) {
      transcriptRef.current = text;
      applyTranscript(text);
    }
    if (event?.isFinal) {
      stopNative();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (useWebSpeechRef.current) return;
    clearListenTimer();
    setListening(false);
    const code = event?.error || '';
    if (code && code !== 'aborted' && code !== 'no-speech') {
      Alert.alert('Voice input', event?.message || 'Speech recognition failed.');
    }
  });

  const ensureNativePermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone permission',
          message: 'eHealth AI needs microphone access for voice input.',
          buttonPositive: 'OK',
        }
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }

    const mic = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    if (!mic?.granted) return false;

    if (Platform.OS === 'ios') {
      const speech = await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
      if (!speech?.granted) return false;
    }

    return true;
  }, []);

  const startNative = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable?.()) {
      Alert.alert(
        'Voice input unavailable',
        'Speech recognition is not available on this device. Please type your message.'
      );
      return;
    }

    const ok = await ensureNativePermissions();
    if (!ok) {
      Alert.alert('Permission needed', 'Microphone and speech recognition access are required.');
      return;
    }

    transcriptRef.current = '';
    setListening(true);

    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: Platform.OS === 'android',
      requiresOnDeviceRecognition: false,
      iosVoiceProcessingEnabled: isIOSPlatform(),
    });

    armListenTimer(stopNative);
  }, [armListenTimer, ensureNativePermissions, lang, setListening, stopNative]);

  const startWeb = useCallback(async () => {
    if (!isWebSpeechSupported()) {
      if (isMobileWebUserAgent() && isIOSPlatform()) {
        Alert.alert(
          'Voice input on iPhone',
          'For voice typing, open eHealth AI in Safari (not Chrome), or type your message. You can also add the app to your Home Screen from Safari.'
        );
      } else {
        Alert.alert(
          'Voice input unavailable',
          'Your browser does not support speech recognition. Please type your message.'
        );
      }
      return;
    }

    transcriptRef.current = '';
    webSessionRef.current = createWebSpeechSession({
      lang,
      onTranscript: (text) => {
        transcriptRef.current = text;
        applyTranscript(text);
      },
      onListeningChange: (listening) => {
        setListening(listening);
        if (!listening) {
          clearListenTimer();
          transcriptRef.current = '';
        }
      },
    });

    if (!webSessionRef.current) {
      Alert.alert('Voice input unavailable', 'Please type your message.');
      return;
    }

    try {
      await webSessionRef.current.start();
      armListenTimer(stopWeb);
    } catch (e) {
      setListening(false);
      Alert.alert('Voice input', e?.message || 'Could not start microphone.');
    }
  }, [applyTranscript, armListenTimer, clearListenTimer, lang, setListening, stopWeb]);

  const start = useCallback(async () => {
    if (useWebSpeechRef.current) await startWeb();
    else await startNative();
  }, [startNative, startWeb]);

  const toggle = useCallback(async () => {
    if (isListening) {
      stop();
      return;
    }
    await start();
  }, [isListening, start, stop]);

  return { isListening, start, stop, toggle };
};
