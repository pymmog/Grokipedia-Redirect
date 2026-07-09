(function (global) {
  "use strict";

  if (global.__GROKI_URL_UTILS__) {
    return;
  }
  global.__GROKI_URL_UTILS__ = true;

  // Matches en.wikipedia.org, en.m.wikipedia.org, simple.wikipedia.org, zh-yue.wikipedia.org, etc.
  const WIKIPEDIA_HOST_PATTERN =
    /^(?:www\.)?wikipedia\.org$|^[a-z0-9-]+(?:\.m)?\.wikipedia\.org$/i;

  const NON_ARTICLE_NAMESPACE =
    /^(?:Special|Talk|User|User_talk|Wikipedia|Wikipedia_talk|File|File_talk|MediaWiki|MediaWiki_talk|Template|Template_talk|Help|Help_talk|Category|Category_talk|Portal|Portal_talk|Draft|Draft_talk|TimedText|TimedText_talk|Module|Module_talk|Book|Book_talk|Education_Program|Education_Program_talk|Gadget|Gadget_talk|Topic):/i;

  const FALLBACK_HASH_PREFIX = "groki-fallback=";
  const SECTION_HASH_PARAM = "s=";
  const SKIP_STORAGE_PREFIX = "skip:";

  function isWikipediaHost(hostname) {
    return WIKIPEDIA_HOST_PATTERN.test(hostname.toLowerCase());
  }

  function normalizeWikipediaUrl(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }

    url.hash = "";
    return url.href;
  }

  function skipRedirectStorageKey(wikipediaUrl) {
    const normalized = normalizeWikipediaUrl(wikipediaUrl);
    return normalized ? `${SKIP_STORAGE_PREFIX}${normalized}` : null;
  }

  function wikipediaUrlToGrokipedia(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }

    if (!isWikipediaHost(url.hostname)) {
      return null;
    }

    // Skip non-view Wikipedia URLs (edit, history, etc.).
    if (url.searchParams.has("action") && url.searchParams.get("action") !== "view") {
      return null;
    }

    const match = url.pathname.match(/^\/wiki\/(.+)$/);
    if (!match) {
      return null;
    }

    let title;
    try {
      title = decodeURIComponent(match[1]);
    } catch {
      return null;
    }

    if (NON_ARTICLE_NAMESPACE.test(title)) {
      return null;
    }

    // Media / fragment-only titles are not articles.
    if (title.startsWith(":") || title.includes("#")) {
      return null;
    }

    const grokipediaTitle = title.replace(/ /g, "_");
    const grokipediaUrl = new URL(
      `https://grokipedia.com/page/${encodeURI(grokipediaTitle).replace(/%20/g, "_")}`
    );

    if (url.hash) {
      grokipediaUrl.hash = url.hash;
    }

    return grokipediaUrl.href;
  }

  function grokipediaCheckUrl(grokipediaUrl) {
    const url = new URL(grokipediaUrl);
    url.hash = "";
    return url.href;
  }

  function fallbackStorageKey(grokipediaUrl) {
    return `fallback:${grokipediaCheckUrl(grokipediaUrl)}`;
  }

  function parseFallbackHashParts(hash) {
    const body = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!body) {
      return { fallbackUrl: null, section: null, hasFallbackMarker: false };
    }

    let fallbackUrl = null;
    let section = null;
    let hasFallbackMarker = false;

    for (const part of body.split("&")) {
      if (part.startsWith(FALLBACK_HASH_PREFIX)) {
        hasFallbackMarker = true;
        try {
          fallbackUrl = decodeURIComponent(part.slice(FALLBACK_HASH_PREFIX.length));
        } catch {
          fallbackUrl = null;
        }
      } else if (part.startsWith(SECTION_HASH_PARAM)) {
        try {
          section = decodeURIComponent(part.slice(SECTION_HASH_PARAM.length));
        } catch {
          section = null;
        }
      }
    }

    return { fallbackUrl, section, hasFallbackMarker };
  }

  function grokipediaUrlWithFallback(wikipediaUrl, grokipediaUrl) {
    const url = new URL(grokipediaUrl);
    const section = url.hash.startsWith("#") ? url.hash.slice(1) : "";
    let hash = `${FALLBACK_HASH_PREFIX}${encodeURIComponent(wikipediaUrl)}`;

    if (section && !section.includes(FALLBACK_HASH_PREFIX)) {
      hash += `&${SECTION_HASH_PARAM}${encodeURIComponent(section)}`;
    }

    url.hash = hash;
    return url.href;
  }

  function getFallbackFromHash() {
    const { fallbackUrl, hasFallbackMarker } = parseFallbackHashParts(
      global.window?.location?.hash || ""
    );
    return hasFallbackMarker ? fallbackUrl : null;
  }

  function getSectionFromFallbackHash() {
    const { section, hasFallbackMarker } = parseFallbackHashParts(
      global.window?.location?.hash || ""
    );
    return hasFallbackMarker ? section : null;
  }

  function clearFallbackHash() {
    const location = global.window?.location;
    const history = global.window?.history;
    if (!location || !history) {
      return;
    }

    const { section, hasFallbackMarker } = parseFallbackHashParts(location.hash);
    if (!hasFallbackMarker) {
      return;
    }

    const nextUrl = section
      ? `${location.pathname}${location.search}#${section}`
      : `${location.pathname}${location.search}`;

    history.replaceState(null, "", nextUrl);
  }

  global.isWikipediaHost = isWikipediaHost;
  global.wikipediaUrlToGrokipedia = wikipediaUrlToGrokipedia;
  global.normalizeWikipediaUrl = normalizeWikipediaUrl;
  global.skipRedirectStorageKey = skipRedirectStorageKey;
  global.grokipediaCheckUrl = grokipediaCheckUrl;
  global.fallbackStorageKey = fallbackStorageKey;
  global.grokipediaUrlWithFallback = grokipediaUrlWithFallback;
  global.getFallbackFromHash = getFallbackFromHash;
  global.getSectionFromFallbackHash = getSectionFromFallbackHash;
  global.clearFallbackHash = clearFallbackHash;
  global.FALLBACK_HASH_PREFIX = FALLBACK_HASH_PREFIX;
})(typeof globalThis !== "undefined" ? globalThis : window);
