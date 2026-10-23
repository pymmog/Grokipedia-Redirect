(function () {
  "use strict";

  const browser = globalThis.grokiBrowser ?? globalThis.browser ?? globalThis.chrome;
  const sessionStorage = globalThis.grokiSessionStorage;

  let enabled = true;

  browser.storage.sync.get({ enabled: true }, (result) => {
    enabled = result.enabled;
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.enabled) {
      enabled = changes.enabled.newValue;
    }
  });

  function shouldBypass(event, anchor) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return true;
    }

    if (event.type === "click" && event.shiftKey) {
      return true;
    }

    if (anchor.hasAttribute("download")) {
      return true;
    }

    return false;
  }

  function storeFallbackUrl(wikipediaUrl, grokipediaUrl) {
    sessionStorage.set({
      [fallbackStorageKey(grokipediaUrl)]: wikipediaUrl,
    });
  }

  function navigateToGrokipedia(wikipediaUrl, grokipediaUrl, openInNewTab) {
    const targetUrl = grokipediaUrlWithFallback(wikipediaUrl, grokipediaUrl);
    storeFallbackUrl(wikipediaUrl, grokipediaUrl);

    if (openInNewTab) {
      window.open(targetUrl, "_blank", "noopener");
      return;
    }

    window.location.assign(targetUrl);
  }

  function handleLinkNavigation(event) {
    if (!enabled || event.defaultPrevented) {
      return;
    }

    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) {
      return;
    }

    if (shouldBypass(event, anchor)) {
      return;
    }

    const wikipediaUrl = anchor.href;
    const grokipediaUrl = wikipediaUrlToGrokipedia(wikipediaUrl);
    if (!grokipediaUrl) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const openInNewTab =
      event.button === 1 ||
      anchor.target === "_blank" ||
      (event.type === "auxclick" && event.button === 1);

    navigateToGrokipedia(wikipediaUrl, grokipediaUrl, openInNewTab);
  }

  document.addEventListener("click", handleLinkNavigation, true);
  document.addEventListener("auxclick", handleLinkNavigation, true);
})();