import React from 'react';
import { Text, View } from 'react-native';
import { stripMarkdown } from '../utils/formatClinicalResponse';

const HEADINGS = [
  { match: /^Assessment$/i, title: 'Assessment' },
  { match: /^Analysis$/i, title: 'Assessment' },
  { match: /^Dermatological Analysis/i, title: 'Assessment' },
  { match: /^Possible causes$/i, title: 'Possible causes' },
  { match: /^Potential Diagnoses/i, title: 'Possible causes' },
  { match: /^Recommendations$/i, title: 'Recommendations' },
  { match: /^When to seek care$/i, title: 'When to seek care' },
  { match: /^When to Seek Help$/i, title: 'When to seek care' },
];

function cleanLine(line) {
  return stripMarkdown(line).trim();
}

function parseSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const heading = HEADINGS.find((h) => h.match.test(line));
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading.title, body: [] };
      continue;
    }

    if (!current) {
      current = { title: null, body: [] };
    }
    current.body.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

/**
 * Renders plain-text clinical output (Assessment / Possible causes / Recommendations / When to seek care).
 */
export default function ClinicalAnalysisView({ text, sectionTitleStyle, bodyStyle, sectionStyle }) {
  if (!text) return null;

  const sections = parseSections(stripMarkdown(text));

  return sections.map((section, index) => {
    const body = section.body.join('\n').trim();
    if (!body && !section.title) return null;

    if (section.title) {
      return (
        <View key={index} style={sectionStyle}>
          <Text style={sectionTitleStyle}>{section.title}</Text>
          {body ? <Text style={bodyStyle}>{body}</Text> : null}
        </View>
      );
    }

    return (
      <Text key={index} style={bodyStyle}>
        {body}
      </Text>
    );
  });
}
