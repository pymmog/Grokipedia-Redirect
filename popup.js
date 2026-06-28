const switchEl = document.getElementById("enabled");

function setEnabled(enabled) {
  switchEl.setAttribute("aria-checked", enabled ? "true" : "false");
}

chrome.storage.sync.get({ enabled: true }, (result) => {
  setEnabled(result.enabled);
});

switchEl.addEventListener("click", () => {
  const enabled = switchEl.getAttribute("aria-checked") !== "true";
  setEnabled(enabled);
  chrome.storage.sync.set({ enabled });
});
