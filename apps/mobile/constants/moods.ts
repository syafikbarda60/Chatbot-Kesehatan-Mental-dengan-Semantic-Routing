// Journal moods. DB stores the English `key`; UI shows the Indonesian label.
// Colors are darkened so they pass 4.5:1 as text on the #E4E8EE background.
import type { Expression } from '@prototype/utils';

export type Mood = 'Calm' | 'Anxious' | 'Focused' | 'Tired';

export const MOODS: { key: Mood; label: string; icon: any; color: string }[] = [
  { key: 'Calm',    label: 'Tenang', icon: 'leaf-outline',         color: '#336B4B' },
  { key: 'Focused', label: 'Fokus',  icon: 'disc-outline',         color: '#26356E' },
  { key: 'Tired',   label: 'Lelah',  icon: 'battery-half-outline', color: '#7C5C0D' },
  { key: 'Anxious', label: 'Cemas',  icon: 'cloud-outline',        color: '#9f403d' },
];

export const moodOf = (key?: string | null) => MOODS.find((m) => m.key === key);
export const moodColor = (key?: string | null) => moodOf(key)?.color;

// How the companion responds to a mood: its face, what it says while you write,
// and how it reflects on an entry you wrote earlier.
export const MOOD_COMPANION: Record<Mood, { face: Expression; writing: string; looking: string }> = {
  Calm: {
    face: 'senang',
    writing: 'Senang dengarnya. Apa yang bikin harimu terasa tenang?',
    looking: 'Hari itu kamu merasa tenang. Momen seperti ini layak diingat.',
  },
  Focused: {
    face: 'semangat',
    writing: 'Mantap! Apa yang sedang kamu kerjakan dengan sepenuh hati?',
    looking: 'Hari itu kamu fokus dan terarah. Ingat lagi apa yang membantumu.',
  },
  Tired: {
    face: 'mengantuk',
    writing: 'Capek itu wajar. Tulis sedikit saja juga sudah cukup.',
    looking: 'Hari itu kamu lelah. Semoga sekarang kamu sudah lebih beristirahat.',
  },
  Anxious: {
    face: 'cemas',
    writing: 'Aku di sini. Tulis pelan-pelan apa yang membuatmu cemas.',
    looking: 'Hari itu terasa berat. Terima kasih sudah jujur menuliskannya.',
  },
};

// Daily writing prompt, shared by the journal list and the editor so both show the same question
export const JOURNAL_PROMPTS = [
  'Apa yang paling kamu syukuri hari ini?',
  'Apa yang sedang membebani pikiranmu?',
  'Momen kecil apa yang membuatmu tersenyum?',
];
export const todayPrompt = () => JOURNAL_PROMPTS[new Date().getDay() % JOURNAL_PROMPTS.length];
