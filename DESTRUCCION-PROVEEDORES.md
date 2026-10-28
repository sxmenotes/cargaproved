# Destrucción de proveedores en Vercel

El panel divide los proveedores entre Por revisar y Revisados. Marcar una ficha como revisada la traslada al segundo grupo. Solo las fichas revisadas o con una destrucción pendiente muestran Destruir proveedor. Para ejecutar el borrado hay que escribir el nombre exacto y aceptar la confirmación.

La función `POST /api/destroy-provider` verifica el ID token de Firebase, su revocación y el UID del administrador. Lee la ficha desde Firestore: el navegador no puede elegir imágenes arbitrarias. Las credenciales privadas no se envían al navegador.

## Configuración necesaria

En el proyecto Vercel, Settings → Environment Variables, agregar estas variables para Production:

| Variable | Valor |
| --- | --- |
| `CLOUDINARY_API_KEY` | API Key de la cuenta `zytomafs`, desde Cloudinary Settings → API Keys. |
| `CLOUDINARY_API_SECRET` | API Secret de esa misma clave. Marcar como sensible. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Contenido completo del JSON de una cuenta de servicio del proyecto `vitrina-prov`. Marcar como sensible. |

Para obtener el JSON: Firebase Console → Configuración del proyecto → Cuentas de servicio → Firebase Admin SDK → Generar nueva clave privada. No subir el archivo a GitHub, no pegarlo en el chat ni ponerlo en `dist/`. Si hay una política de organización que impide generar claves, usar una identidad de servicio autorizada en lugar de debilitar esa política.

La cuenta de servicio necesita permisos de administración de datos de Firestore y de Firebase Authentication. Las claves generadas desde Firebase normalmente corresponden al usuario de servicio del SDK Admin; si se usa una cuenta personalizada, asignar los roles adecuados desde Google Cloud IAM. No se requiere Firebase Storage, Firebase Functions ni activar Blaze. El consumo de Firestore, Authentication y Vercel sigue sujeto a sus cuotas.

En Vercel, el Root Directory debe ser la raíz de este repositorio; `dist/` es el Output Directory. La carpeta `api/` debe desplegarse como función, no como archivo estático. `vercel.json` contiene la configuración y `package.json` fija Node.js 22 para la función. Las variables nuevas se aplican al siguiente despliegue: hacer Redeploy después de guardarlas.

Publicar también el `firestore.rules` actualizado en Firebase Console → Firestore Database → Reglas. Mantiene prohibida la eliminación directa desde el navegador y evita que una ficha en destrucción vuelva a marcarse como revisada. El SDK Admin del servidor aplica la eliminación con su cuenta de servicio.

## Qué elimina y cómo se recupera de fallos

1. Verifica que la ficha esté revisada y que el nombre confirmado coincida.
2. Identifica los originales de Cloudinary y sus versiones de respaldo. Comprueba que no estén referenciados por otra ficha. Rechaza enlaces desconocidos en vez de borrar datos incompletos.
3. Guarda en la propia ficha un plan de destrucción y cambia su estado a `deleting`. Permanece visible en Revisados como Destrucción pendiente.
4. Destruye cada imagen y sus derivados, solicita la invalidación de CDN y elimina las versiones de respaldo identificadas. Verifica el resultado y registra el progreso en la ficha para reanudar tras un fallo o un timeout.
5. Elimina la cuenta anónima de Firebase Authentication asociada al documento si su UID coincide, sin afectar cuentas personales o de administrador.
6. Elimina el documento de Firestore. No conserva papelera ni copia propia en servidor.

Si la función falla o Vercel interrumpe la ejecución, la ficha conserva el plan y los archivos ya eliminados no se restauran. Volver a usar Destruir proveedor permite continuar. Solo se anuncia éxito si se completan los pasos.

No se ejecutó ninguna destrucción sobre proveedores reales durante las pruebas. Las pruebas usan servicios simulados y datos locales.

## Alcance y límites de la eliminación

- El borrado del original y sus respaldos de Cloudinary es irreversible desde el panel. La invalidación de CDN puede tardar en propagarse.
- Los ZIP, JSON y fotos ya descargados, copias en equipos de terceros, logs o backups administrados por la infraestructura fuera de la aplicación no se pueden borrar desde este botón. Los backups/PITR/exportaciones externos de Firestore deben gestionarse por separado si están habilitados.
- Las 34 fotos migradas tienen una correspondencia en `server/migrated-photos.json`. Permite eliminar su copia de Cloudinary incluso si Firestore aún conserva su URL antigua de ImgBB. El mapa solo contiene enlaces e identificadores; no se publican las fichas ni sus datos de contacto. Después de destruir una ficha, no volver a importar una exportación antigua: recrearía los datos con enlaces ya eliminados.
- ImgBB no ofrece borrado permanente de fotos antiguas mediante esta integración. Sus originales deben eliminarse desde la cuenta de ImgBB si se desea eliminar también esa copia.
- Si aparecen imágenes compartidas con otra ficha, enlaces no reconocidos, subcolecciones o respaldos que Cloudinary no confirma haber borrado, la operación se detiene para evitar declarar una eliminación total incompleta.

Fuentes: [borrado de Cloudinary](https://cloudinary.com/documentation/delete_assets), [respaldos y versiones](https://cloudinary.com/documentation/backups_and_version_management), [Admin API](https://cloudinary.com/documentation/admin_api), [Firebase Admin](https://firebase.google.com/docs/admin/setup), [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js).
