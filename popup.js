const browser = globalThis.grokiBrowser ?? globalThis.browser ?? globalThis.chrome;
const switchEl = document.getElementById("enabled");

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
  if (!browser.action?.setIcon) {
    return;
  }
  browser.action.setIcon({ path: enabled ? ICONS.on : ICONS.off });
  if (browser.action.setTitle) {
    browser.action.setTitle({
      title: enabled ? "Grokipedia Redirect (on)" : "Grokipedia Redirect (off)",
    });
  }
}

function setEnabled(enabled) {
  switchEl.setAttribute("aria-checked", enabled ? "true" : "false");
  setToolbarIcon(enabled);
}

browser.storage.sync.get({ enabled: true }, (result) => {
  setEnabled(result.enabled !== false);
});

switchEl.addEventListener("click", () => {
  const enabled = switchEl.getAttribute("aria-checked") !== "true";
  setEnabled(enabled);
  browser.storage.sync.set({ enabled });
});
