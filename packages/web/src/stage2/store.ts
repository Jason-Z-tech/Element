/**
 * Zwischenstände von Stufe 2 im Browser (IndexedDB). So läuft eine lange
 * Rechnung nach dem Schließen des Tabs beim nächsten Öffnen weiter.
 */
const DB = 'elementjaeger';
const STORE = 'pakete';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfügbar'));
  });
}

/** Schlüssel eines Pakets: Modell, Lauf, Reaktion, Energie, erste Ziehung. */
export function packetKey(prefix: string, firstMember: number): string {
  return `${prefix}|${String(firstMember).padStart(6, '0')}`;
}

export async function savePacket(prefix: string, firstMember: number, values: Float64Array): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(values, packetKey(prefix, firstMember));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Speichern fehlgeschlagen'));
  });
  db.close();
}

/** Alle gespeicherten Pakete eines Ensembles: erste Ziehung -> Werte. */
export async function loadPackets(prefix: string): Promise<Map<number, Float64Array>> {
  const db = await open();
  const out = new Map<number, Float64Array>();
  await new Promise<void>((resolve, reject) => {
    const range = IDBKeyRange.bound(`${prefix}|`, `${prefix}|￿`);
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      out.set(Number(String(cursor.key).slice(prefix.length + 1)), cursor.value as Float64Array);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Lesen fehlgeschlagen'));
  });
  db.close();
  return out;
}

/** Löscht alle gespeicherten Pakete. */
export async function clearPackets(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Löschen fehlgeschlagen'));
  });
  db.close();
}
