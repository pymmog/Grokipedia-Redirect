const WIKIPEDIA_HOST_PATTERN =
  /^(?:www\.)?wikipedia\.org$|^[a-z]{2,3}(?:\.m)?\.wikipedia\.org$/;

const NON_ARTICLE_NAMESPACE =
  /^(?:Special|Talk|User|User_talk|Wikipedia|Wikipedia_talk|File|File_talk|MediaWiki|MediaWiki_talk|Template|Template_talk|Help|Help_talk|Category|Category_talk|Portal|Portal_talk|Draft|Draft_talk|TimedText|TimedText_talk|Module|Module_talk|Book|Book_talk|Education_Program|Education_Program_talk|Gadget|Gadget_talk|Topic):/i;

function isWikipediaHost(hostname) {
  return WIKIPEDIA_HOST_PATTERN.test(hostname.toLowerCase());
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
  return grokipediaUrl.split("#")[0];
}

function fallbackStorageKey(grokipediaUrl) {
  return `fallback:${grokipediaCheckUrl(grokipediaUrl)}`;
}

const FALLBACK_HASH_PREFIX = "groki-fallback=";

function grokipediaUrlWithFallback(wikipediaUrl, grokipediaUrl) {
  const url = new URL(grokipediaUrl);
  url.hash = `${FALLBACK_HASH_PREFIX}${encodeURIComponent(wikipediaUrl)}`;
  return url.href;
}

function getFallbackFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith(`#${FALLBACK_HASH_PREFIX}`)) {
    return null;
  }

  try {
    return decodeURIComponent(hash.slice(`#${FALLBACK_HASH_PREFIX}`.length));
  } catch {
    return null;
  }
}

function clearFallbackHash() {
  if (!window.location.hash.startsWith(`#${FALLBACK_HASH_PREFIX}`)) {
    return;
  }

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}