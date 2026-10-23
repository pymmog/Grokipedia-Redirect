const browser = globalThis.grokiBrowser ?? globalThis.browser ?? globalThis.chrome;

const ICONS = {
  on: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  off: {
    16: "icons/icon16-off.png",
    48: "icons/icon48-off.png",
    128: "icons/icon128-off.png",
  },
};

function setToolbarIcon(enabled) {
  const path = enabled ? ICONS.on : ICONS.off;
  const title = enabled
    ? "Grokipedia Redirect (on)"
    : "Grokipedia Redirect (off)";

  if (browser.action?.setIcon) {
    browser.action.setIcon({ path });
  }
  if (browser.action?.setTitle) {
    browser.action.setTitle({ title });
  }
}

function refreshIcon() {
  browser.storage.sync.get({ enabled: true }, (result) => {
    setToolbarIcon(result.enabled !== false);
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabled) {
    setToolbarIcon(changes.enabled.newValue !== false);
  }
});

if (browser.runtime.onInstalled) {
  browser.runtime.onInstalled.addListener(refreshIcon);
}
if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(refreshIcon);
}

refreshIcon();
