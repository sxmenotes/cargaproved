// Los errores de infraestructura de Vercel pueden ser texto o HTML, sin JSON.
export async function readDestructionResponse(response) {
  const data = await response.json().catch(() => null);
  if (response.ok && data?.deleted === true) return data;
  if (typeof data?.error === 'string' && data.error) throw new Error(data.error);
  const code = response.headers.get('x-vercel-error');
  if (code === 'FUNCTION_INVOCATION_FAILED') {
    throw new Error('La función de borrado no pudo arrancar en Vercel (HTTP 500). Revisa el error de inicio en Vercel → Logs; actualizar las reglas de Firebase no resuelve este fallo.');
  }
  if (response.status === 404) throw new Error('Vercel no encuentra /api/destroy-provider (HTTP 404). Comprueba que Root Directory sea la raíz del repositorio y vuelve a desplegar.');
  if (response.status === 504 || code === 'FUNCTION_INVOCATION_TIMEOUT') throw new Error('Vercel agotó el tiempo de ejecución. Actualiza el panel y reintenta si la ficha aparece como Destrucción pendiente.');
  if ([401,403].includes(response.status)) throw new Error(`Vercel rechazó el acceso a la función (HTTP ${response.status}). Revisa la sesión y la protección del despliegue.`);
  if (response.ok) throw new Error('La dirección de borrado respondió sin confirmar la eliminación. Comprueba las rutas y el despliegue de la función en Vercel.');
  throw new Error(`La función de borrado devolvió HTTP ${response.status} sin un error JSON. Revisa Vercel → Logs antes de reintentar.`);
}
