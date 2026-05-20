import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Matches @expo/vector-icons font family names — served from /fonts/ (see scripts/copy-icon-fonts.mjs) */
const iconFontFaces = `
@font-face {
  font-family: 'material-community';
  src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'ionicons';
  src: url('/fonts/Ionicons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'feather';
  src: url('/fonts/Feather.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'material';
  src: url('/fonts/MaterialIcons.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'FontAwesome5Free-Solid';
  src: url('/fonts/FontAwesome5_Solid.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'FontAwesome5Free-Regular';
  src: url('/fonts/FontAwesome5_Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;

const swRegister = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn('SW registration failed:', err);
    });
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0052D4" />
        <meta name="description" content="AI-powered medical assistant for symptoms, chat, and health guidance." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="eHealth AI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="stylesheet" href="/icon-fonts.css" />
        <link rel="preload" href="/fonts/MaterialCommunityIcons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Ionicons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: iconFontFaces }} />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body style={{ backgroundColor: '#0B1220' }}>{children}</body>
    </html>
  );
}
