# AI log

## Tools used

- **Claude (Opus 5.5), in the Claude app.** It worked agentically: reading the brief, writing the code and data, running tests and taking screenshots in a sandbox. It committed as it went; its commits carry a `Co-Authored-By: Claude` trailer.
- **Headless Chrome (Playwright).** Claude used it to screenshot the app at phone size in light and dark mode, and to test offline mode.

## Key prompts

1. Shared the assignment announcement and brief link: *"I want to work on the track 3 for developers"*.
2. Shared the brief link again once I'd signed in, so Claude could read the Track 3 page.

<!-- Add any further prompts you give, e.g. changes you ask for after reviewing. -->

## What the AI produced

- **Dataset.** Entries 11–60, following the starter format.
- **Search.** Devanagari normalisation, a phonetic key for Roman spellings, prefix matching, typo tolerance and English-meaning search, plus the tests.
- **App.** A static web app with a service worker for offline use, saved words and recent searches.
- **Docs.** A first draft of the README and this log.

## Decisions and fixes, and why

Some were made while drafting, the rest after checking the output (tests, screenshots):

| Change | Why |
| --- | --- |
| Left out अग्नि and वायु; used पशु and वन instead | Their gender is masculine in Sanskrit but usually feminine in Hindi. Rather than risk a "wrong meaning" mark, swapped them for unambiguous words. |
| Wrote the आना and देना examples with the infinitive itself | An inflected form (आएगा) wouldn't show the headword. The validator now checks every example contains it. |
| Tightened the "closest words" threshold | Screenshots showed gibberish (`xyzzq`) suggesting सुख. Now about one edit per three letters, with a test. |
| Folded weak typo matches under "similar spellings" | Looking at results for short queries (`ban`, `jal`) showed low-score noise next to the right answer. |
| Fixed the headword column width | Screenshot review: result rows were ragged. |
| Softened the highlight colour in dark mode | Light text on solid yellow had poor contrast. |
| Kept `h` at the start of a word in the phonetic key | `hriday` was losing its first letter, so `hirday` couldn't reach it within the typo budget. |
| Corrected size and speed figures in the README | They were measured, then fixed: ~30 KB code, ~165 KB fonts, ~0.2 ms per search. |

## How the output was checked

- **IAST validator.** `npm run validate` regenerates IAST from every headword and compares it with the stored transliteration. A deliberately planted error (`dhrama`) was confirmed to fail before trusting it.
- **Search tests.** `npm test` runs 11 groups of real queries: unlisted spellings, typos, Devanagari variants (सुन्दर/सुंदर, शान्ति/शांति), nukta and chandrabindu, prefixes, English meanings, and garbage input.
- **Ranking spot-check.** Full result lists for ambiguous queries (`sun`, `ana`, `sa`, `ban`) were printed and read, not just the top hit.
- **Screenshots.** Phone-size screenshots of home, results, a typo, no-results and an entry, in light and dark mode, were reviewed by eye.
- **Offline test.** Load the app, cut the network, reload, search, save a word. The Devanagari font was confirmed to still render.

## My own review

<!-- Fill this in yourself before submitting: what you read, checked or changed, e.g.
     "Read every entry's meaning and example; changed X because Y."
     "Tested on my phone (Android/Chrome): ..."  -->
