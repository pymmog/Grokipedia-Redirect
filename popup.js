const browser = globalThis.grokiBrowser ?? globalThis.browser ?? globalThis.chrome;
const switchEl = document.getElementById("enabled");

function setEnabled(enabled) {
  switchEl.setAttribute("aria-checked", enabled ? "true" : "false");
}

browser.storage.sync.get({ enabled: true }, (result) => {
  setEnabled(result.enabled);
});

switchEl.addEventListener("click", () => {
  const enabled = switchEl.getAttribute("aria-checked") !== "true";
  setEnabled(enabled);
  browser.storage.sync.set({ enabled });
});
