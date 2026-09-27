// Picks the companion character's expression from what the user just said.
// Safety first: crisis words always map to the calm face; other distress gets an
// empathetic (never playful) face; playful faces only appear for clearly positive messages. Keyword-based, like stressDetection.
// Categories with several fitting faces rotate between them so the character
// doesn't repeat itself; the choice is deterministic (hash of the text) and
// avoids repeating the previous face.

import { KEYWORDS } from './stressDetection';

export type Expression =
  | 'menyapa' | 'senang' | 'tertawa' | 'wink' | 'semangat' | 'tenang'
  | 'berpikir' | 'bingung' | 'terkejut' | 'malu' | 'mengantuk' | 'jempol'
  | 'sedih' | 'kecewa' | 'cemas' | 'pusing' | 'bosan' | 'harapan';

/** Empathetic faces for heavy moments: animate softly, no playful tap faces. */
export const HEAVY_EXPRESSIONS: readonly Expression[] = ['tenang', 'sedih', 'kecewa', 'cemas'];
export const isHeavy = (e: Expression) => HEAVY_EXPRESSIONS.includes(e);

const words = (list: string[]) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

const NEGATED_POSITIVE = /\b(?:tidak|tak|gak|nggak|enggak|ga|kurang|belum)\s+(?:senang|bahagia|seneng|baik|semangat|berhasil|lulus|oke|ok)\b/i;
const CRISIS = words(KEYWORDS.high);
// Split out of KEYWORDS.mid so the face can match the feeling; anything left in mid falls to SAD
const ANXIOUS = words(['cemas', 'khawatir', 'takut', 'gelisah', 'overthinking', 'insecure', 'deg-degan', 'was-was', 'grogi', 'nervous']);
const OVERWHELMED = words(['pusing', 'mumet', 'stres', 'stress', 'frustasi', 'tertekan', 'numpuk', 'banyak banget tugas', 'deadline']);
const TIRED = words(['lelah', 'capek', 'cape', 'letih', 'lesu', 'bosan', 'bosen', 'gabut', 'males', 'malas', 'tidak semangat', 'hampa', 'kosong']);
const DISAPPOINTED = words(['kecewa', 'gagal', 'ditolak', 'nyesel', 'menyesal', 'sebel', 'kesel', 'kesal', 'marah', 'benci']);
const SAD = words([
  ...KEYWORDS.mid.filter((k) => k !== 'bingung'),
  'kesepian', 'sendirian', 'nangis', 'putus', 'patah hati', 'kangen', 'rindu',
]);
const HOPE = words(['semoga', 'mudah-mudahan', 'moga', 'berharap', 'harapan', 'pengen', 'pengin', 'ingin', 'cita-cita', 'mimpi', 'target', 'rencana', 'aamiin', 'amin']);
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
  crisis:   ['tenang'],
  anxious:  ['cemas', 'tenang'],
  overwhelmed: ['pusing', 'tenang'],
  tired:    ['bosan', 'mengantuk'],
  disappointed: ['kecewa', 'tenang'],
  sad:      ['sedih', 'kecewa', 'tenang'],
  hope:     ['harapan', 'semangat'],
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
  if (CRISIS.test(t)) return 'crisis';
  if (ANXIOUS.test(t)) return 'anxious';
  if (OVERWHELMED.test(t)) return 'overwhelmed';
  if (DISAPPOINTED.test(t)) return 'disappointed';
  if (SAD.test(t)) return 'sad';
  if (TIRED.test(t)) return 'tired';
  if (NEGATED_POSITIVE.test(t)) return 'sad';
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
  if (HOPE.test(t)) return 'hope';
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
  sedih: 'ikut merasakan',
  kecewa: 'ikut menyayangkan',
  cemas: 'peduli padamu',
  pusing: 'ikut memilah pelan-pelan',
  bosan: 'menemanimu santai',
  harapan: 'ikut berharap',
};
