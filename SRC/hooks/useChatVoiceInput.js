import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

function getResultText(event) {
  const results = event?.results || [];
  const joined = results
    .map((r) => r?.transcript || '')
    .filter(Boolean)
    .join(' ')
    .trim();
  return joined || results[0]?.transcript || '';
}

/**
 * Speech-to-text for chat input fields. Stops mic on final result or recognition end.
 */
export function useChatVoiceInput({ onTranscript, lang = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const transcriptRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const applyTranscript = useCallback((text) => {
    const t = (text || '').trim();
    if (t && onTranscriptRef.current) onTranscriptRef.current(t);
  }, []);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (_) {
      /* already stopped */
    }
    setIsListening(false);
  }, []);

  useSpeechRecognitionEvent('start', () => setIsListening(true));

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    applyTranscript(transcriptRef.current);
    transcriptRef.current = '';
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = getResultText(event);
    if (text) {
      transcriptRef.current = text;
      applyTranscript(text);
    }
    if (event?.isFinal) {
      stop();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    const msg = event?.message || 'Speech recognition failed.';
    if (msg && msg !== 'aborted') {
      Alert.alert('Voice input', msg);
    }
  });

  const ensurePermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone permission',
          message: 'eHealth AI needs microphone access for voice input.',
          buttonPositive: 'OK',
        }
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!perm?.granted;
  }, []);

  const start = useCallback(async () => {
    const ok = await ensurePermissions();
    if (!ok) {
      Alert.alert('Permission needed', 'Microphone access is required for voice input.');
      return;
    }
    transcriptRef.current = '';
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
    });
  }, [ensurePermissions, lang]);

  const toggle = useCallback(async () => {
    if (isListening) {
      stop();
      applyTranscript(transcriptRef.current);
      transcriptRef.current = '';
      return;
    }
    await start();
  }, [applyTranscript, isListening, start, stop]);

  return { isListening, start, stop, toggle };
}
