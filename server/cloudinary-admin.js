import {createHash} from 'node:crypto';

export class OperationError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function photoPublicId(value, cloudName, migrated = {}) {
  if (Object.hasOwn(migrated, value)) return migrated[value];
  let url;
  try { url = new URL(value); } catch { throw new OperationError('Hay una fotografía sin un enlace válido.', 409); }
  const prefix = `/${cloudName}/image/upload/`;
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(prefix) || url.search || url.hash) {
    throw new OperationError('Hay fotos fuera de esta cuenta de Cloudinary. Deben migrarse antes de destruir la ficha.', 409);
  }
  // Las URLs guardadas por el formulario son originales con versión, sin transformaciones.
  const match = url.pathname.slice(prefix.length).match(/^v\d+\/(.+)\.[a-zA-Z0-9]+$/);
  if (!match) throw new OperationError('No se pudo identificar una fotografía de Cloudinary.', 409);
  const id = decodeURIComponent(match[1]);
  if (id.split('/').some(part => !part || part === '.' || part === '..') || /[?&#\\]/.test(id)) throw new OperationError('Identificador de foto inválido.', 409);
  return id;
}

export function createCloudinaryAdmin({cloudName, apiKey, apiSecret, request = fetch}) {
  if (!cloudName || !apiKey || !apiSecret) throw new OperationError('Falta configurar las credenciales privadas de Cloudinary en Vercel.', 503);
  const base = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}`;
  const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  async function call(path, options = {}, allowMissing = false) {
    let response;
    try { response = await request(base + path, {...options, headers:{Authorization:authorization, ...options.headers}, signal:AbortSignal.timeout(15000)}); }
    catch { throw new OperationError('Cloudinary no respondió. Puedes reintentar la destrucción.'); }
    if (response.status === 404 && allowMissing) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error) throw new OperationError('Cloudinary no confirmó la operación. La ficha se conserva para reintentar.');
    return data;
  }
  async function inspect(publicId, assetId) {
    const path = assetId ? `/resources/${encodeURIComponent(assetId)}` : `/resources/image/upload/${encodeURIComponent(publicId)}`;
    return call(`${path}?versions=true`, {}, true);
  }
  return {
    async plan(publicId) {
      const data = await inspect(publicId);
      if (!data) throw new OperationError('Una imagen no figura en Cloudinary. Verifica sus respaldos antes de destruir esta ficha.', 409);
      if (data.public_id !== publicId || !data.asset_id || data.resource_type !== 'image') throw new OperationError('Cloudinary devolvió una imagen diferente. Se canceló la operación.');
      const versions = data.versions || [];
      const versionIds = versions.map(v => v.version_id);
      if (versionIds.some(id => typeof id !== 'string') || (data.backup_bytes > 0 && !versionIds.length)) throw new OperationError('No se pudieron identificar todos los respaldos de la imagen.');
      return {publicId, assetId:data.asset_id, versionIds};
    },
    async destroy(asset) {
      // Firma e invalidación se generan exclusivamente en el servidor.
      const timestamp = Math.floor(Date.now()/1000);
      const signature = createHash('sha1').update(`invalidate=true&public_id=${asset.publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex');
      const body = new URLSearchParams({public_id:asset.publicId, timestamp:String(timestamp), invalidate:'true', api_key:apiKey, signature});
      const destroyed = await call('/image/destroy', {method:'POST', body});
      if (!['ok', 'not found'].includes(destroyed.result)) throw new OperationError('No se confirmó la eliminación de una imagen.');
      if (asset.assetId && asset.versionIds.length) {
        const backupBody = new URLSearchParams();
        for (const version of asset.versionIds) backupBody.append('version_ids[]', version);
        await call(`/resources/backup/${encodeURIComponent(asset.assetId)}`, {method:'DELETE', body:backupBody}, true);
      }
      const remaining = await inspect(asset.publicId, asset.assetId);
      if (remaining && (remaining.status !== 'not_found' && remaining.status !== 'deleted' || remaining.backup_bytes > 0 || remaining.versions?.length)) {
        throw new OperationError('Cloudinary todavía conserva la imagen o alguna versión de respaldo. Reintenta la destrucción.');
      }
    }
  };
}
