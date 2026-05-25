/**
 * Central SEO / indexing config for web build and static files.
 * Set EXPO_PUBLIC_SITE_URL=https://www.ehealthaigh.com in production builds.
 */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL || 'https://www.ehealthaigh.com'
).replace(/\/$/, '');

/** Google Search Console HTML tag verification (content value only) */
export const GOOGLE_SITE_VERIFICATION =
  process.env.EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION ||
  'EVGPzHgfdl7PWlqlelkWFexwIwDKMB2rVrO7sIGZ5N8';

export const SEO = {
  siteName: 'eHealth AI',
  title:
    'eHealth AI | AI Health Assistant — Symptom Checker, Lab Results & Medical Chat (Ghana)',
  shortTitle: 'eHealth AI — AI Health Assistance',
  description:
    'eHealth AI is your AI health assistant in Ghana. Chat with Agyenim for symptom guidance, analyze lab results, check predefined conditions (fever, chest pain, allergies), medicine recognition, and emergency health info. Not a substitute for a licensed doctor.',
  keywords: [
    'eHealth AI',
    'AI health assistant Ghana',
    'symptom checker',
    'medical chatbot',
    'lab results explanation',
    'telehealth Ghana',
    'health app Ghana',
    'Agyenim AI doctor assistant',
    'online health advice',
    'medical AI',
  ].join(', '),
  locale: 'en_GH',
  region: 'GH',
  twitterCard: 'summary_large_image',
  ogImagePath: '/icons/icon-512.png',
  author: 'eHealth AI',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
};

export function getCanonicalUrl(path = '/') {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${p === '/' ? '/' : p}`;
}

export function getOgImageUrl() {
  return `${SITE_URL}${SEO.ogImagePath}`;
}

/** JSON-LD graphs for rich results */
export function getStructuredData() {
  const url = SITE_URL;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SEO.siteName,
      url,
      logo: getOgImageUrl(),
      description: SEO.description,
      areaServed: { '@type': 'Country', name: 'Ghana' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SEO.siteName,
      url,
      description: SEO.description,
      inLanguage: 'en-GH',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${url}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SEO.siteName,
      url,
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web, Android, iOS',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GHS' },
      description: SEO.description,
      browserRequirements: 'Requires JavaScript. HTTPS.',
      featureList: [
        'AI health chat with Agyenim',
        'Predefined symptom analysis',
        'Lab results upload and explanation',
        'Medicine recognition',
        'Emergency health guidance',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is eHealth AI?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'eHealth AI is an AI-powered health assistance app that helps you understand symptoms, lab results, and general health questions through guided chat and analysis. It is not a replacement for a licensed medical professional.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is eHealth AI available in Ghana?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. eHealth AI is built for users in Ghana and supports local payment for points via Paystack in GHS.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can eHealth AI diagnose my condition?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. eHealth AI provides educational health information and guidance only. Always consult a qualified doctor for diagnosis and treatment.',
          },
        },
      ],
    },
  ];
}
