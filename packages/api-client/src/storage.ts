import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem('sanctuary_token', token);
  } else {
    await AsyncStorage.setItem('sanctuary_token', token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem('sanctuary_token');
  } else {
    return await AsyncStorage.getItem('sanctuary_token');
  }
}

export async function saveUser(user: object) {
  if (Platform.OS === 'web') {
    localStorage.setItem('sanctuary_user', JSON.stringify(user));
  } else {
    await AsyncStorage.setItem('sanctuary_user', JSON.stringify(user));
  }
}

export async function getStoredUser<T = Record<string, unknown>>(): Promise<T | null> {
  let raw: string | null = null;
  if (Platform.OS === 'web') {
    raw = localStorage.getItem('sanctuary_user');
  } else {
    raw = await AsyncStorage.getItem('sanctuary_user');
  }
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  if (Platform.OS === 'web') {
    localStorage.removeItem('sanctuary_token');
    localStorage.removeItem('sanctuary_user');
  } else {
    await AsyncStorage.multiRemove(['sanctuary_token', 'sanctuary_user']);
  }
}

// Sync access for web dashboard that used sync calls
export function getStoredUserSync<T = Record<string, unknown>>(): T | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('sanctuary_user');
    return raw ? JSON.parse(raw) : null;
  }
  return null;
}

export function clearAuthSync() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sanctuary_token');
    localStorage.removeItem('sanctuary_user');
  }
}
