import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, "..", "url-utils.js"), "utf8");
vm.runInThisContext(code);

const cases = [
  [
    "https://en.wikipedia.org/wiki/Albert_Einstein",
    "https://grokipedia.com/page/Albert_Einstein",
  ],
  [
    "https://en.wikipedia.org/wiki/Albert_Einstein#Early_life",
    "https://grokipedia.com/page/Albert_Einstein#Early_life",
  ],
  [
    "https://de.wikipedia.org/wiki/Albert_Einstein",
    "https://grokipedia.com/page/Albert_Einstein",
  ],
  [
    "https://en.m.wikipedia.org/wiki/Quantum_computing",
    "https://grokipedia.com/page/Quantum_computing",
  ],
  [
    "https://en.wikipedia.org/wiki/Special:Search?search=test",
    null,
  ],
  [
    "https://en.wikipedia.org/wiki/Category:Physics",
    null,
  ],
  [
    "https://grokipedia.com/page/Test",
    null,
  ],
  [
    "https://en.wikipedia.org/wiki/Kingdom_of_W%C3%BCrttemberg",
    "https://grokipedia.com/page/Kingdom_of_W%C3%BCrttemberg",
  ],
];

let failed = 0;
for (const [input, expected] of cases) {
  const actual = wikipediaUrlToGrokipedia(input);
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL: ${input}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

const checkUrlCases = [
  [
    "https://grokipedia.com/page/Albert_Einstein#Early_life",
    "https://grokipedia.com/page/Albert_Einstein",
  ],
];

const storageKeyCases = [
  [
    "https://grokipedia.com/page/Albert_Einstein",
    "fallback:https://grokipedia.com/page/Albert_Einstein",
  ],
];

const fallbackHashCases = [
  [
    "https://en.wikipedia.org/wiki/Albert_Einstein",
    "https://grokipedia.com/page/Albert_Einstein",
    "https://grokipedia.com/page/Albert_Einstein#groki-fallback=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FAlbert_Einstein",
  ],
  [
    "https://de.wikipedia.org/wiki/Albert_Einstein",
    "https://grokipedia.com/page/Albert_Einstein",
    "https://grokipedia.com/page/Albert_Einstein#groki-fallback=https%3A%2F%2Fde.wikipedia.org%2Fwiki%2FAlbert_Einstein",
  ],
];

for (const [input, expected] of checkUrlCases) {
  const actual = grokipediaCheckUrl(input);
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL check url: ${input}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

for (const [input, expected] of storageKeyCases) {
  const actual = fallbackStorageKey(input);
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL storage key: ${input}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

for (const [wikipediaUrl, grokipediaUrl, expected] of fallbackHashCases) {
  const actual = grokipediaUrlWithFallback(wikipediaUrl, grokipediaUrl);
  if (actual !== expected) {
    failed += 1;
    console.error(
      `FAIL fallback hash: ${wikipediaUrl}\n  expected: ${expected}\n  actual:   ${actual}`
    );
  }
}

global.window = {
  location: {
    hash: "#groki-fallback=https%3A%2F%2Fde.wikipedia.org%2Fwiki%2FAlbert_Einstein",
    pathname: "/page/Albert_Einstein",
    search: "",
  },
  history: { replaceState: () => {} },
};

const parsedFallback = getFallbackFromHash();
if (parsedFallback !== "https://de.wikipedia.org/wiki/Albert_Einstein") {
  failed += 1;
  console.error(`FAIL parse hash\n  expected de wikipedia url\n  actual: ${parsedFallback}`);
}

if (failed > 0) {
  process.exit(1);
}

console.log(
  `All ${cases.length + checkUrlCases.length + storageKeyCases.length + fallbackHashCases.length + 1} URL mapping tests passed.`
);