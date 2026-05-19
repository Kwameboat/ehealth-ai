import * as Font from 'expo-font';
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';

/** Preload icon fonts used across the medical dashboard (web + native). */
export function loadAppIconFonts() {
  return Font.loadAsync({
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
    ...Feather.font,
    ...MaterialIcons.font,
  });
}
