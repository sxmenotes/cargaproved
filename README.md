# Tu Vitrina · Portal de proveedores

Web responsive en español, sin compilación y con dos accesos: proveedor y administrador.

## Abrir localmente

```sh
cd tu-vitrina
npm run dev
```

Abre http://localhost:4173. El servidor usa Node.js y no requiere instalar dependencias para servir la página. Usa HTTP; abrir directamente `index.html` con `file://` no admite los módulos JavaScript.

## Funciones

- Formulario en cuatro pasos con nombre, rubro, descripción y servicios obligatorios.
- WhatsApp, Facebook, sitio web, Instagram y TikTok opcionales.
- Hasta cinco fotos JPG, PNG o WebP, de máximo 8 MB cada una; arrastrar, vista previa, quitar y validar archivos.
- Revisión previa y autorización para usar el material en la vitrina.
- Borrador de textos local. Las fotos seleccionadas se mantienen en memoria hasta el envío; una vez enviadas se guardan como archivos en IndexedDB o Firebase.
- Panel con contraseña, búsqueda, filtros, detalle, descarga de datos y fotos, y marcado como revisado.
- Rubros tomados de [Red de Proveedores del Maule](https://www.redproveedoresdelmaule.cl/#rubros). Las fichas anteriores sin rubro siguen disponibles.
- Descarga general JSON con todos los proveedores ordenados por nombre (A–Z), sin depender de la búsqueda ni de los filtros. Incluye todos los campos, fechas, estado y fotos: URLs en Firebase y datos base64 con metadatos en modo local.
- El máximo de cinco fotos se aplica solo a nuevos envíos; las fotos existentes se conservan completas.
- Estados vacíos, errores de guardado y confirmación de envío.

## Modo de prueba

Clave pública de demostración: **Vitrina2026!**. Los envíos solo existen en el navegador que los creó; no hay protección real por contraseña en este modo. El sitio informa esto tanto en la portada como en el formulario y el acceso de administrador. Al conectar Firebase, la clave de demostración deja de funcionar.

Consulta [GUIA-FIREBASE.md](GUIA-FIREBASE.md) para recibir información de clientes, configurar tu cuenta privada y publicar las reglas. El adaptador de Firebase está preparado pero requiere validación con un proyecto real.

## Pruebas

```sh
npm install
npm run dev
# En otra terminal:
npm test
```

Las pruebas necesitan Chromium instalado por Playwright o `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` apuntando a un ejecutable compatible.

## Archivos

`dist/` contiene todo el sitio publicable. `app.js` maneja la interfaz; `storage.js` selecciona IndexedDB o Firebase según `firebase-config.js`. Las reglas y la guía permanecen fuera de los archivos públicos.

Fotografía decorativa: [Unsplash](https://images.unsplash.com/photo-1416879595882-3373a0480b5b) (servida desde una copia local de images.unsplash.com). La tarjeta «Raíces & hojas» es una ilustración, no un proveedor real. Tipografías DM Sans y Manrope desde Google Fonts, con fuentes del sistema como alternativa.

Para actualizar un sitio conectado a Firebase, publica primero `firestore.rules` en el proyecto y después `dist/`. Las reglas nuevas admiten el rubro obligatorio y limitan las creaciones a cinco fotos; la lectura y el marcado como revisado de fichas anteriores no cambian.
