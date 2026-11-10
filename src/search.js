// Search over dictionary entries. Pure module: works in the browser and in Node.
import { asciiFold, devaToIast, isDevanagari, looseKey, normDeva } from './translit.js';
import { distance } from './distance.js';

export { distance };

/** How many typos we forgive for a query of this length. */
function allowedTypos(len) {
  if (len <= 2) return 0;
  if (len <= 5) return 1;
  return 2;
}

/** Precompute everything the search needs for each entry. */
export function buildIndex(entries) {
  return entries.map((entry) => {
    const spellings = new Set([entry.transliteration, devaToIast(entry.headword), ...entry.romanised]);
    return {
      entry,
      deva: normDeva(entry.headword),
      ascii: new Set([...spellings].map(asciiFold)),
      keys: new Set([...spellings].map(looseKey)),
      meanings: entry.meanings.map((m) => m.toLowerCase()),
    };
  });
}

/**
 * Search the index. Returns [{ entry, score, how }] best first.
 * `how` says why it matched — shown in the UI so a fuzzy hit is never a mystery.
 */
export function search(index, rawQuery, { limit = 20 } = {}) {
  const query = rawQuery.trim();
  if (!query) return [];
  const results = [];

  if (isDevanagari(query)) {
    const q = normDeva(query);
    if (!q) return [];
    const typos = allowedTypos([...q].length);
    for (const item of index) {
      let score = 0;
      let how = '';
      if (item.deva === q) { score = 100; how = 'exact'; }
      else if (item.deva.startsWith(q)) { score = 70 + 20 * (q.length / item.deva.length); how = 'prefix'; }
      else if (typos) {
        const d = distance(q, item.deva);
        if (d <= typos) { score = 40 - 10 * d; how = 'spelling'; }
      }
      if (score) results.push({ entry: item.entry, score, how });
    }
  } else {
    const ascii = asciiFold(query);
    const key = looseKey(query);
    const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const typos = allowedTypos(key.length);
    for (const item of index) {
      let score = 0;
      let how = '';
      if (item.ascii.has(ascii)) { score = 98; how = 'exact'; }
      else if (item.keys.has(key)) { score = 92; how = 'sounds-like'; }
      else {
        // As-you-type: "pra" should already show prakāśa, praśna ...
        for (const k of item.keys) {
          if (key.length >= 2 && k.startsWith(key)) {
            score = Math.max(score, 60 + 20 * (key.length / k.length));
            how = 'prefix';
          }
        }
        if (!score && typos) {
          let best = Infinity;
          for (const k of item.keys) best = Math.min(best, distance(key, k));
          if (best <= typos) { score = 45 - 10 * best; how = 'spelling'; }
        }
      }
      // English meanings: "water" finds जल. Ranked below headword hits.
      const meaningScore = scoreMeanings(item.meanings, words);
      if (meaningScore > score) { score = meaningScore; how = 'meaning'; }
      if (score) results.push({ entry: item.entry, score, how });
    }
  }

  results.sort((a, b) => b.score - a.score || a.entry.id - b.entry.id);
  return results.slice(0, limit);
}

function scoreMeanings(meanings, words) {
  if (!words.length) return 0;
  const phrase = words.join(' ');
  let best = 0;
  for (const m of meanings) {
    if (m === phrase || m === `to ${phrase}`) best = Math.max(best, 85);
    else if (phrase.length >= 3 && m.split(/\s+/).some((w) => w === phrase)) best = Math.max(best, 75);
    else if (phrase.length >= 3 && m.startsWith(phrase)) best = Math.max(best, 55);
  }
  return best;
}

/** For the no-results screen: the closest headwords, however far. */
export function suggest(index, rawQuery, n = 3) {
  const query = rawQuery.trim();
  if (!query) return [];
  const deva = isDevanagari(query);
  const q = deva ? normDeva(query) : looseKey(query);
  return index
    .map((item) => {
      const d = deva
        ? distance(q, item.deva)
        : Math.min(...[...item.keys].map((k) => distance(q, k)));
      return { entry: item.entry, d };
    })
    .filter((x) => x.d <= Math.max(2, Math.ceil(q.length / 2)))
    .sort((a, b) => a.d - b.d || a.entry.id - b.entry.id)
    .slice(0, n)
    .map((x) => x.entry);
}
