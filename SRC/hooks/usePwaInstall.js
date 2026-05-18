import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const PWA_INSTALLED_KEY = '@pwa_user_installed';
const PWA_DISMISS_KEY = '@pwa_install_dismissed_until';

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

function isIosBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const deferredPromptRef = useRef(null);
  const [state, setState] = useState({
    isWeb: Platform.OS === 'web',
    isStandalone: false,
    wasInstalled: false,
    canInstall: false,
    isIos: false,
    visible: false,
    /** 'install' | 'open-app' */
    mode: 'install',
  });

  const checkDismissed = useCallback(async () => {
    const dismissUntil = await AsyncStorage.getItem(PWA_DISMISS_KEY);
    if (!dismissUntil) return false;
    return Date.now() < Number(dismissUntil);
  }, []);

  const hidePrompt = useCallback(async (hours = 24) => {
    const until = Date.now() + hours * 60 * 60 * 1000;
    await AsyncStorage.setItem(PWA_DISMISS_KEY, String(until));
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const showIfAllowed = useCallback(
    async (patch) => {
      if (await checkDismissed()) return;
      setState((s) => ({ ...s, ...patch, visible: true }));
    },
    [checkDismissed]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const ios = isIosBrowser();

    const bootstrap = async () => {
      const standalone = isStandaloneMode();
      const wasInstalled = (await AsyncStorage.getItem(PWA_INSTALLED_KEY)) === 'true';

      if (standalone) {
        await AsyncStorage.setItem(PWA_INSTALLED_KEY, 'true');
        setState((s) => ({
          ...s,
          isStandalone: true,
          wasInstalled: true,
          visible: false,
          isIos: ios,
        }));
        return;
      }

      if (wasInstalled) {
        await showIfAllowed({
          isStandalone: false,
          wasInstalled: true,
          mode: 'open-app',
          isIos: ios,
        });
        return;
      }

      setState((s) => ({ ...s, isIos: ios, wasInstalled: false }));

      if (ios) {
        setTimeout(() => {
          showIfAllowed({ mode: 'install', isIos: true });
        }, 2500);
      } else {
        setTimeout(() => {
          setState((s) => {
            if (s.canInstall || s.isStandalone || s.wasInstalled) return s;
            return s;
          });
          showIfAllowed({ mode: 'install', isIos: false });
        }, 3500);
      }
    };

    bootstrap();

    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      showIfAllowed({ canInstall: true, mode: 'install' });
    };

    const onAppInstalled = async () => {
      await AsyncStorage.setItem(PWA_INSTALLED_KEY, 'true');
      deferredPromptRef.current = null;
      setState((s) => ({
        ...s,
        canInstall: false,
        visible: false,
        wasInstalled: true,
      }));
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [showIfAllowed]);

  const install = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return false;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
      await AsyncStorage.setItem(PWA_INSTALLED_KEY, 'true');
      deferredPromptRef.current = null;
      setState((s) => ({ ...s, visible: false, canInstall: false, wasInstalled: true }));
      return true;
    }

    return false;
  }, []);

  const continueInBrowser = useCallback(() => hidePrompt(12), [hidePrompt]);

  return {
    ...state,
    install,
    dismiss: hidePrompt,
    continueInBrowser,
  };
}
