function readPhoto(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function serializeProvider(record) {
  const { photos = [], ...info } = record;
  const exportedPhotos = [];
  for (const photo of photos) {
    if (typeof photo === 'string') exportedPhotos.push(photo);
    else {
      const { blob, url, ...metadata } = photo;
      exportedPhotos.push({ ...metadata, ...(blob ? { dataUrl: await readPhoto(blob) } : url ? { url } : {}) });
    }
  }
  return { ...info, rubro: info.rubro || null, photos: exportedPhotos };
}

export async function buildProvidersExport(records) {
  const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
  const sorted = [...records].sort((a, b) => collator.compare(a.name || '', b.name || '') || String(a.id).localeCompare(String(b.id)));
  const providers = [];
  for (const record of sorted) providers.push(await serializeProvider(record));
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), sortBy: 'name', total: providers.length, providers };
}

export function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
