import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import {
  getCanonicalUrl,
  getOgImageUrl,
  getStructuredData,
  GOOGLE_SITE_VERIFICATION,
  SEO,
  SITE_URL,
} from '../SRC/constants/seo';

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

const bingVerification = process.env.EXPO_PUBLIC_BING_SITE_VERIFICATION;

export default function Root({ children }: PropsWithChildren) {
  const canonical = getCanonicalUrl('/');
  const ogImage = getOgImageUrl();
  const structuredData = getStructuredData();

  return (
    <html lang="en-GH">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>{SEO.title}</title>
        <meta name="description" content={SEO.description} />
        <meta name="keywords" content={SEO.keywords} />
        <meta name="author" content={SEO.author} />
        <meta name="robots" content={SEO.robots} />
        <meta name="googlebot" content={SEO.robots} />
        <link rel="canonical" href={canonical} />
        <meta name="theme-color" content="#0052D4" />
        <meta name="application-name" content={SEO.siteName} />
        <meta name="geo.region" content={SEO.region} />
        <meta name="language" content="English" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SEO.siteName} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={SEO.title} />
        <meta property="og:description" content={SEO.description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:locale" content={SEO.locale} />

        {/* Twitter */}
        <meta name="twitter:card" content={SEO.twitterCard} />
        <meta name="twitter:title" content={SEO.title} />
        <meta name="twitter:description" content={SEO.description} />
        <meta name="twitter:image" content={ogImage} />

        {/* Search Console verification (set at build time) */}
        {GOOGLE_SITE_VERIFICATION ? (
          <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
        ) : null}
        {bingVerification ? (
          <meta name="msvalidate.01" content={bingVerification} />
        ) : null}

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={SEO.shortTitle} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="stylesheet" href="/icon-fonts.css" />
        <link rel="preload" href="/fonts/MaterialCommunityIcons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Ionicons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />

        {structuredData.map((graph, i) => (
          <script
            // eslint-disable-next-line react/no-danger
            key={`ld-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
          />
        ))}

        <style dangerouslySetInnerHTML={{ __html: iconFontFaces }} />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body style={{ backgroundColor: '#0B1220' }}>
        <noscript>
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: 24,
              fontFamily: 'system-ui, sans-serif',
              color: '#f1f5f9',
              backgroundColor: '#0B1220',
            }}
          >
            <h1>{SEO.siteName} — AI Health Assistance</h1>
            <p>{SEO.description}</p>
            <h2>Features</h2>
            <ul>
              <li>AI health chat with Agyenim</li>
              <li>Predefined symptom checks (fever, chest pain, allergies, and more)</li>
              <li>Lab results photo and PDF analysis</li>
              <li>Medicine recognition and emergency guidance</li>
            </ul>
            <p>
              <strong>Medical disclaimer:</strong> eHealth AI does not replace a licensed doctor. For emergencies,
              call your local emergency number.
            </p>
            <p>
              <a href={SITE_URL} style={{ color: '#00C9A7' }}>
                Open eHealth AI
              </a>{' '}
              (JavaScript required for the full app).
            </p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
