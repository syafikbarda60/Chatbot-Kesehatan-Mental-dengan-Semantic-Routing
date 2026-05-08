// utils/aiResponses.ts
// All AI response pools and the getAIResponse selector.
// No React imports — pure data + logic.

const RESPONSES = {
  greeting: [
    'Hei, senang kamu di sini 💙 Apa yang ingin kamu ceritakan hari ini?',
    'Halo! Aku siap mendengarkan. Bagaimana perasaanmu sekarang?',
    'Selamat datang ☀️ Ceritakan apapun yang ada di pikiranmu.',
  ],
  general: [
    'Aku dengar kamu... Dan itu pasti tidak mudah. Mau cerita lebih? 🤍',
    'Perasaanmu itu valid. Terima kasih sudah mau berbagi denganku.',
    'Kamu tidak sendirian dalam ini. Ceritakan, aku di sini.',
    'Hmm, aku mengerti. Boleh kamu ceritakan lebih detail?',
    'Kamu sudah sangat kuat dengan mau bercerita. Teruskan. 💪',
    'Aku ingin memahami situasimu lebih dalam. Bisa cerita dari awal?',
  ],
  midStress: [
    'Tarik napas dulu ya... Aku di sini bersamamu. 🌬️',
    'Itu pasti berat. Kapan terakhir kamu benar-benar beristirahat?',
    'Aku ingin memahami lebih — apa yang paling berat dirasakan?',
    'Perasaan itu nyata dan layak diakui. Cerita lagi ya.',
  ],
  highStress: [
    'Aku sangat khawatir, dan aku di sini 💙 Kamu tidak sendirian.',
    'Kamu sangat berani sudah bercerita ini. Jangan tanggung sendiri ya.',
    'Ini penting — bisakah menghubungi seseorang yang kamu percaya sekarang?',
  ],
  encouragement: [
    'Meminta bantuan adalah hal paling kuat yang bisa kamu lakukan ✨',
    'Satu langkah, satu hari. Kamu bisa melewati ini 🌱',
    'Kamu sudah sampai sejauh ini. Itu bukan hal kecil.',
  ],
  contextual: {
    thankYou: 'Sama-sama 💙 Ada yang lain ingin kamu ceritakan?',
    happy: 'Wah, senang dengarnya! 😊 Apa yang membuatmu bahagia hari ini?',
    okFine: 'Biasanya kita bilang "baik-baik saja" tapi dalam hati ada yang dipendam. Apa yang sebenarnya kamu rasakan? 🤍',
  },
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface AIResponseParams {
  userText: string;
  stressLevel: number;
  messageCount: number;
}

/** Pick an appropriate AI reply based on context. */
export function getAIResponse({ userText, stressLevel, messageCount }: AIResponseParams): string {
  const t = userText.toLowerCase();

  if (messageCount <= 1) return pick(RESPONSES.greeting);
  if (stressLevel >= 7)  return pick([...RESPONSES.highStress, ...RESPONSES.encouragement]);
  if (stressLevel >= 4)  return pick(RESPONSES.midStress);

  // Contextual short-circuits
  if (t.includes('makasih') || t.includes('terima kasih')) return RESPONSES.contextual.thankYou;
  if (t.includes('senang')  || t.includes('bahagia'))       return RESPONSES.contextual.happy;
  if (t.includes('ok')      || t.includes('baik-baik'))     return RESPONSES.contextual.okFine;

  return pick(RESPONSES.general);
}

/** Quick-reply option sets, keyed by stress tier. */
export const QUICK_REPLIES: Record<'initial' | 'mid', string[]> = {
  initial: ['Aku tidak baik-baik saja', 'Hanya ingin cerita', 'Aku merasa cemas', 'Aku kesepian'],
  mid:     ['Mau cerita lebih', 'Sudah lama dipendam', 'Aku takut tidak ada yang peduli', 'Bantu aku'],
};
