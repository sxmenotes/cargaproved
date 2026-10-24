# Conectar Tu Vitrina a Firebase

La página ya incluye el adaptador para Firebase. Mientras `firebaseConfig` sea `null`, funciona en modo de prueba: guarda fichas y fotos en IndexedDB del navegador. No se reciben envíos de otras personas. La clave `Vitrina2026!` es pública y solo sirve para recorrer la demostración; no protege los datos locales.

Firebase se usará para tres cosas: Authentication para tu acceso, Firestore para los textos y Cloud Storage para las fotografías. No hace falta conectar ImgBB además de Firebase.

## 1. Crear el proyecto y registrar la web

1. Entra a [Firebase Console](https://console.firebase.google.com/) con tu cuenta de Google.
2. Crea un proyecto, por ejemplo `mi-vitrina-proveedores`. Analytics es opcional.
3. En Configuración del proyecto → General, agrega una aplicación web con el botón `</>`.
4. Copia el objeto `firebaseConfig` que muestra Firebase. Es la configuración pública de la aplicación; no es una contraseña de administrador.

## 2. Habilitar el acceso

1. En Authentication → Método de acceso, habilita **Correo electrónico/contraseña** y **Anónimo**. Los proveedores usarán una sesión anónima sin tener que registrarse.
2. En Authentication → Usuarios, crea tu cuenta de administrador con tu correo y una contraseña propia. No uses la clave de demostración.
3. Copia el UID de esa cuenta.
4. En Authentication → Configuración → Dominios autorizados, agrega el dominio desde el que abrirás la web. Para probar localmente, agrega `localhost` y `127.0.0.1` si no están incluidos.

## 3. Crear la base de datos

1. En Firestore Database, crea una base **Standard**, con identificador `(default)`, en modo producción.
2. Elige la región adecuada para tus usuarios.
3. Abre `firestore.rules` y reemplaza `REEMPLAZAR_UID_ADMIN` por tu UID.
4. Copia el contenido en la pestaña Reglas de Firestore y pulsa Publicar.

Las reglas permiten crear una ficha por sesión anónima. Solo tu UID puede leer las fichas y marcarlas como revisadas. Otros visitantes no pueden listar proveedores.

## 4. Crear el almacenamiento de fotografías

1. En Storage, pulsa Comenzar y crea el bucket.
2. **Cloud Storage requiere actualmente el plan Blaze y una cuenta de facturación.** Configura alertas de presupuesto en Google Cloud; las alertas no son un límite automático de gasto. Consulta los costos antes de habilitarlo: [requisitos oficiales de Cloud Storage](https://firebase.google.com/docs/storage/web/start) y [planes de Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).
3. En `storage.rules`, reemplaza `REEMPLAZAR_UID_ADMIN` por el mismo UID.
4. Copia esas reglas en la pestaña Reglas de Storage y publícalas. Si Firebase pide habilitar el acceso de las reglas de Storage a Firestore, acepta esa vinculación dentro de tu proyecto.

Las reglas limitan cada ficha a diez posiciones de imagen, de 0 a 9, y a 8 MB por archivo. Al finalizar el envío, el proveedor no puede alterar las fotos. La web comprueba que las imágenes puedan abrirse; las reglas comprueban tamaño y tipo MIME declarado. Los originales se consultan desde tu panel.

## 5. Conectar la página

Edita `dist/firebase-config.js` y cambia su contenido por tus valores reales:

```js
export const firebaseConfig = {
  apiKey: 'VALOR_DE_FIREBASE',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  storageBucket: 'NOMBRE_EXACTO_DEL_BUCKET',
  messagingSenderId: 'VALOR_DE_FIREBASE',
  appId: 'VALOR_DE_FIREBASE'
};
export const adminUid = 'UID_DE_TU_USUARIO_ADMIN';
```

Usa el nombre exacto del bucket que muestra Firebase. No incluyas tu contraseña ni claves privadas de una cuenta de servicio en ningún archivo del sitio. El UID de configuración habilita el acceso de la interfaz; las reglas del servidor son las que realmente autorizan la lectura.

Al recargar la página, desaparece el aviso de demostración, el acceso solicita correo y contraseña, y los envíos pasan a Firebase. Los datos de prueba locales no se migran automáticamente.

## 6. Comprobar antes de compartir

1. En una ventana privada, completa el formulario y envía una ficha con fotos. Comprueba que se ve la confirmación.
2. En otro navegador o dispositivo, entra como administrador: debes ver esa misma ficha, sus textos y sus fotos originales.
3. Comprueba un intento de contraseña incorrecta, un archivo PDF, una imagen de más de 8 MB y una selección de 11 fotos.
4. Comprueba en el simulador de reglas de Firebase que un usuario sin autenticar y otro usuario anónimo no pueden leer fichas ni fotos.
5. Vuelve a publicar la carpeta `dist` con la configuración real. La publicación inicial en Sites es privada y sirve para revisar la demo; para recibir clientes deberá tener audiencia pública o alojarse en tu dominio público. No cambies las reglas de Firebase a lectura pública para resolver el acceso al sitio.

La integración está preparada, pero no ha sido probada contra tu proyecto real porque todavía no tenemos su configuración. Las reglas tampoco se han desplegado. Para un formulario público con mucho tráfico, se puede añadir App Check y control de abuso; la autenticación anónima no impide envíos repetidos. El límite es por ficha, no una verificación de identidad comercial. No hay notificaciones por correo: los nuevos envíos se consultan al abrir o recargar el panel.

Fuentes: [SDK web por CDN](https://firebase.google.com/docs/web/alt-setup), [autenticación anónima](https://firebase.google.com/docs/auth/web/anonymous-auth), [reglas de Storage y acceso a Firestore](https://firebase.google.com/docs/storage/security/rules-conditions).
