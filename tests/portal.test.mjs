import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
let browser;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const file = i => ({name:`foto-${i}.png`,mimeType:'image/png',buffer:png});
before(async()=>{browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});});
after(async()=>{await browser?.close();});
async function start(viewport={width:1440,height:1000}) {const context=await browser.newContext({viewport});const page=await context.newPage();await page.goto('http://localhost:4173');return{context,page};}
async function business(page,name='Jardín de prueba') {
  await page.getByRole('link',{name:'Proveedor, ¡Carga tu información!'}).click();
  await page.locator('#name').fill(name);await page.locator('#description').fill('Somos una empresa de jardinería con diez años de experiencia.');await page.locator('#services').fill('Diseño de jardines y mantenimiento de espacios verdes.');
  await page.getByRole('button',{name:'Continuar'}).click();
}
async function adminLogin(page) {await page.getByRole('button',{name:/Administrador/}).first().click();await page.locator('#admin-password').fill('Vitrina2026!');await page.getByRole('button',{name:/Ingresar al panel/}).click();await page.getByRole('heading',{name:'El comienzo de nuevas vitrinas.'}).waitFor();}
test('recorrido completo, validación de fotos, persistencia y administración',async()=>{
  const {context,page}=await start();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await business(page,'Raíces <script>alert(1)</script>');
  await page.locator('#instagram').fill('https://instagram.com/ejemplo');
  await page.getByRole('button',{name:'Continuar'}).click();
  await page.locator('#photo-input').setInputFiles({name:'contrato.pdf',mimeType:'application/pdf',buffer:Buffer.from('pdf')});
  await page.getByText('contrato.pdf: solo se aceptan').waitFor();
  await page.locator('#photo-input').setInputFiles({name:'falsa.png',mimeType:'image/png',buffer:Buffer.from('no es una imagen')});
  await page.getByText('falsa.png: no se pudo leer como imagen.').waitFor();
  await page.locator('#photo-input').setInputFiles({name:'grande.png',mimeType:'image/png',buffer:Buffer.alloc(8*1024*1024+1)});
  await page.getByText('grande.png: supera el límite').waitFor();
  await page.locator('#photo-input').setInputFiles(Array.from({length:11},(_,i)=>file(i)));
  await page.getByText('Puedes agregar hasta 10 fotos.').waitFor();assert.equal(await page.locator('.photo-tile').count(),0);
  await page.locator('#photo-input').setInputFiles(Array.from({length:10},(_,i)=>file(i)));
  await page.getByText('10 de 10',{exact:true}).waitFor();assert.equal(await page.locator('.photo-tile').count(),10);
  await page.getByRole('button',{name:'Eliminar foto 10',exact:true}).click();await page.getByText('9 de 10',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Continuar'}).click();
  await page.locator('#consent').check();await page.getByRole('button',{name:'Guardar prueba'}).click();await page.getByRole('heading',{name:'¡Tu prueba quedó guardada!'}).waitFor();
  await page.reload();await adminLogin(page);
  await page.getByRole('button',{name:'Ver información'}).click();await page.locator('#detail-photos img').first().waitFor();
  assert.equal(await page.locator('#detail-photos img').count(),9);
  assert.equal(await page.locator('#detail-content h2').textContent(),'Raíces <script>alert(1)</script>');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar información'}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^proveedor-.*\.json$/);
  await page.getByRole('button',{name:'Marcar como revisado'}).click();await page.getByRole('button',{name:'✓ Revisado',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  await page.getByRole('button',{name:'Por revisar',exact:true}).click();await page.getByRole('heading',{name:'No encontramos coincidencias.'}).waitFor();
  await page.getByRole('button',{name:'Revisados',exact:true}).click();assert.equal(await page.locator('.provider-row').count(),1);
  await page.getByRole('searchbox').fill('no existe');assert.equal(await page.locator('.provider-row').count(),0);
  await page.getByRole('button',{name:'Cerrar sesión'}).click();await page.getByRole('link',{name:'Proveedor, ¡Carga tu información!'}).waitFor();assert.equal(new URL(page.url()).hash,'');
  assert.deepEqual(errors,[]);await context.close();
});
test('campos obligatorios, contactos y fotos opcionales, borrador y clave incorrecta',async()=>{
  const {context,page}=await start();
  await page.getByRole('link',{name:'Proveedor, ¡Carga tu información!'}).click();await page.getByRole('button',{name:'Continuar'}).click();assert.ok(await page.locator('#name').isVisible());
  await page.locator('#name').fill('   ');await page.locator('#description').fill('Descripción');await page.locator('#services').fill('Servicios');await page.getByRole('button',{name:'Continuar'}).click();assert.ok(await page.locator('#name').isVisible());
  await page.locator('#name').fill('Proveedor sin fotos');await page.reload();assert.equal(await page.locator('#name').inputValue(),'Proveedor sin fotos');
  await page.getByRole('button',{name:'Continuar'}).click();await page.locator('#website').fill('javascript:alert(1)');await page.getByRole('button',{name:'Continuar'}).click();assert.ok(await page.locator('#website').isVisible());
  await page.locator('#website').fill('');await page.getByRole('button',{name:'Continuar'}).click();await page.getByRole('button',{name:'Continuar'}).click();
  await page.getByRole('button',{name:'Guardar prueba'}).click();assert.ok(await page.locator('#consent').isVisible());await page.locator('#consent').check();await page.getByRole('button',{name:'Guardar prueba'}).click();await page.getByRole('heading',{name:'¡Tu prueba quedó guardada!'}).waitFor();
  await page.getByRole('link',{name:'Volver al inicio'}).click();await page.getByRole('button',{name:/Administrador/}).first().click();await page.locator('#admin-password').fill('incorrecta');await page.getByRole('button',{name:/Ingresar al panel/}).click();await page.getByText('Contraseña incorrecta.').waitFor();
  await page.keyboard.press('Escape');await page.goto('http://localhost:4173/#admin');assert.ok(await page.locator('#login-dialog').isVisible());assert.equal(await page.locator('.provider-row').count(),0);await context.close();
});
test('portada y formulario adaptados a escritorio y móvil',async()=>{
  const {context,page}=await start();await page.screenshot({path:'test-results/inicio-escritorio.png',fullPage:true});
  assert.ok(await page.locator('.sample-image img').evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/inicio-movil.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await business(page);await page.getByRole('button',{name:'Continuar'}).click();await page.screenshot({path:'test-results/formulario-movil.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
});
