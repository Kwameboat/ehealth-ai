import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

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
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body style={{ backgroundColor: '#0B1220' }}>{children}</body>
    </html>
  );
}
