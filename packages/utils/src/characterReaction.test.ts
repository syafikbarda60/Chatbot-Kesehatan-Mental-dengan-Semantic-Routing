// Unit tier — the chat character's reaction to a student message.
import assert from 'node:assert/strict';
import test from 'node:test';
import { categorize, reactToUserMessage as react } from './characterReaction.ts';

const PLAYFUL = ['tertawa', 'wink', 'semangat', 'jempol', 'senang', 'malu', 'menyapa', 'terkejut'];

test('crisis words always get the calm face, whatever else the message contains', () => {
  for (const text of ['aku ingin mati haha', 'makasih tapi aku mau menyerah', 'wkwk aku putus asa', 'aku panik semoga cepat']) {
    assert.equal(react(text), 'tenang', text);
  }
});

test('other distress gets an empathetic face, never a playful one', () => {
  const distressed = [
    'hari ini aku sedih banget haha',
    'aku tidak senang',
    'aku gagal ujian',
    'aku kesepian',
    'makasih tapi aku masih cemas',
    'wkwk aku capek banget',
    'pusing tugas numpuk',
    'aku kecewa sama diriku',
  ];
  for (const text of distressed) {
    assert.ok(!PLAYFUL.includes(react(text)), `${text} -> ${react(text)}`);
  }
});

test('categorizes the kind of message', () => {
  const cases: Array<[string, string]> = [
    ['aku cemas besok presentasi', 'anxious'],
    ['pusing banget deadline', 'overwhelmed'],
    ['gabut nih', 'tired'],
    ['aku kecewa', 'disappointed'],
    ['aku kangen rumah', 'sad'],
    ['semoga besok lancar', 'hope'],
    ['aku bingung mau mulai dari mana', 'confused'],
    ['makasih ya', 'thanks'],
    ['kamu baik banget', 'affection'],
    ['wkwk lucu', 'laugh'],
    ['aku lulus sidang!', 'achieve'],
    ['halo sajiwa', 'greeting'],
    ['hidup itu apa sih', 'question'], // "hi" inside "hidup" is not a greeting
    ['wah serius?', 'surprise'],
    ['ngantuk nih', 'sleepy'],
    ['oke siap', 'agree'],
    ['udah dulu ya, dadah', 'goodbye'],
    ['besok ujian skripsi', 'study'],
    ['abis nonton film', 'fun'],
    ['aku habis makan', 'fun'],
    ['hmm', 'neutral'],
  ];
  for (const [text, expected] of cases) assert.equal(categorize(text), expected, text);
});

test('varies the face within one category and never repeats the previous one', () => {
  const faces = new Set(['makasih ya', 'makasih banyak', 'terima kasih sajiwa', 'thanks ya', 'makasih loh'].map((t) => react(t)));
  assert.ok(faces.size > 1, 'thanks should vary');
  assert.notEqual(react('makasih ya', react('makasih ya')), react('makasih ya'));
});

test('is deterministic for the same input', () => {
  assert.equal(react('halo sajiwa'), react('halo sajiwa'));
});
