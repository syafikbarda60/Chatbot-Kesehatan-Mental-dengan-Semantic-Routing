// Picks the companion character's expression from what the user just said.
// Safety first: distress always maps to the calm, caring face; playful faces only
// appear for clearly positive messages. Keyword-based, like stressDetection.
// Categories with several fitting faces rotate between them so the character
// doesn't repeat itself; the choice is deterministic (hash of the text) and
// avoids repeating the previous face.

import { KEYWORDS } from './stressDetection';

export type Expression =
  | 'menyapa' | 'senang' | 'tertawa' | 'wink' | 'semangat' | 'tenang'
  | 'berpikir' | 'bingung' | 'terkejut' | 'malu' | 'mengantuk' | 'jempol';

const words = (list: string[]) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

const NEGATED_POSITIVE = /\b(?:tidak|tak|gak|nggak|enggak|ga|kurang|belum)\s+(?:senang|bahagia|seneng|baik|semangat|berhasil|lulus|oke|ok)\b/i;
const SAD = words([
  ...KEYWORDS.high,
  ...KEYWORDS.mid.filter((k) => k !== 'bingung'),
  'kesepian', 'sendirian', 'nangis', 'overthinking', 'insecure', 'deg-degan', 'sebel', 'kesel', 'benci', 'gagal', 'putus',
]);
const CONFUSED = words(['bingung', 'gak ngerti', 'nggak ngerti', 'tidak mengerti', 'gak paham', 'nggak paham', 'tidak paham', 'maksudnya']);
const SLEEPY = words(['ngantuk', 'mengantuk', 'mau tidur', 'selamat tidur', 'good night', 'begadang', 'insomnia']);
const GOODBYE = words(['dadah', 'bye', 'sampai jumpa', 'udah dulu', 'sudah dulu', 'pamit', 'see you']);
const AFFECTION = words([
  '(?:kamu|sajiwa) (?:baik|lucu|keren|hebat|pintar|imut|gemes|manis)',
  'sayang (?:kamu|sajiwa)', 'love you', 'peluk',
]);
const THANKS = words(['makasih', 'terima kasih', 'trims', 'thanks', 'thank you', 'tengkyu', 'thx']);
const AGREE = /^\s*(?:oke|ok|okay|siap|sip|iya|iyaa+|ya|yup|betul|bener|setuju)\b/i;
const LAUGH = /\b(?:haha\w*|hehe\w*|wkwk\w*|lol|ngakak|kocak|lucu)\b/i;
const ACHIEVE = words(['lulus', 'berhasil', 'sukses', 'diterima', 'menang', 'juara', 'selesai', 'akhirnya', 'dapat nilai', 'dapet nilai']);
const HAPPY = words(['senang', 'seneng', 'bahagia', 'lega', 'bangga', 'semangat', 'yay', 'asik', 'asyik', 'mantap', 'keren']);
const FUN = words(['liburan', 'jalan-jalan', 'nonton', 'main', 'makan', 'hobi', 'kopi', 'musik', 'lagu', 'weekend']);
const STUDY = words(['ujian', 'uts', 'uas', 'skripsi', 'sidang', 'tugas', 'kuliah', 'belajar', 'presentasi', 'magang']);
const GREETING = words(['halo', 'hallo', 'hai', 'hei', 'hi', 'hello', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum']);
const SURPRISE = words(['wah', 'wow', 'hah', 'serius', 'beneran', 'astaga', 'masa sih', 'ya ampun']);
const QUESTION = words(['apa', 'apakah', 'bagaimana', 'gimana', 'kenapa', 'mengapa', 'kapan', 'dimana', 'di mana', 'berapa', 'siapa']);

// Several fitting faces per category -> variety without losing meaning
const VARIANTS = {
  sad:      ['tenang'],
  confused: ['bingung', 'berpikir'],
  sleepy:   ['mengantuk'],
  goodbye:  ['menyapa', 'wink'],
  affection:['malu', 'wink'],
  thanks:   ['jempol', 'wink', 'malu'],
  agree:    ['jempol', 'senang'],
  laugh:    ['tertawa', 'wink'],
  achieve:  ['semangat', 'jempol', 'tertawa'],
  happy:    ['semangat', 'senang', 'wink'],
  fun:      ['senang', 'wink', 'semangat'],
  study:    ['semangat', 'jempol'],
  greeting: ['menyapa', 'senang'],
  surprise: ['terkejut'],
  question: ['berpikir', 'bingung'],
  long:     ['berpikir', 'tenang'],
  neutral:  ['senang', 'wink'],
} satisfies Record<string, Expression[]>;

export type ReactionCategory = keyof typeof VARIANTS;

export function categorize(text: string): ReactionCategory {
  const t = text.toLowerCase();
  if (NEGATED_POSITIVE.test(t) || SAD.test(t)) return 'sad';
  if (CONFUSED.test(t)) return 'confused';
  if (SLEEPY.test(t)) return 'sleepy';
  if (GOODBYE.test(t)) return 'goodbye';
  if (AFFECTION.test(t)) return 'affection';
  if (THANKS.test(t)) return 'thanks';
  if (LAUGH.test(t)) return 'laugh';
  if (ACHIEVE.test(t)) return 'achieve';
  if (HAPPY.test(t)) return 'happy';
  if (SURPRISE.test(t)) return 'surprise';
  if (AGREE.test(t)) return 'agree';
  if (GREETING.test(t)) return 'greeting';
  if (t.includes('?') || QUESTION.test(t)) return 'question';
  if (STUDY.test(t)) return 'study';
  if (FUN.test(t)) return 'fun';
  if (t.length > 160) return 'long';
  return 'neutral';
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export function reactToUserMessage(text: string, previous?: Expression): Expression {
  const options: Expression[] = VARIANTS[categorize(text)];
  let i = hash(text.trim().toLowerCase()) % options.length;
  if (options.length > 1 && options[i] === previous) i = (i + 1) % options.length;
  return options[i];
}

// Supportive caption shown under the character.
export const EXPRESSION_STATUS: Record<Expression, string> = {
  menyapa: 'senang bertemu kamu',
  senang: 'mendengarkan',
  tertawa: 'ikut tertawa',
  wink: 'di sini untukmu',
  semangat: 'ikut senang untukmu',
  tenang: 'mendengarkan dengan tenang',
  berpikir: 'sedang memikirkan',
  bingung: 'mencoba memahami',
  terkejut: 'tidak menyangka',
  malu: 'jadi malu',
  mengantuk: 'ikut mengantuk',
  jempol: 'siap, mengerti',
};
