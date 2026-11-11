# Shabdkosh

A small Hindi dictionary you can search the way people actually type: in Devanagari (धर्म), in IAST (dharma), or in whatever Roman spelling comes to mind (dharm, dharam, Dharma). Built for the Garuda Prakashan × Rishihood live-project assignment, Track 3.

- **Live:** [_Shabdkosh_](https://shabdkosh-ten.vercel.app/)
- **Demo video:** [_Demo_](https://drive.google.com/drive/folders/1w-CHNUHFOK-YG5Gg2r5Y4wPqXpK1Kv7A?usp=sharing)

## Run it

There is no build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# or: npx serve .
```

Open http://localhost:8000. A plain `file://` open won't work because the app loads `data/entries.json` with `fetch`.

Checks:

```sh
npm test            # search tests: real queries, typos, Devanagari variants
npm run validate    # dataset checks (see "The data" below)
```

Both need only Node 18+. There are no dependencies to install.

## What it does

| Brief | Where |
| --- | --- |
| Search by Devanagari and romanised input, same entry | `src/search.js`, `src/translit.js` |
| Entry screen with every field | `#/w/<id>` |
| Works on a phone | single column, 44px touch targets, sticky search box |
| Clear no-results state | says what to try next and shows the closest words, if any are close |
| Bonus: typo tolerance | edit distance on a phonetic key, budget scaled to word length |
| Bonus: offline | service worker caches app, data and self-hosted fonts |
| Bonus: recent searches and bookmarks | stored on the device (`localStorage`) |

Also: English meanings are searchable (`water` → जल), results update as you type, and every entry has a shareable URL.

## Most people will type in Roman

The dataset lists a few spellings per word, but the brief is right that people will type ones that aren't listed. So the `romanised` list is only the first check, not the whole search.

A Latin query goes through four tiers, best first:

1. **Exact spelling.** The query matches a listed romanised spelling or the IAST with accents removed.
2. **Same sound.** Both the query and every known spelling are reduced to a loose phonetic key (`looseKey` in `src/translit.js`) that folds the differences Hindi speakers don't hear as different words:
   - `sh`/`s`/`ś`/`ṣ`
   - long and short vowels (`aa`/`a`, `ee`/`ii`/`i`, `oo`/`u`)
   - aspiration (`dh`/`d`, `th`/`t`, `kh`/`k`)
   - `ph`/`f`, `w`/`v`, `z`/`j`
   - `gy`/`jn`/`gn` for ज्ञ, and `ri`/`ru`/`r` for ृ
   - doubled consonants
   - the final schwa (`shabd`/`shabda`) and `samay`/`samai`

   So `vishvaas`, `gnaan`, `fala`, `hrday` and `sanskruthi` all find their word, though none is in the list.
3. **Prefix.** `pra` already shows प्रकाश and प्रश्न while you type.
4. **Typos.** Edit distance on the key, allowing 1 typo for 3–5 letters and 2 above that. Weak matches are folded under "similar spellings" when there is a strong match, so they never push the right word down.

Devanagari queries are normalised so equivalent spellings match:
- nukta is ignored (ज़ = ज)
- chandrabindu is treated as anusvara (माँ = मां)
- a nasal half-letter before a consonant equals anusvara (सुन्दर = सुंदर, शान्ति = शांति)
- stray zero-width joiners are removed

A dropped visarga (दुख for दुःख) is caught by the typo tier.

`tests/search.test.js` has the real examples. Each one was a case that needed handling.

## The data

`data/entries.json` has 60 entries. Entries 1–10 are the starter data, unchanged; the validator fails if they drift. Entries 11–60 follow the same format. Transliteration uses IAST and keeps the inherent *a* (śabda, karma), as the starter data does, even for words Hindi speakers say without it.

`npm run validate` checks:
- **IAST matches the headword.** It is regenerated from each Devanagari headword and must equal the stored transliteration exactly. This catches typos in either field.
- **Spellings sound like the word.** Each romanised spelling must be plain lower-case ASCII and within a small distance of the IAST's phonetic key.
- **No duplicates or bad tags.** No duplicate ids or headwords; part-of-speech labels come from a fixed set.
- **Examples use the word.** Each example sentence must contain the headword.

The validator cannot judge whether a meaning is right, and it misses a romanised spelling that sounds plausible but is wrong. Meanings and gender were checked by hand; a Hindi or Sanskrit reviewer (Track 1) should still go over them.

## Using the search elsewhere

`src/search.js` and `src/translit.js` are dependency-free ES modules that run in a browser, Node, Deno or a Cloudflare Worker. The same search could sit behind a website widget, an API, or a tool an AI assistant calls:

```js
import { buildIndex, search } from './src/search.js';
const index = buildIndex(entries);
search(index, 'dharm'); // [{ entry: {headword: 'धर्म', ...}, score: 98, how: 'exact' }]
```

## Trade-offs

- **No framework, no build.** The app is about 30 KB of code plus fonts, loads instantly and is easy to read. A larger app with many screens would want components.
- **Everything in the browser.** With 60 entries, search is a linear scan and takes about 0.2 ms. At Garuda's full size (tens of thousands of entries) I'd precompute the keys into an index. A trigram or BK-tree would serve the fuzzy tier.
- **A hand-written phonetic key rather than a learned model.** Every rule can be read and tested, and when it is wrong you can see why. The cost is that rules have edges. `ri` after a consonant folds to `r`, so `priya` and `prya` match; that is harmless here but would add noise in a large dictionary.
- **Self-hosted fonts.** Tiro Devanagari Hindi, made for Indic publishing, renders conjuncts and IAST diacritics properly. It adds ~165 KB, but that cost is paid once and then cached offline.
- **IAST keeps the inherent *a*.** This matches the brief's data. Hindi users usually drop it, and the search handles both.

## With two more weeks

- **Inflected forms.** Searching जाता or जाएगा should find जाना, and बच्चे should find बच्चा. Hindi inflection is regular enough to handle with rules.
- **A Roman-to-Devanagari preview while typing.** For example, `dharm → धर्म`, so people who can read but not type Devanagari can confirm what they're searching for.
- **Voice search.** Many users would rather say the word than spell it.
- **A small JSON API and an embeddable widget.** This is what "integrate into other apps and AI platforms" needs, for example as a tool an AI assistant can call.
- **Search analytics.** Log the queries that find nothing, then add those spellings or words. This is the cheapest way to improve recall on real users.
- **An index for the full dictionary.** Plus tests against a large list of real misspellings.
- **Audio pronunciation for each entry.**

## Credits

Fonts: Tiro Devanagari Hindi (Tiro Typeworks) and Hanken Grotesk, both under the SIL Open Font License; licence files are in `fonts/`. AI use is described in [AI_LOG.md](AI_LOG.md).
