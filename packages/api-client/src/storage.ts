import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// MASVS-STORAGE-1: on the phone the token and the profile (name, email, NIM) live in
// SecureStore, which encrypts them with a key held by Android Keystore / iOS Keychain.
// AsyncStorage is a plain SQLite file anyone with the device backup or root can read.
// The web build keeps localStorage — the browser has no keystore to offer.
const TOKEN = 'sajiwa_token';
const USER = 'sajiwa_user';
const CHAT = 'sajiwa_chat_session';

async function secureGet(key: string): Promise<string | null> {
  const value = await SecureStore.getItemAsync(key);
  if (value !== null) return value;
  // Installs from before this change still hold a plaintext copy: move it once, then drop it
  const legacy = await AsyncStorage.getItem(key);
  if (legacy !== null) {
    await SecureStore.setItemAsync(key, legacy);
    await AsyncStorage.removeItem(key);
  }
  return legacy;
}

export async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN, token);
  } else {
    await SecureStore.setItemAsync(TOKEN, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN);
  }
  return await secureGet(TOKEN);
}

export async function saveUser(user: object) {
  if (Platform.OS === 'web') {
    localStorage.setItem(USER, JSON.stringify(user));
  } else {
    await SecureStore.setItemAsync(USER, JSON.stringify(user));
  }
}

export async function getStoredUser<T = Record<string, unknown>>(): Promise<T | null> {
  const raw = Platform.OS === 'web' ? localStorage.getItem(USER) : await secureGet(USER);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER);
    localStorage.removeItem(CHAT);
  } else {
    await SecureStore.deleteItemAsync(TOKEN);
    await SecureStore.deleteItemAsync(USER);
    // Legacy plaintext copies too, in case they were never migrated
    await AsyncStorage.multiRemove([TOKEN, USER, CHAT]);
  }
}

// ── Chat session pointer ──────────────────────────────────────────────────────
// Only the id lives on the device; the transcript stays encrypted in Postgres. Cleared on
// logout so the next student on a shared device never resumes someone else's session.

export async function saveChatSessionId(id: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(CHAT, id);
  } else {
    await AsyncStorage.setItem(CHAT, id);
  }
}

export async function getChatSessionId(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(CHAT);
  }
  return await AsyncStorage.getItem(CHAT);
}

// Sync access for web dashboard that used sync calls
export function getStoredUserSync<T = Record<string, unknown>>(): T | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(USER);
    return raw ? JSON.parse(raw) : null;
  }
  return null;
}

export function clearAuthSync() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER);
    localStorage.removeItem(CHAT);
  }
}
