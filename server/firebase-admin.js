import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {firebaseConfig} from '../dist/firebase-config.js';
import {OperationError} from './cloudinary-admin.js';

export function adminServices() {
  let app = getApps().find(app => app.name === 'vitrina-admin');
  if (!app) {
    let account;
    try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''); } catch { throw new OperationError('Falta configurar FIREBASE_SERVICE_ACCOUNT_JSON en Vercel.', 503); }
    if (account.project_id !== firebaseConfig.projectId) throw new OperationError('La cuenta de servicio no corresponde al proyecto Firebase.', 503);
    try { app = initializeApp({credential:cert(account), projectId:account.project_id}, 'vitrina-admin'); }
    catch { throw new OperationError('La cuenta de servicio de Firebase no es válida.', 503); }
  }
  const db = getFirestore(app);
  const providers = db.collection('providers');
  return {auth:getAuth(app), store:{
    async get(id) { const ref = providers.doc(id); const doc = await ref.get(); if (doc.exists && (await ref.listCollections()).length) throw new OperationError('La ficha contiene subcolecciones que deben revisarse antes de destruirla.', 409); return doc.exists ? {...doc.data(), id:doc.id} : null; },
    async list() { const snap = await providers.get(); return snap.docs.map(doc => ({...doc.data(), id:doc.id})); },
    async lock(id, original, assets) {
      await db.runTransaction(async tx => {
        const ref = providers.doc(id), snap = await tx.get(ref), data = snap.data();
        if (!data || !['reviewed','deleting'].includes(data.status) || data.name !== original.name || JSON.stringify(data.photos || []) !== JSON.stringify(original.photos || [])) throw new OperationError('La ficha cambió. Actualiza el panel antes de destruirla.', 409);
        if (data.destruction && JSON.stringify(data.destruction.assets) !== JSON.stringify(assets)) throw new OperationError('Ya existe otra operación de destrucción.', 409);
        tx.update(ref, {status:'deleting', destruction:{assets, completed:data.destruction?.completed || []}});
      });
    },
    async complete(id, publicId) {
      await providers.doc(id).update({'destruction.completed':FieldValue.arrayUnion(publicId)});
    },
    async removeOwner(record) {
      if (!record.ownerUid || record.ownerUid !== record.id) return;
      const auth = getAuth(app);
      let user;
      try { user = await auth.getUser(record.ownerUid); } catch (error) { if (error.code === 'auth/user-not-found') return; throw error; }
      // Solo cuentas anónimas creadas por el formulario; nunca una cuenta personal.
      if (!user.email && !user.phoneNumber && !user.providerData.length) await auth.deleteUser(user.uid);
    },
    async remove(id, assets) {
      await db.runTransaction(async tx => {
        const ref = providers.doc(id), snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        if (data.status !== 'deleting' || JSON.stringify(data.destruction?.assets) !== JSON.stringify(assets)) throw new OperationError('Cambió la operación de destrucción. La ficha se conserva.', 409);
        const children = await ref.listCollections();
        if (children.length) throw new OperationError('La ficha contiene subcolecciones que deben eliminarse antes de finalizar.', 409);
        tx.delete(ref);
      });
    }
  }};
}
