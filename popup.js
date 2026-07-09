const switchEl = document.getElementById("enabled");

function setEnabled(enabled) {
  switchEl.setAttribute("aria-checked", enabled ? "true" : "false");
}

function toggleEnabled() {
  const enabled = switchEl.getAttribute("aria-checked") !== "true";
  setEnabled(enabled);
  chrome.storage.sync.set({ enabled });
}

chrome.storage.sync.get({ enabled: true }, (result) => {
  setEnabled(result.enabled !== false);
});

switchEl.addEventListener("click", toggleEnabled);

switchEl.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    toggleEnabled();
  }
});
