// Run: npx sucrase-node packages/utils/src/characterReaction.check.ts
import assert from 'node:assert';
import { reactToUserMessage as r, categorize as c } from './characterReaction';

// Safety: distress is always the calm face, whatever else the message contains
for (const t of ['aku ingin mati', 'hari ini aku sedih banget haha', 'aku tidak senang', 'aku gagal ujian',
                 'aku kesepian', 'makasih tapi aku masih cemas', 'wkwk aku capek banget']) {
  assert.equal(r(t), 'tenang', t);
}

assert.equal(c('aku bingung mau mulai dari mana'), 'confused');
assert.equal(c('makasih ya'), 'thanks');
assert.equal(c('kamu baik banget'), 'affection');
assert.equal(c('wkwk lucu'), 'laugh');
assert.equal(c('aku lulus sidang!'), 'achieve');
assert.equal(c('halo sajiwa'), 'greeting');
assert.equal(c('hidup itu apa sih'), 'question');   // "hi" inside "hidup" is not a greeting
assert.equal(c('wah serius?'), 'surprise');
assert.equal(c('ngantuk nih'), 'sleepy');
assert.equal(c('oke siap'), 'agree');
assert.equal(c('udah dulu ya, dadah'), 'goodbye');
assert.equal(c('besok ujian skripsi'), 'study');
assert.equal(c('abis nonton film'), 'fun');
assert.equal(c('aku habis makan'), 'fun');
assert.equal(c('hmm'), 'neutral');

// Variety: same category, different messages -> more than one face
const faces = new Set(['makasih ya', 'makasih banyak', 'terima kasih sajiwa', 'thanks ya', 'makasih loh'].map((t) => r(t)));
assert.ok(faces.size > 1, 'thanks should vary');
// Never repeats the previous face when an alternative exists
assert.notEqual(r('makasih ya', r('makasih ya')), r('makasih ya'));
// Deterministic
assert.equal(r('halo sajiwa'), r('halo sajiwa'));

console.log('characterReaction ok');
