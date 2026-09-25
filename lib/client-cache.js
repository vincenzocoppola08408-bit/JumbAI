// ============================================================
// lib/client-cache.js — Cache API + IndexedDB for offline gallery
// ============================================================

const DB_NAME = 'jumbai-gallery';
const DB_VERSION = 1;
const STORE_NAME = 'gallery_meta';
const CACHE_NAME = 'jumbai-image-cache';

/**
 * Initialize IndexedDB database and object store
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save image blob to Cache API
 * @param {string} url - The URL of the image (cache key)
 * @param {Blob} blob - The image blob
 * @returns {Promise<void>}
 */
export async function saveToCache(url, blob) {
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(blob);
  await cache.put(url, response);
}

/**
 * Load image blob from Cache API
 * @param {string} url - The URL of the image
 * @returns {Promise<Blob|null>} - Blob if found, null otherwise
 */
export async function loadFromCache(url) {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(url);
  if (!response) return null;
  return await response.blob();
}

/**
 * Save metadata to IndexedDB
 * @param {Object} metadata - { id, url, prompt, buzz_cost, timestamp, ... }
 * @returns {Promise<void>}
 */
export async function saveToIndexedDB(metadata) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(metadata);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(request.error);
  });
}

/**
 * Load metadata from IndexedDB by id
 * @param {string|number} id - The image id
 * @returns {Promise<Object|null>} - Metadata if found, null otherwise
 */
export async function loadFromIndexedDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(request.error);
  });
}

/**
 * Get all metadata from IndexedDB
 * @returns {Promise<Array>} - Array of metadata objects
 */
export async function getAllFromIndexedDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(request.error);
  });
}

/**
 * Clear all data from Cache API and IndexedDB (for testing/logout)
 */
export async function clearCache() {
  // Clear Cache API
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  // Clear IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Synchronize with backend: get missing images and save them to cache and IndexedDB
 * @param {string} userId - The user ID
 * @param {string} backendUrl - Base URL of the backend (e.g., window.location.origin)
 * @returns {Promise<Object>} - Result of sync
 */
export async function syncWithGalleryBackend(userId, backendUrl = '') {
  try {
    // 1. Call the backend sync endpoint to get missing images
    const syncResp = await fetch(`${backendUrl}/api/gallery/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (!syncResp.ok) {
      throw new Error(`Backend sync failed: ${syncResp.status}`);
    }
    const syncData = await syncResp.json();
    const missing = syncData.missing || []; // Expecting array of metadata objects

    // 2. For each missing image, fetch the image blob and save to cache and IndexedDB
    const saved = [];
    const failed = [];

    for (const meta of missing) {
      try {
        const { id, url, prompt, buzz_cost, timestamp } = meta;
        // Fetch the image from the CDN/storage URL
        const imageResp = await fetch(url);
        if (!imageResp.ok) {
          throw new Error(`Failed to fetch image: ${imageResp.status}`);
        }
        const blob = await imageResp.blob();

        // Save to Cache API
        await saveToCache(url, blob);

        // Save metadata to IndexedDB (ensure we have the id)
        await saveToIndexedDB({
          id,
          url,
          prompt: prompt || '',
          buzz_cost: buzz_cost || 0,
          timestamp: timestamp || Date.now()
        });

        saved.push(id);
      } catch (err) {
        console.error(`Failed to sync image ${meta.id}:`, err);
        failed.push({ id: meta.id, error: err.message });
      }
    }

    return {
      success: true,
      saved,
      failed,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Gallery sync error:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Export a singleton instance for easy use
export const clientCache = {
  saveToCache,
  loadFromCache,
  saveToIndexedDB,
  loadFromIndexedDB,
  getAllFromIndexedDB,
  clearCache,
  syncWithGalleryBackend
};