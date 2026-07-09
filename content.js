(function () {
  "use strict";

  // Default on so early clicks still redirect before storage resolves.
  let enabled = true;

  chrome.storage.sync.get({ enabled: true }, (result) => {
    enabled = result.enabled !== false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
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

    // Leave modified/contenteditable contexts alone.
    if (anchor.isContentEditable) {
      return true;
    }

    return false;
  }

  function storeFallbackUrl(wikipediaUrl, grokipediaUrl) {
    try {
      chrome.storage.session.set({
        [fallbackStorageKey(grokipediaUrl)]: wikipediaUrl,
      });
    } catch {
      // Session storage can be unavailable in rare contexts; hash fallback still works.
    }
  }

  function navigateToGrokipedia(wikipediaUrl, grokipediaUrl, openInNewTab) {
    const targetUrl = grokipediaUrlWithFallback(wikipediaUrl, grokipediaUrl);
    storeFallbackUrl(wikipediaUrl, grokipediaUrl);

    if (openInNewTab) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.assign(targetUrl);
  }

  function handleLinkNavigation(event) {
    if (!enabled || event.defaultPrevented) {
      return;
    }

    // Only primary click and middle-click.
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    // Ignore synthetic/repeated clicks.
    if (typeof event.detail === "number" && event.detail > 1 && event.button === 0) {
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
