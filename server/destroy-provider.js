import {OperationError, photoPublicId} from './cloudinary-admin.js';

export async function destroyProvider({id, confirmation, store, cloudinary, cloudName, migrated = {}}) {
  if (typeof id !== 'string' || !id || (id.includes('/') || id === '.' || id === '..') || id.length > 1500 || typeof confirmation !== 'string') throw new OperationError('Solicitud de destrucción inválida.', 400);
  const record = await store.get(id);
  if (!record) throw new OperationError('El proveedor ya no existe. Actualiza el panel.', 404);
  if (!['reviewed', 'deleting'].includes(record.status)) throw new OperationError('Solo puedes destruir proveedores revisados.', 409);
  if (confirmation !== record.name) throw new OperationError('El nombre de confirmación no coincide con el proveedor.', 400);
  const publicIds = [...new Set((record.photos || []).map(url => photoPublicId(url, cloudName, migrated)))];
  const others = await store.list();
  for (const other of others) {
    if (other.id === id) continue;
    for (const url of other.photos || []) {
      let otherId;
      try { otherId = photoPublicId(url, cloudName, migrated); } catch { continue; }
      if (publicIds.includes(otherId)) throw new OperationError('Una imagen está compartida con otro proveedor. Resuelve esa referencia antes de destruirlo.', 409);
    }
  }
  // El plan persiste antes del primer borrado: permite reintentar aunque la imagen
  // principal ya no exista y aún queden respaldos o falle la conexión a Firestore.
  let plan = record.destruction?.assets;
  if (plan) {
    if (plan.length !== publicIds.length || plan.some(asset => !publicIds.includes(asset.publicId))) throw new OperationError('El plan de destrucción no coincide con las fotografías.', 409);
  } else {
    plan = [];
    for (const publicId of publicIds) plan.push(await cloudinary.plan(publicId));
  }
  await store.lock(id, record, plan);
  const completed = new Set(record.destruction?.completed || []);
  for (const asset of plan) {
    if (completed.has(asset.publicId)) continue;
    await cloudinary.destroy(asset);
    await store.complete(id, asset.publicId);
  }
  await store.removeOwner(record);
  await store.remove(id, plan);
  return {deleted:true, images:plan.length, cacheInvalidationRequested:true};
}
