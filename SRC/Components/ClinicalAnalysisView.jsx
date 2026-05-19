import React from 'react';
import { Text, View } from 'react-native';

const HEADINGS = [
  { match: /^Assessment$/im, title: 'Assessment' },
  { match: /^Analysis$/im, title: 'Assessment' },
  { match: /^Recommendations$/im, title: 'Recommendations' },
  { match: /^When to seek care$/im, title: 'When to seek care' },
  { match: /^When to Seek Help$/im, title: 'When to seek care' },
];

function parseBlocks(text) {
  return text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/**
 * Renders plain-text clinical output (Assessment / Recommendations / When to seek care).
 */
export default function ClinicalAnalysisView({ text, sectionTitleStyle, bodyStyle, sectionStyle }) {
  if (!text) return null;

  return parseBlocks(text).map((block, index) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const first = lines[0] || '';
    const heading = HEADINGS.find((h) => h.match.test(first));
    const body = heading ? lines.slice(1).join('\n').trim() : block;

    if (heading) {
      return (
        <View key={index} style={sectionStyle}>
          <Text style={sectionTitleStyle}>{heading.title}</Text>
          {body ? <Text style={bodyStyle}>{body}</Text> : null}
        </View>
      );
    }

    return (
      <Text key={index} style={bodyStyle}>
        {block}
      </Text>
    );
  });
}
