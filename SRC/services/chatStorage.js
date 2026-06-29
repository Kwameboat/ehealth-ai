import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = '@ehealth_recent_chats_v1';

export async function saveRecentChatTopic(text) {
  const topic = String(text || '').trim().slice(0, 60);
  if (!topic || topic.length < 4) return;
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [topic, ...list.filter((t) => t !== topic)].slice(0, 5);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export async function loadRecentChatTopics() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
