// utils/stressDetection.ts
// Pure function — no side effects. Takes message list, returns 0–10 stress score.

import type { Message } from '../components/chat/ChatBubble';

const KEYWORDS = {
  high: [
    'putus asa', 'tidak ada harapan', 'mau mati', 'ingin mati', 'bunuh diri',
    'tidak kuat lagi', 'menyerah', 'hancur', 'sangat tertekan', 'panik', 'krisis',
    'tak sanggup', 'depresi berat',
  ],
  mid: [
    'sedih', 'menangis', 'stres', 'stress', 'cemas', 'khawatir', 'takut',
    'lelah', 'capek', 'galau', 'bingung', 'kecewa', 'frustasi', 'marah',
    'kesal', 'gelisah', 'susah tidur', 'tidak fokus', 'tidak semangat',
    'hampa', 'kosong', 'tertekan',
  ],
  low: ['baik', 'oke', 'lumayan', 'biasa', 'sedikit', 'sudah lebih', 'lebih baik'],
};

/** Returns stress level 0–10 based on the last 5 user messages. */
export function analyzeStress(messages: Message[]): number {
  const userTexts = messages
    .filter((m) => m.sender === 'user')
    .map((m) => m.text.toLowerCase());

  if (userTexts.length === 0) return 0;

  let score = 0;
  const window = userTexts.slice(-5);

  for (const text of window) {
    for (const kw of KEYWORDS.high) if (text.includes(kw)) score += 3.5;
    for (const kw of KEYWORDS.mid)  if (text.includes(kw)) score += 1.5;
    for (const kw of KEYWORDS.low)  if (text.includes(kw)) score -= 0.5;
  }

  // Normalize: fewer messages → less aggressive scaling
  const factor = Math.min(userTexts.length / 3, 2.5);
  return Math.round(Math.min(10, Math.max(0, score / factor)) * 10) / 10;
}

/** Categorize level to a named tier. */
export type StressTier = 'low' | 'mid' | 'high';
export function getStressTier(level: number): StressTier {
  if (level <= 3) return 'low';
  if (level <= 6) return 'mid';
  return 'high';
}
