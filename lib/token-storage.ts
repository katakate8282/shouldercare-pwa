// IndexedDB 기반 토큰 저장소
// standalone PWA에서도 영구 유지됨

const DB_NAME = 'shouldercare'
const STORE_NAME = 'auth'
const TOKEN_KEY = 'sc_token'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveToken(token: string): Promise<void> {
  try {
    // IndexedDB에 저장
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(token, TOKEN_KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.error('IndexedDB save failed:', e)
  }

  // localStorage에도 백업
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {}
}

export async function getToken(): Promise<string | null> {
  // 1. IndexedDB 시도
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(TOKEN_KEY)
    const token = await new Promise<string | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (token) return token
  } catch (e) {
    console.error('IndexedDB read failed:', e)
  }

  // 2. localStorage fallback
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {}

  return null
}

export async function removeToken(): Promise<void> {
  // IndexedDB에서 삭제
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(TOKEN_KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {}

  // localStorage에서도 삭제
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {}
}
