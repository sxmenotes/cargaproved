import { cloudName, uploadPreset } from './cloudinary-config.js';

export async function uploadPhoto(photo) {
  if (!cloudName || !uploadPreset) throw new Error('Falta configurar Cloudinary.');
  if (!(photo?.blob instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.blob.type)) {
    throw new Error('Solo se aceptan fotos JPG, PNG o WebP.');
  }
  if (photo.blob.size > 8 * 1024 * 1024) throw new Error('La foto supera el máximo de 8 MB.');
  const form = new FormData();
  form.append('file', photo.blob, photo.name);
  form.append('upload_preset', uploadPreset);
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {method:'POST', body:form});
  } catch {
    throw new Error('No se pudo conectar con Cloudinary. Revisa tu conexión e inténtalo nuevamente.');
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error?.message || 'No se pudo subir la foto a Cloudinary.');
  const url = json?.secure_url;
  if (typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/')) {
    throw new Error('Cloudinary no devolvió un enlace válido para la foto.');
  }
  return url;
}
