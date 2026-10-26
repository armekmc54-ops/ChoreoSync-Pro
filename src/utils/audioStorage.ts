// Almacenamiento local persistente de archivos de audio mediante IndexedDB
// Permite guardar archivos MP3/WAV pesados (de decenas o cientos de MB) en el navegador
// superando el límite estricto de 5MB de localStorage sin degradar el rendimiento.

const DB_NAME = 'choreosync_audio_storage_v1';
const DB_VERSION = 1;
const STORE_NAME = 'audio_cache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no soportado en este entorno'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Guarda un Blob o File de audio en IndexedDB asociado a una clave (ej: nombre de sesión o archivo)
 */
export async function saveAudioToIndexedDB(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('No se pudo guardar audio en IndexedDB:', err);
  }
}

/**
 * Recupera un Blob de audio previamente guardado en IndexedDB
 */
export async function getAudioFromIndexedDB(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('No se pudo recuperar audio de IndexedDB:', err);
    return null;
  }
}

/**
 * Convierte un Blob o File de audio a Data URI Base64 para incrustación directa
 */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convierte un Data URI Base64 de vuelta a un Blob utilizable
 */
export function dataUriToBlob(dataUri: string): Blob {
  const parts = dataUri.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'audio/mpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
