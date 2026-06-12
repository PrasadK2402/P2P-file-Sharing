const dbName = 'P2PFileShareDB';
const storeName = 'file_chunks';
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(storeName)) {
                const store = database.createObjectStore(storeName, { keyPath: 'slug_offset' });
                store.createIndex('slug', 'slug', { unique: false });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function storeChunk(slug, offset, buffer) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("DB not initialized"));
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put({
            slug_offset: `${slug}:${offset}`,
            slug: slug,
            offset: offset,
            data: buffer
        });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getStoredProgress(slug) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("DB not initialized"));
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index('slug');
        const request = index.getAll(slug);
        request.onsuccess = (e) => {
            const records = e.target.result;
            records.sort((a, b) => a.offset - b.offset);
            resolve(records);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function storeMetadata(slug, meta) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("DB not initialized"));
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put({
            slug_offset: `metadata:${slug}`,
            slug: slug,
            meta: meta
        });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getStoredMetadata(slug) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error("DB not initialized"));
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(`metadata:${slug}`);
        request.onsuccess = (e) => {
            resolve(e.target.result ? e.target.result.meta : null);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

function clearStoredChunks(slug) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('slug');
        const request = index.openCursor(slug);
        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (e) => reject(e.target.error);
    });
}
