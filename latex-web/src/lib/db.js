// Minimal promise wrapper around IndexedDB.
//
// Stores:
//   projects  – { id, name, created, updated, trashed, mainFile, compiler, files, folders }
//               files: { [path]: { kind: 'text', text } | { kind: 'binary', blob } }
//   history   – { id, projectId, time, label, auto, files: { [path]: text } }

const DB_NAME = 'freetex';
const DB_VERSION = 1;

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('history')) {
          const h = db.createObjectStore('history', { keyPath: 'id' });
          h.createIndex('projectId', 'projectId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export const dbGet = async (name, key) => wrap((await store(name)).get(key));
export const dbPut = async (name, value) => wrap((await store(name, 'readwrite')).put(value));
export const dbDelete = async (name, key) => wrap((await store(name, 'readwrite')).delete(key));
export const dbAll = async (name) => wrap((await store(name)).getAll());

export async function dbAllByIndex(name, index, value) {
  return wrap((await store(name)).index(index).getAll(value));
}

export async function dbDeleteByIndex(name, index, value) {
  const s = await store(name, 'readwrite');
  const keys = await wrap(s.index(index).getAllKeys(value));
  await Promise.all(keys.map((k) => wrap(s.delete(k))));
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
