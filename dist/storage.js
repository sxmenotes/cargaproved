import { firebaseConfig, adminUid } from './firebase-config.js';
import { uploadPhoto } from './cloudinary.js';
import { readDestructionResponse } from './destruction-response.js';
import { MAX_PHOTOS, RUBROS } from './provider-config.js';
export const isCloud = Boolean(firebaseConfig);
const dbPromise = !isCloud ? new Promise((resolve, reject) => {
  const request = indexedDB.open('tu-vitrina', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('providers', {keyPath:'id'});
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}) : null;
// Handle denied browser storage even before a user presses a button.
dbPromise?.catch(() => {});
async function localOperation(mode, callback) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('providers', mode);
    const request = callback(transaction.objectStore('providers'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar.'));
  });
}
let cloudPromise;
async function cloud() {
  if (!cloudPromise) cloudPromise = (async () => {
    const base = 'https://www.gstatic.com/firebasejs/12.4.0/';
    const [app, authApi, dbApi] = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(path => import(base + path)));
    const instance = app.initializeApp(firebaseConfig);
    const auth = authApi.getAuth(instance);
    await authApi.setPersistence(auth, authApi.browserSessionPersistence);
    await auth.authStateReady();
    return {authApi, dbApi, auth, db:dbApi.getFirestore(instance)};
  })();
  return cloudPromise;
}
export async function login(email, password) {
  if (!isCloud) {
    if (password !== 'Vitrina2026!') throw new Error('Contraseña incorrecta.');
    return;
  }
  const c = await cloud();
  const result = await c.authApi.signInWithEmailAndPassword(c.auth, email, password);
  if (result.user.uid !== adminUid) {
    await c.authApi.signOut(c.auth);
    throw new Error('Esta cuenta no tiene acceso de administrador.');
  }
}
export async function logout() {if (isCloud) {const c = await cloud(); await c.authApi.signOut(c.auth);}}
export async function saveProvider(data, onProgress) {
  if (!Array.isArray(data.photos) || data.photos.length > MAX_PHOTOS) throw new Error(`Puedes agregar hasta ${MAX_PHOTOS} fotos.`);
  if (!RUBROS.includes(data.rubro)) throw new Error('Selecciona un rubro válido.');
  if (!isCloud) {
    const record = {...data, id:crypto.randomUUID(), createdAt:new Date().toISOString(), status:'pending'};
    await localOperation('readwrite', store => store.add(record));
    return record.id;
  }
  const c = await cloud();
  if (c.auth.currentUser?.uid === adminUid) throw new Error('Cierra tu sesión de administrador antes de enviar una ficha de proveedor.');
  if (!c.auth.currentUser) await c.authApi.signInAnonymously(c.auth);
  const uid = c.auth.currentUser.uid;
  const uploaded = [];
  // Si falla el guardado, las fotos ya subidas se conservan en Cloudinary.
  for (let i = 0; i < data.photos.length; i++) {
    uploaded.push(await uploadPhoto(data.photos[i]));
    onProgress(`Subiendo foto ${i + 1} de ${data.photos.length}…`);
  }
  await c.dbApi.setDoc(c.dbApi.doc(c.db, 'providers', uid), {
    ...data, photos:uploaded, ownerUid:uid, createdAt:c.dbApi.serverTimestamp(), status:'pending'
  });
  // Submission is committed; a logout failure must not be reported as a failed submission.
  await c.authApi.signOut(c.auth).catch(() => {});
  return uid;
}
export async function listProviders() {
  if (!isCloud) return localOperation('readonly', store => store.getAll());
  const c = await cloud();
  const snapshot = await c.dbApi.getDocs(c.dbApi.collection(c.db, 'providers'));
  return snapshot.docs.map(doc => ({...doc.data(), id:doc.id, createdAt:doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()}));
}
export async function setReviewed(record) {
  if (!isCloud) return localOperation('readwrite', store => store.put({...record, status:'reviewed'}));
  const c = await cloud();
  await c.dbApi.updateDoc(c.dbApi.doc(c.db, 'providers', record.id), {status:'reviewed'});
}
export async function photoUrl(photo) {
  if (!isCloud) return URL.createObjectURL(photo.blob);
  return photo;
}

export async function destroyProvider(id, confirmation) {
  if (!isCloud) {
    const record = await localOperation('readonly', store => store.get(id));
    if (!record || !['reviewed', 'deleting'].includes(record.status) || confirmation !== record.name) throw new Error('Solo puedes destruir un proveedor revisado confirmando su nombre.');
    await localOperation('readwrite', store => store.delete(id));
    return;
  }
  const c = await cloud();
  if (c.auth.currentUser?.uid !== adminUid) throw new Error('Ingresa como administrador.');
  const token = await c.auth.currentUser.getIdToken();
  let response;
  try {
    response = await fetch('/api/destroy-provider', {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({id, confirmation})});
  } catch { throw new Error('Se perdió la conexión. Actualiza el panel y reintenta la destrucción si la ficha sigue visible.'); }
  await readDestructionResponse(response);
}
