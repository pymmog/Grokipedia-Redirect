(function () {
  "use strict";

  const browser = globalThis.browser ?? globalThis.chrome;

  const memoryStore = new Map();

  function memorySession() {
    return {
      get(keys, callback) {
        const result = {};
        const keyList =
          keys === null || keys === undefined
            ? [...memoryStore.keys()]
            : typeof keys === "string"
              ? [keys]
              : Array.isArray(keys)
                ? keys
                : Object.keys(keys);

        for (const key of keyList) {
          if (memoryStore.has(key)) {
            result[key] = memoryStore.get(key);
          } else if (typeof keys === "object" && keys !== null && !Array.isArray(keys)) {
            result[key] = keys[key];
          }
        }

        if (typeof callback === "function") {
          callback(result);
        }
      },
      set(items, callback) {
        for (const [key, value] of Object.entries(items)) {
          memoryStore.set(key, value);
        }
        if (typeof callback === "function") {
          callback();
        }
      },
      remove(keys, callback) {
        const keyList = typeof keys === "string" ? [keys] : keys;
        for (const key of keyList) {
          memoryStore.delete(key);
        }
        if (typeof callback === "function") {
          callback();
        }
      },
    };
  }

  function resolveSessionStorage() {
    if (browser.storage?.session) {
      return browser.storage.session;
    }
    if (browser.storage?.local) {
      return browser.storage.local;
    }
    return memorySession();
  }

  globalThis.grokiBrowser = browser;
  globalThis.grokiSessionStorage = resolveSessionStorage();
})();
