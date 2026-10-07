/*
 * Saving data in this browser.
 *  - Tasks, meetings, events, etc. are saved in localStorage (survives refresh).
 *  - Uploaded files are saved in IndexedDB (also only in this browser).
 * Nothing is sent to a server. Other people and other browsers do not see these changes.
 */
(function (WH) {
  'use strict';

  const KEY = 'wh-comms-prototype-v1';
  const PROFILE_KEY = 'wh-comms-prototype-profile';
  const DB_NAME = 'wh-comms-prototype-files';
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  let storageWorks = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.schemaVersion === 1) return data;
      }
    } catch (e) {
      storageWorks = false;
    }
    const fresh = WH.seed.build(new Date());
    save(fresh);
    return fresh;
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageWorks = true;
    } catch (e) {
      storageWorks = false;
    }
    return storageWorks;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    clearFiles();
    return load();
  }

  function getProfile() {
    try { return localStorage.getItem(PROFILE_KEY); } catch (e) { return null; }
  }

  function setProfile(id) {
    try {
      if (id) localStorage.setItem(PROFILE_KEY, id);
      else localStorage.removeItem(PROFILE_KEY);
    } catch (e) { /* ignore */ }
  }

  // ---------- files (IndexedDB) ----------

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) { reject(new Error('This browser cannot store files.')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open file storage.'));
    });
  }

  function tx(mode, fn) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction('files', mode);
      const store = t.objectStore('files');
      const result = fn(store);
      t.oncomplete = () => { db.close(); resolve(result && 'result' in result ? result.result : undefined); };
      t.onerror = () => { db.close(); reject(t.error || new Error('File storage failed.')); };
      t.onabort = () => { db.close(); reject(t.error || new Error('File storage was cancelled (the browser may be out of space).')); };
    }));
  }

  /** Stores a File. Resolves with document details; rejects if the file was not saved. */
  function saveFile(file) {
    if (file.size > MAX_FILE_BYTES) {
      return Promise.reject(new Error(file.name + ' is larger than 10 MB. In this prototype, attach a link to the file instead.'));
    }
    const id = WH.util.uid('doc');
    return tx('readwrite', (store) => store.put({ blob: file, name: file.name, type: file.type }, id))
      .then(() => tx('readonly', (store) => store.get(id)))
      .then((check) => {
        if (!check) throw new Error('The file could not be confirmed as saved.');
        return { id, name: file.name, size: file.size, type: file.type, stored: true };
      });
  }

  function getFile(id) {
    return tx('readonly', (store) => store.get(id));
  }

  function clearFiles() {
    return tx('readwrite', (store) => store.clear()).catch(() => {});
  }

  WH.store = { load, save, reset, getProfile, setProfile, saveFile, getFile, MAX_FILE_BYTES, storageOk: () => storageWorks };
})(globalThis.WH = globalThis.WH || {});
