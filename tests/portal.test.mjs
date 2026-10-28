import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {RUBROS} from '../dist/provider-config.js';
let browser;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const file = i => ({name:`foto-${i}.png`,mimeType:'image/png',buffer:png});
before(async()=>{browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});});
after(async()=>{await browser?.close();});
async function start(viewport={width:1440,height:1000}) {const context=await browser.newContext({viewport});const page=await context.newPage();await page.route('**/firebase-config.js', route => route.fulfill({contentType:'text/javascript',body:'export const firebaseConfig = null; export const adminUid = null; export const imgbbKey = null;'}));await page.goto('http://localhost:4173');return{context,page};}
async function business(page,name='Jardín de prueba') {
  await page.getByRole('link',{name:'Proveedor, ¡Carga tu información!'}).click();
  await page.locator('#name').fill(name);await page.locator('#rubro').selectOption('Diseño y Ambientación');await page.locator('#description').fill('Somos una empresa de jardinería con diez años de experiencia.');await page.locator('#services').fill('Diseño de jardines y mantenimiento de espacios verdes.');
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
  await page.locator('#photo-input').setInputFiles(Array.from({length:6},(_,i)=>file(i)));
  await page.getByText('Puedes agregar hasta 5 fotos.').waitFor();assert.equal(await page.locator('.photo-tile').count(),0);
  await page.locator('#photo-input').setInputFiles(Array.from({length:5},(_,i)=>file(i)));
  await page.getByText('5 de 5',{exact:true}).waitFor();assert.equal(await page.locator('.photo-tile').count(),5);
  await page.locator('#photo-input').setInputFiles(file(6));await page.getByText('Puedes agregar hasta 5 fotos.').waitFor();assert.equal(await page.locator('.photo-tile').count(),5);
  await page.getByRole('button',{name:'Eliminar foto 5',exact:true}).click();await page.getByText('4 de 5',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Continuar'}).click();
  await page.locator('#consent').check();await page.getByRole('button',{name:'Guardar prueba'}).click();await page.getByRole('heading',{name:'¡Tu prueba quedó guardada!'}).waitFor();
  await page.reload();await adminLogin(page);
  await page.getByRole('button',{name:'Ver información'}).click();await page.locator('#detail-photos img').first().waitFor();
  assert.equal(await page.locator('#detail-photos img').count(),4);
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
  await page.locator('#name').fill('Proveedor sin fotos');await page.getByRole('button',{name:'Continuar'}).click();assert.ok(await page.locator('#rubro').isVisible());assert.equal(await page.locator('#rubro').evaluate(el => el.validity.valueMissing),true);
  assert.deepEqual(await page.locator('#rubro option').evaluateAll(options => options.slice(1).map(option => option.value)),RUBROS);
  await page.locator('#rubro').selectOption('Registro Audiovisual');await page.reload();assert.equal(await page.locator('#rubro').inputValue(),'Registro Audiovisual');assert.equal(await page.locator('#name').inputValue(),'Proveedor sin fotos');
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
  await business(page);await page.getByRole('button',{name:'Anterior'}).click();await page.screenshot({path:'test-results/rubro-movil.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Continuar'}).click();await page.getByRole('button',{name:'Continuar'}).click();await page.screenshot({path:'test-results/formulario-movil.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
});

async function seedProviders(page) {
  await page.evaluate(async base64 => {
    const db = await new Promise((resolve,reject) => {const request=indexedDB.open('tu-vitrina',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const blob=new Blob([bytes],{type:'image/png'});
    const base={description:'Descripción completa',services:'Servicios completos',whatsapp:'+56912345678',facebook:'',website:'https://example.com',instagram:'',tiktok:'',createdAt:'2026-10-01T12:00:00.000Z',status:'pending'};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('providers','readwrite');const store=tx.objectStore('providers');
      store.add({...base,id:'legacy',name:'Zeta anterior',photos:Array.from({length:10},(_,i)=>({name:`anterior-${i}.png`,type:'image/png',size:blob.size,lastModified:123,blob}))});
      store.add({...base,id:'new',name:'Álamo nuevo',rubro:'Registro Audiovisual',status:'reviewed',photos:[],extra:'Dato conservado'});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  },png.toString('base64'));
}

async function readDownload(page,button) {
  const pending=page.waitForEvent('download');await button.click();const download=await pending;
  assert.match(download.suggestedFilename(),/\.json$/);
  return JSON.parse(await readFile(await download.path(),'utf8'));
}

test('fichas existentes conservan diez fotos y se exportan completas, sin filtros y ordenadas',async()=>{
  const {context,page}=await start();await seedProviders(page);await adminLogin(page);
  await page.getByRole('button',{name:'Por revisar',exact:true}).click();await page.getByRole('searchbox').fill('Zeta');
  assert.equal(await page.locator('.provider-row').count(),1);
  await page.getByRole('button',{name:'Ver información'}).click();await page.locator('#detail-photos img').last().waitFor();
  assert.equal(await page.locator('#detail-photos img').count(),10);
  assert.ok(await page.locator('#detail-content').getByText('Sin rubro informado',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Marcar como revisado'}).click();await page.getByRole('button',{name:'✓ Revisado',exact:true}).waitFor();
  const individual=await readDownload(page,page.getByRole('button',{name:'Descargar información'}));
  assert.equal(individual.photos.length,10);assert.equal(individual.rubro,null);assert.equal(individual.status,'reviewed');
  await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  const exported=await readDownload(page,page.getByRole('button',{name:'Descargar todos los proveedores'}));
  assert.equal(exported.total,2);assert.deepEqual(exported.providers.map(p=>p.name),['Álamo nuevo','Zeta anterior']);
  assert.equal(exported.providers[0].rubro,'Registro Audiovisual');assert.equal(exported.providers[0].extra,'Dato conservado');
  assert.equal(exported.providers[1].photos.length,10);assert.equal(exported.providers[1].photos[0].dataUrl,`data:image/png;base64,${png.toString('base64')}`);
  assert.equal(exported.providers[1].photos[0].name,'anterior-0.png');assert.equal(exported.providers[1].whatsapp,'+56912345678');
  assert.equal(exported.providers[1].createdAt,'2026-10-01T12:00:00.000Z');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/admin-movil.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();
});

test('validación de almacenamiento, exportación vacía y URLs de fotos sin recortes',async()=>{
  const {context,page}=await start();
  const result=await page.evaluate(async()=>{
    const {saveProvider}=await import('/storage.js');const {buildProvidersExport}=await import('/export.js');
    const errors=[];
    for(const data of [{rubro:'Registro Audiovisual',photos:Array(6).fill({})},{rubro:'Inventado',photos:[]}]) {
      try {await saveProvider(data);} catch(error) {errors.push(error.message);}
    }
    const photos=Array.from({length:10},(_,i)=>`https://example.com/photo-${i}.jpg`);
    const exported=await buildProvidersExport([{id:'old-cloud',name:'Antiguo',photos,ownerUid:'owner',status:'pending'}]);
    return {errors,exported};
  });
  assert.equal(result.errors.length,2);assert.match(result.errors[0],/5 fotos/);assert.match(result.errors[1],/rubro válido/);
  assert.equal(result.exported.providers[0].photos.length,10);assert.equal(result.exported.providers[0].photos[9],'https://example.com/photo-9.jpg');
  assert.equal(result.exported.providers[0].ownerUid,'owner');
  await adminLogin(page);const exported=await readDownload(page,page.getByRole('button',{name:'Descargar todos los proveedores'}));
  assert.equal(exported.total,0);assert.deepEqual(exported.providers,[]);await context.close();
});
