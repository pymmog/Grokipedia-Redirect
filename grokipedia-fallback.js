(function () {
  "use strict";

  const sessionStorage = globalThis.grokiSessionStorage;

  let redirected = false;

  function isNotFoundPage() {
    if (document.title.includes("Article Not Found")) {
      return true;
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content?.includes("Article Not Found")) {
      return true;
    }

    const heading = document.querySelector("main h1, h1");
    if (heading?.textContent?.trim() === "Article not found") {
      return true;
    }

    return Boolean(
      document.querySelector('img[src="/article_404_light.svg"], img[src="/article_404_dark.svg"]')
    );
  }

  function wikipediaUrlFromGrokipediaPage() {
    const match = window.location.pathname.match(/^\/page\/(.+)$/);
    if (!match) {
      return null;
    }

    let title;
    try {
      title = decodeURIComponent(match[1]);
    } catch {
      return null;
    }

    const wikipediaTitle = encodeURI(title).replace(/%20/g, "_");
    return `https://en.wikipedia.org/wiki/${wikipediaTitle}`;
  }

  function resolveFallbackUrl() {
    return getFallbackFromHash() || wikipediaUrlFromGrokipediaPage();
  }

  function redirectToWikipedia(wikipediaUrl) {
    if (!wikipediaUrl || redirected) {
      return;
    }

    redirected = true;
    window.location.replace(wikipediaUrl);
  }

  function tryRedirect() {
    if (redirected || !isNotFoundPage()) {
      return;
    }

    const hashFallback = getFallbackFromHash();
    if (hashFallback) {
      redirectToWikipedia(hashFallback);
      return;
    }

    const pageUrl = window.location.href.split("#")[0];
    const storageKey = fallbackStorageKey(pageUrl);

    sessionStorage.get(storageKey, (result) => {
      const storedUrl = result[storageKey];
      if (storedUrl) {
        sessionStorage.remove(storageKey);
        redirectToWikipedia(storedUrl);
        return;
      }

      redirectToWikipedia(wikipediaUrlFromGrokipediaPage());
    });
  }

  function tryCleanupHash() {
    if (isNotFoundPage()) {
      return;
    }

    clearFallbackHash();
  }

  function watchForNotFoundPage() {
    if (isNotFoundPage()) {
      tryRedirect();
      return;
    }

    const observer = new MutationObserver(() => {
      if (isNotFoundPage()) {
        observer.disconnect();
        tryRedirect();
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    window.setTimeout(() => {
      observer.disconnect();
      tryRedirect();
    }, 3000);
  }

  function init() {
    tryRedirect();
    watchForNotFoundPage();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tryCleanupHash, { once: true });
    } else {
      tryCleanupHash();
    }
  }

  init();
})();