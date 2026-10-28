import {adminUid} from '../dist/firebase-config.js';
import {cloudName} from '../dist/cloudinary-config.js';
import {adminServices} from '../server/firebase-admin.js';
import {createCloudinaryAdmin, OperationError} from '../server/cloudinary-admin.js';
import {destroyProvider} from '../server/destroy-provider.js';
import migrated from '../server/migrated-photos.json' with {type:'json'};

export function createHandler({services = adminServices, makeCloudinary = createCloudinaryAdmin, env = process.env} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control','no-store');
    if (req.method !== 'POST') {res.setHeader('Allow','POST'); return res.status(405).json({error:'Método no permitido.'});}
    const match = req.headers.authorization?.match(/^Bearer (\S+)$/);
    if (!match) return res.status(401).json({error:'Ingresa como administrador para destruir un proveedor.'});
    try {
      const {auth, store} = services();
      let user;
      try { user = await auth.verifyIdToken(match[1], true); } catch { throw new OperationError('La sesión venció. Ingresa nuevamente.',401); }
      if (user.uid !== adminUid) throw new OperationError('Solo el administrador puede destruir proveedores.',403);
      let body;
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { throw new OperationError('Solicitud inválida.',400); }
      if (!body || Object.keys(body).some(key => !['id','confirmation'].includes(key))) throw new OperationError('Solicitud inválida.',400);
      const cloudinary = makeCloudinary({cloudName, apiKey:env.CLOUDINARY_API_KEY, apiSecret:env.CLOUDINARY_API_SECRET});
      const result = await destroyProvider({...body, store, cloudinary, cloudName, migrated});
      return res.status(200).json(result);
    } catch (error) {
      // No registrar tokens, credenciales, datos del proveedor ni respuestas privadas.
      const status = error instanceof OperationError ? error.status : 503;
      return res.status(status).json({error:error instanceof OperationError ? error.message : 'No se completó la destrucción. La ficha se conserva para reintentar desde Revisados.'});
    }
  };
}
export default createHandler();
