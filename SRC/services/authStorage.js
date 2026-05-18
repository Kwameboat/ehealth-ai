import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'medassistant_user_token';
const USER_KEY = 'medassistant_user';

export async function getStoredToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveSession(token, user) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
