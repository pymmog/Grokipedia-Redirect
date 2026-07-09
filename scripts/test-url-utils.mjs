import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, "..", "url-utils.js"), "utf8");

const sandbox = {
  URL,
  console,
  window: {
    location: {
      hash: "",
      pathname: "/page/Albert_Einstein",
      search: "",
    },
    history: {
      replaceStateCalls: [],
      replaceState(state, title, url) {
        this.replaceStateCalls.push(url);
        const hashIndex = url.indexOf("#");
        sandbox.window.location.hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
      },
    },
  },
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const {
  wikipediaUrlToGrokipedia,
  grokipediaCheckUrl,
  fallbackStorageKey,
  skipRedirectStorageKey,
  normalizeWikipediaUrl,
  grokipediaUrlWithFallback,
  getFallbackFromHash,
  getSectionFromFallbackHash,
  clearFallbackHash,
} = sandbox;

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
  [
    "https://en.wikipedia.org/wiki/Albert_Einstein?action=edit",
    null,
  ],
  [
    "https://en.wikipedia.org/w/index.php?title=Albert_Einstein",
    null,
  ],
  [
    "https://simple.wikipedia.org/wiki/Sun",
    "https://grokipedia.com/page/Sun",
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
  [
    "https://grokipedia.com/page/Albert_Einstein#groki-fallback=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FAlbert_Einstein&s=Early_life",
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
  [
    "https://en.wikipedia.org/wiki/Albert_Einstein#Early_life",
    "https://grokipedia.com/page/Albert_Einstein#Early_life",
    "https://grokipedia.com/page/Albert_Einstein#groki-fallback=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FAlbert_Einstein%23Early_life&s=Early_life",
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

const skipKeyCases = [
  [
    "https://en.wikipedia.org/wiki/Albert_Einstein#Early_life",
    "skip:https://en.wikipedia.org/wiki/Albert_Einstein",
  ],
  [
    "https://de.wikipedia.org/wiki/Albert_Einstein",
    "skip:https://de.wikipedia.org/wiki/Albert_Einstein",
  ],
];

for (const [input, expected] of skipKeyCases) {
  const actual = skipRedirectStorageKey(input);
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL skip key: ${input}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

const normalized = normalizeWikipediaUrl(
  "https://en.wikipedia.org/wiki/Albert_Einstein#Early_life"
);
if (normalized !== "https://en.wikipedia.org/wiki/Albert_Einstein") {
  failed += 1;
  console.error(`FAIL normalize\n  expected bare article url\n  actual: ${normalized}`);
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

sandbox.window.location.hash =
  "#groki-fallback=https%3A%2F%2Fde.wikipedia.org%2Fwiki%2FAlbert_Einstein";
const parsedFallback = getFallbackFromHash();
if (parsedFallback !== "https://de.wikipedia.org/wiki/Albert_Einstein") {
  failed += 1;
  console.error(`FAIL parse hash\n  expected de wikipedia url\n  actual: ${parsedFallback}`);
}

sandbox.window.location.hash =
  "#groki-fallback=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FAlbert_Einstein%23Early_life&s=Early_life";
const parsedSection = getSectionFromFallbackHash();
if (parsedSection !== "Early_life") {
  failed += 1;
  console.error(`FAIL parse section\n  expected Early_life\n  actual: ${parsedSection}`);
}

clearFallbackHash();
const restoredHash = sandbox.window.location.hash;
if (restoredHash !== "#Early_life") {
  failed += 1;
  console.error(`FAIL clear hash restore\n  expected #Early_life\n  actual: ${restoredHash}`);
}

// Idempotent re-injection should not throw or redefine.
vm.runInContext(code, sandbox);

if (failed > 0) {
  process.exit(1);
}

console.log(
  `All ${
    cases.length +
    checkUrlCases.length +
    storageKeyCases.length +
    skipKeyCases.length +
    fallbackHashCases.length +
    4
  } URL mapping tests passed.`
);
