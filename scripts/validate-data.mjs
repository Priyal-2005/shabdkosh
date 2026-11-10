// Checks data/entries.json for mistakes the brief says count against us.
// Run: node scripts/validate-data.mjs
import { readFileSync } from 'node:fs';
import { devaToIast, looseKey, normDeva } from '../src/translit.js';
import { distance } from '../src/distance.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const entries = read('../data/entries.json');
const seed = read('../data/seed.json');

const errors = [];
const warnings = [];
const POS = new Set(['noun (m.)', 'noun (f.)', 'adjective', 'verb', 'adverb', 'interjection', 'pronoun']);

if (entries.length < 50) errors.push(`only ${entries.length} entries; brief asks for at least 50`);

// The 10 starter entries must be untouched.
for (const s of seed) {
  const e = entries.find((x) => x.id === s.id);
  if (JSON.stringify(e) !== JSON.stringify(s)) errors.push(`starter entry ${s.id} was changed`);
}

const ids = new Set();
const heads = new Set();
for (const e of entries) {
  const tag = `#${e.id} ${e.headword}`;
  for (const f of ['id', 'headword', 'transliteration', 'romanised', 'pos', 'meanings', 'example']) {
    if (e[f] === undefined || e[f] === '' || (Array.isArray(e[f]) && !e[f].length)) errors.push(`${tag}: missing ${f}`);
  }
  if (ids.has(e.id)) errors.push(`${tag}: duplicate id`);
  if (heads.has(normDeva(e.headword))) errors.push(`${tag}: duplicate headword`);
  ids.add(e.id);
  heads.add(normDeva(e.headword));

  if (!/^[ऀ-ॿ]+$/.test(e.headword)) errors.push(`${tag}: headword is not pure Devanagari`);
  if (!POS.has(e.pos)) errors.push(`${tag}: unexpected pos "${e.pos}"`);

  // The IAST must be what the headword actually spells.
  const generated = devaToIast(e.headword);
  if (generated !== e.transliteration.normalize('NFC')) {
    errors.push(`${tag}: transliteration "${e.transliteration}" but headword spells "${generated}"`);
  }

  // Every romanised spelling must be plain lower-case ASCII and sound like the word.
  const target = looseKey(e.transliteration);
  for (const r of e.romanised) {
    if (!/^[a-z]+$/.test(r)) errors.push(`${tag}: romanised "${r}" is not lower-case ASCII`);
    const d = distance(looseKey(r), target);
    if (d > 2) errors.push(`${tag}: romanised "${r}" is far from ${e.transliteration} (distance ${d})`);
  }
  if (new Set(e.romanised).size !== e.romanised.length) errors.push(`${tag}: duplicate romanised spellings`);

  if (!/[।?!]$/.test(e.example)) warnings.push(`${tag}: example has no closing punctuation`);
  if (!normDeva(e.example).includes(normDeva(e.headword))) warnings.push(`${tag}: example does not contain the headword`);
}

for (const w of warnings) console.log('warn ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`${entries.length} entries, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
