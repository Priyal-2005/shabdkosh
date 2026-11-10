// Real queries a Hindi reader would type. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, search, suggest } from '../src/search.js';
import { normDeva, devaToIast } from '../src/translit.js';

const entries = JSON.parse(readFileSync(new URL('../data/entries.json', import.meta.url), 'utf8'));
const index = buildIndex(entries);
const top = (q) => search(index, q)[0]?.entry.headword;
const all = (q) => search(index, q).map((r) => r.entry.headword);

test('Devanagari and romanised input return the same entry (the brief\'s example)', () => {
  for (const q of ['धर्म', 'dharma', 'dharm', 'Dharma', '  dharma  ', 'dharam']) {
    assert.equal(top(q), 'धर्म', q);
  }
});

test('IAST with diacritics works', () => {
  assert.equal(top('śikṣā'), 'शिक्षा');
  assert.equal(top('jñāna'), 'ज्ञान');
  assert.equal(top('vṛkṣa'), 'वृक्ष');
  assert.equal(top('duḥkha'), 'दुःख');
  assert.equal(top('saṃskṛti'), 'संस्कृति');
});

test('spellings that are not in the romanised list still match', () => {
  const cases = {
    shikshaa: 'शिक्षा', // doubled final vowel
    prakesh: 'प्रकाश', // typo
    vrikshaa: 'वृक्ष',
    gyaana: 'ज्ञान',
    gnaan: 'ज्ञान',
    vishvaas: 'विश्वास',
    samaay: 'समय',
    fala: 'फल', // f for ph
    nadii: 'नदी',
    aanandh: 'आनंद',
    sanskriti: 'संस्कृति',
    sanskruthi: 'संस्कृति',
    hridaya: 'हृदय',
    hrday: 'हृदय',
    shaanthi: 'शांति',
    chhotaa: 'छोटा',
    dhanyavaadh: 'धन्यवाद',
    swatantrataa: 'स्वतंत्रता',
    ahinsaa: 'अहिंसा',
    eeshvar: 'ईश्वर',
  };
  for (const [q, want] of Object.entries(cases)) assert.equal(top(q), want, q);
});

test('typos within budget are forgiven', () => {
  assert.equal(top('dharam'), 'धर्म');
  assert.equal(top('vishwsa'), 'विश्वास'); // transposition
  assert.equal(top('parivr'), 'परिवार');
  assert.equal(top('prkash'), 'प्रकाश');
});

test('Devanagari spelling variants fold together', () => {
  assert.equal(top('शान्ति'), 'शांति'); // न् + consonant ≡ anusvara
  assert.equal(top('सुन्दर'), 'सुंदर');
  assert.equal(top('आनन्द'), 'आनंद');
  assert.equal(top('चन्द्र'), 'चंद्र');
  assert.equal(top('दुख'), 'दुःख'); // visarga often dropped
});

test('nukta and chandrabindu are ignored', () => {
  assert.equal(normDeva('ज़'), normDeva('ज'));
  assert.equal(normDeva('\u095B'), normDeva('ज')); // precomposed ज़
  assert.equal(normDeva('माँ'), normDeva('मां'));
});

test('as-you-type prefixes show sensible candidates', () => {
  const pra = all('pra');
  for (const h of ['प्रकाश', 'प्रश्न']) assert.ok(pra.includes(h), `pra → ${h}`);
  const devPra = all('प्र');
  for (const h of ['प्रकाश', 'प्रश्न', 'प्रेम']) assert.ok(devPra.includes(h), `प्र → ${h}`);
});

test('English meanings find entries', () => {
  assert.equal(top('water'), 'जल');
  assert.equal(top('peace'), 'शांति');
  assert.equal(top('go'), 'जाना'); // "to go"
  const teacher = all('teacher');
  assert.ok(teacher.includes('गुरु') && teacher.includes('अध्यापक'));
});

test('headword matches outrank meaning matches', () => {
  // "yoga" is both a romanised headword and an English meaning of योग; "karma" must not lose to a meaning.
  assert.equal(top('yoga'), 'योग');
  assert.equal(top('karma'), 'कर्म');
});

test('garbage gives an empty result, and suggestions stay sane', () => {
  assert.deepEqual(search(index, 'xqzzv'), []);
  assert.deepEqual(search(index, ''), []);
  assert.deepEqual(search(index, '   '), []);
  assert.deepEqual(search(index, '!!!'), []);
  const s = suggest(index, 'dhrmaa').map((e) => e.headword);
  assert.ok(s.includes('धर्म'));
});

test('transliterator handles conjuncts, anusvara and visarga', () => {
  assert.equal(devaToIast('शांति'), 'śānti');
  assert.equal(devaToIast('संस्कृति'), 'saṃskṛti');
  assert.equal(devaToIast('ज्ञान'), 'jñāna');
  assert.equal(devaToIast('दुःख'), 'duḥkha');
  assert.equal(devaToIast('स्वतंत्रता'), 'svatantratā');
});
