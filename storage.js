/* ------------------------------------------------------------------
 * storage.js — a drop-in replacement for the artifact `window.storage`
 * API, backed by IndexedDB (with a localStorage fallback).
 *
 * App.jsx calls window.storage.get / .set and expects:
 *   get(key)  -> { key, value, shared } — and THROWS if the key is absent
 *   set(key, value) -> { key, value, shared }
 * so this keeps exactly that contract. Nothing in App.jsx changes.
 * ------------------------------------------------------------------ */

const DB_NAME = "celeste";
const STORE = "kv";
const VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try { result = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/* Safari in private mode can refuse IndexedDB, so keep a simple fallback. */
const local = {
  get: (k) => {
    const v = localStorage.getItem("celeste:" + k);
    if (v === null) throw new Error("not found");
    return v;
  },
  set: (k, v) => localStorage.setItem("celeste:" + k, v),
  del: (k) => localStorage.removeItem("celeste:" + k),
  keys: () => Object.keys(localStorage).filter((k) => k.indexOf("celeste:") === 0).map((k) => k.slice(8)),
};

export const storage = {
  async get(key, shared = false) {
    try {
      const value = await tx("readonly", (s) => s.get(key));
      if (value === undefined) throw new Error("not found");
      return { key, value, shared };
    } catch (e) {
      return { key, value: local.get(key), shared };
    }
  },

  async set(key, value, shared = false) {
    try {
      await tx("readwrite", (s) => s.put(value, key));
    } catch (e) {
      local.set(key, value);
    }
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    try {
      await tx("readwrite", (s) => s.delete(key));
    } catch (e) {
      local.del(key);
    }
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    let keys;
    try {
      keys = await tx("readonly", (s) => s.getAllKeys());
    } catch (e) {
      keys = local.keys();
    }
    return { keys: keys.filter((k) => String(k).indexOf(prefix) === 0), prefix, shared };
  },
};

export function installStorage() {
  window.storage = storage;
}
