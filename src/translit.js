// Script handling for Devanagari and romanised Hindi/Sanskrit.
// Pure functions, no DOM — used by the app, the tests and the data validator.

const VIRAMA = '्';
const NUKTA = '़';
const ANUSVARA = 'ं';
const CHANDRABINDU = 'ँ';
const VISARGA = 'ः';

const CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ',
  'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ñ',
  'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h', 'ळ': 'ḷ',
};

// Consonant + nukta (Urdu/Persian sounds). NFC decomposes the precomposed
// forms (U+0958–U+095F), so we always see base + U+093C.
const NUKTA_FORMS = {
  'क': 'q', 'ख': 'x', 'ग': 'ġ', 'ज': 'z', 'ड': 'ṛ', 'ढ': 'ṛh', 'फ': 'f', 'य': 'y',
};

const VOWELS = {
  'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū', 'ऋ': 'ṛ',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'ô', 'ऍ': 'ê',
};

const MATRAS = {
  'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'ô', 'ॅ': 'ê',
};

// Anusvara is written as the nasal of the following consonant's class (IAST practice,
// and what the brief's own data does: शांति → śānti).
const NASAL_FOR = {};
for (const c of 'कखगघ') NASAL_FOR[c] = 'ṅ';
for (const c of 'चछजझ') NASAL_FOR[c] = 'ñ';
for (const c of 'टठडढ') NASAL_FOR[c] = 'ṇ';
for (const c of 'तथदध') NASAL_FOR[c] = 'n';
for (const c of 'पफबभ') NASAL_FOR[c] = 'm';

const DEVA_RE = /[ऀ-ॿ]/;

export function isDevanagari(s) {
  return DEVA_RE.test(s);
}

/** Devanagari → IAST, keeping the inherent "a" (the convention the brief's data uses). */
export function devaToIast(input) {
  const s = input.normalize('NFC');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (CONSONANTS[ch] !== undefined) {
      let roman = CONSONANTS[ch];
      if (s[i + 1] === NUKTA) {
        roman = NUKTA_FORMS[ch] ?? roman;
        i++;
      }
      out += roman;
      const next = s[i + 1];
      if (next === VIRAMA) { i++; continue; }
      if (MATRAS[next] !== undefined) { out += MATRAS[next]; i++; continue; }
      out += 'a';
      continue;
    }
    if (VOWELS[ch] !== undefined) { out += VOWELS[ch]; continue; }
    if (ch === ANUSVARA) {
      const nextCons = s[i + 1];
      out += NASAL_FOR[nextCons] ?? 'ṃ';
      continue;
    }
    if (ch === CHANDRABINDU) { out += 'm̐'; continue; }
    if (ch === VISARGA) { out += 'ḥ'; continue; }
    if (ch === NUKTA || ch === '‌' || ch === '‍') continue;
    if (ch === '।') { out += '.'; continue; }
    out += ch;
  }
  return out;
}

/**
 * Canonical form of Devanagari text for matching. Folds spellings that a
 * reader treats as the same word:
 *  - nukta dropped (ज़ ≡ ज)
 *  - chandrabindu → anusvara (माँ ≡ मां)
 *  - nasal consonant + virama before a consonant → anusvara (सुन्दर ≡ सुंदर)
 *  - ZWJ/ZWNJ, spaces and punctuation removed
 */
export function normDeva(input) {
  let s = input.normalize('NFC');
  s = s.replace(/[क़-य़]/g, (c) => c.normalize('NFD'));
  s = s.replace(/़/g, '');
  s = s.replace(/ँ/g, ANUSVARA);
  s = s.replace(/[ङञणनम]्(?=[क-ह])/g, ANUSVARA);
  s = s.replace(/[‌‍]/g, '');
  s = s.replace(/[^ऀ-ॿ]/g, '');
  s = s.replace(/[।॥]/g, '');
  return s;
}

/**
 * Loose phonetic key for anything typed in Latin script (or IAST).
 * Two spellings a Hindi speaker would read the same way should get the
 * same key: dharm/dharma/dharam? (not quite — see fuzzy), shiksha/siksha/śikṣā,
 * gyan/jnana/jñāna, phal/fal, vishwas/viśvāsa, samay/samai, nadee/nadi.
 */
export function looseKey(input) {
  let s = input.toLowerCase().normalize('NFC');

  // IAST letters with their own sounds, before diacritics are stripped.
  s = s
    .replace(/ṛ|r̥|ṝ/g, 'ri')
    .replace(/[śṣ]/g, 'sh')
    .replace(/[ṅñṇṃ]|m̐/g, 'n')
    .replace(/ḥ/g, 'h');

  // Strip remaining diacritics: ā→a, ṭ→t, ḍ→d ...
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[^a-z]/g, '');

  s = s
    .replace(/x/g, 'ksh')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/w/g, 'v')
    .replace(/f/g, 'ph')
    .replace(/(jn|gn|jny)/g, 'gy') // jñ, gn, jn → gy  (ज्ञ)
    .replace(/chh/g, 'ch');

  // Vowel length: aa/ā, ee/ii/ī, oo/uu/ū all fold to short.
  s = s.replace(/aa+/g, 'a').replace(/(ee|ii)+/g, 'i').replace(/(oo|uu)+/g, 'u');

  // ऋ is typed ri / ru / r — after a consonant, fold to plain r.
  s = s.replace(/([bcdghjklmnpstvy])r[iu](?=[^aeiou]|$)/g, '$1r');

  // Aspiration: kh→k, sh→s, dh→d ... and h before a consonant (duḥkha → dukh).
  s = s.replace(/([bcdgjkprst])h/g, '$1');
  s = s.replace(/(?<=[aeiou])h(?=[bcdfgjklmnpqrstvxyz])/g, '');

  // m before s/h is how anusvara is often typed (samskriti ≡ sanskriti).
  s = s.replace(/m(?=[sh])/g, 'n');

  // Doubled consonants: uttar ≡ utar.
  s = s.replace(/([b-df-hj-np-tv-z])\1+/g, '$1');

  // Final schwa / long a (shabda ≡ shabd, bhasha ≡ bhash): drop one trailing a.
  if (s.length > 2) s = s.replace(/a$/, '');
  // samay ≡ samai, namastey ≡ namaste
  s = s.replace(/ay$/, 'ai').replace(/ey$/, 'e');
  return s;
}

/** Plain lower-case ASCII, for exact matching on what the user typed. */
export function asciiFold(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}
