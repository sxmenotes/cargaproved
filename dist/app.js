import {isCloud, login, logout, saveProvider, listProviders, setReviewed, photoUrl} from './storage.js';
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blank = () => ({name:'', description:'', services:'', whatsapp:'', facebook:'', website:'', instagram:'', tiktok:''});
let draft = blank();
try {const saved = JSON.parse(localStorage.getItem('vitrina-draft') || 'null'); if(saved) for(const key of Object.keys(draft)) if(typeof saved[key] === 'string') draft[key] = saved[key];} catch {}
let photos = [], step = 0, admin = false, records = [], currentFilter = 'all', search = '', sending = false, processing = false;
let detailUrls = [], toastTimer;
const contacts = [['whatsapp','WhatsApp','Ej. +54 9 11 1234 5678'],['facebook','Facebook','https://facebook.com/tuempresa'],['website','Sitio web','https://tuempresa.com'],['instagram','Instagram','https://instagram.com/tuempresa'],['tiktok','TikTok','https://tiktok.com/@tuempresa']];
const notice = () => !isCloud ? '<p class="mode-notice"><strong>Versión de prueba.</strong> Los datos y las fotos se guardan solo en este navegador. Todavía no se envían al administrador.</p>' : '';
function toast(message) {clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 5000);}
function focusPage() {$('#main').focus({preventScroll:true}); window.scrollTo({top:0, behavior:'instant'});}
function persistDraft() {try {localStorage.setItem('vitrina-draft', JSON.stringify(draft)); $('#draft-status')?.replaceChildren(document.createTextNode('Los textos se guardan en este navegador. Vuelve a adjuntar las fotos si recargas.'));} catch {$('#draft-status')?.replaceChildren(document.createTextNode('El navegador no permite guardar el borrador. Mantén esta pestaña abierta.'));}}
function home() {
  $('#main').innerHTML = `<section class="hero"><div class="hero-copy"><div class="pill"><i></i> EL PRIMER PASO PARA MOSTRAR LO QUE HACES</div><h1>Tu negocio tiene<br>mucho que <em>mostrar.</em></h1><p>Hagamos que todos lo vean. Comparte la esencia de tu empresa y preparemos juntos tu vitrina virtual.</p><a class="button primary" href="#proveedor">Proveedor, ¡Carga tu información! <span aria-hidden="true">↗</span></a><div class="small-note"><span>Simple y a tu ritmo</span><span>Todo en un solo lugar</span></div></div><div class="hero-art" aria-label="Ejemplo ilustrativo de una vitrina virtual"><div class="float-note"><span class="circle-check">✓</span><div><b>Tu historia, bien contada.</b><small>El comienzo de algo grande</small></div></div><div class="sample-card"><div class="sample-image"><img src="assets/plants.jpg" alt="Plantas y herramientas de un emprendimiento de jardinería" width="1000" height="667"><span>HECHO CON DEDICACIÓN</span></div><div class="sample-body"><small>ASÍ PODRÍA VERSE TU NEGOCIO</small><h3>Raíces & hojas</h3><p>Un poco de naturaleza, en cada espacio.</p><div class="sample-tags"><span>Nuestra historia</span><span>Servicios</span><span>Contacto ↗</span></div></div></div><div class="float-note float-photos"><span class="circle-check">▧</span><div><b>Cada foto cuenta una historia.</b><small>Comparte hasta 10 imágenes</small></div></div><span class="spark" aria-hidden="true">✳</span><span class="art-caption">TU ESENCIA. TU HISTORIA. TU VITRINA.</span></div></section><section class="how" aria-labelledby="how-title"><div class="how-intro"><span class="eyebrow">DE TU NEGOCIO AL MUNDO</span><h2 id="how-title">Así de sencillo.</h2></div><div class="how-item"><span class="step-icon">01</span><div><h3>Cuéntanos quién eres</h3><p>Presenta tu empresa y los servicios que la hacen especial.</p></div></div><div class="how-item"><span class="step-icon">02</span><div><h3>Dale vida con tus fotos</h3><p>Muéstranos tu trabajo con hasta 10 de tus mejores imágenes.</p></div></div><div class="how-item"><span class="step-icon">03</span><div><h3>Nosotros seguimos</h3><p>Con tu material, comenzaremos a crear tu vitrina virtual.</p></div></div></section><section class="admin-banner"><span class="admin-symbol" aria-hidden="true">▦</span><div><h3>¿Administras este espacio?</h3><p>Revisa y organiza el material de tus proveedores.</p></div><button class="button secondary" data-action="login">Administrador <span aria-hidden="true">↗</span></button></section>${notice()}`;
}
function field(key, label, placeholder, max, area = false) {
  return `<div class="field"><label for="${key}">${label} <small>*</small></label>${area ? `<textarea id="${key}" name="${key}" required maxlength="${max}" placeholder="${placeholder}">${esc(draft[key])}</textarea>` : `<input id="${key}" name="${key}" required maxlength="${max}" placeholder="${placeholder}" value="${esc(draft[key])}">`}<div class="field-meta"><span>${key === 'name' ? 'El nombre con el que tus clientes te conocen.' : key === 'description' ? 'Tu historia, tu experiencia y lo que te hace diferente.' : 'Qué ofreces y cómo ayudas a tus clientes.'}</span><span id="count-${key}">${draft[key].length}/${max}</span></div></div>`;
}
function summary(data) {
  return `<div class="review-block"><h3>Nombre del proveedor</h3><p>${esc(data.name)}</p></div><div class="review-block"><h3>Quiénes somos</h3><p>${esc(data.description)}</p></div><div class="review-block"><h3>Servicios que ofrecemos</h3><p>${esc(data.services)}</p></div><div class="review-block"><h3>Contacto</h3><dl>${contacts.filter(([key]) => data[key]).map(([key,label]) => `<dt>${label}</dt><dd>${esc(data[key])}</dd>`).join('') || '<dd>No se agregaron contactos.</dd>'}</dl></div>`;
}
function renderForm() {
  const titles = ['Tu empresa', 'Contacto', 'Fotografías', 'Revisión'];
  let content;
  if(step === 0) content = `<h2>Empecemos por tu historia.</h2><p class="section-intro">Queremos conocer la esencia de tu empresa. Los campos con * son obligatorios.</p>${field('name','Nombre del proveedor','Ej. Raíces & hojas',120)}${field('description','Descripción de la empresa · ¿Quiénes somos?','Cuéntanos sobre tu empresa…',3000,true)}${field('services','Resumen de servicios','Describe los productos o servicios que ofreces…',3000,true)}`;
  if(step === 1) content = `<h2>Que sea fácil encontrarte.</h2><p class="section-intro">Todos estos campos son opcionales. Agrega solo los canales que quieras mostrar en tu vitrina.</p><div class="contact-grid">${contacts.map(([key,label,placeholder]) => `<div class="field"><label for="${key}">${label}<small>Opcional</small></label><input type="${key === 'whatsapp' ? 'tel' : 'url'}" id="${key}" name="${key}" maxlength="500" placeholder="${placeholder}" value="${esc(draft[key])}">${key !== 'whatsapp' ? '<div class="field-meta">Incluye https:// al comienzo del enlace.</div>' : '<div class="field-meta">Incluye el código de tu país.</div>'}</div>`).join('')}</div>`;
  if(step === 2) content = `<h2>Deja que tu trabajo se vea.</h2><p class="section-intro">Agrega fotos de tus productos, servicios o espacios. Puedes continuar sin fotografías.</p><div class="upload-zone" id="upload-zone"><span class="upload-symbol" aria-hidden="true">↥</span><h3>Arrastra tus fotos aquí</h3><p>JPG, PNG o WebP · Hasta 10 fotos · Máximo 8 MB por foto</p><button type="button" class="button secondary" data-action="choose-photos">Seleccionar fotografías <span>＋</span></button><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></div><div class="photo-heading"><strong>Tus fotografías</strong><span id="photo-count">${photos.length} de 10</span></div><div id="photo-grid" class="photo-grid"></div><p class="error" id="photo-error" role="alert"></p>`;
  if(step === 3) content = `<h2>Todo listo para dar el primer paso.</h2><p class="section-intro">Revisa tu información antes de ${isCloud ? 'enviarla' : 'guardarla como prueba'}. Puedes volver para hacer cambios.</p>${summary(draft)}<div class="photo-heading"><strong>Fotografías</strong><span>${photos.length} de 10</span></div><div id="photo-grid" class="photo-grid"></div><label class="consent"><input id="consent" type="checkbox" required><span>Autorizo el uso de la información y las fotografías que comparto para crear la vitrina virtual de mi empresa.</span></label><p class="error" id="submit-error" role="alert"></p>`;
  $('#main').innerHTML = `<div class="page"><a class="text-button back" href="#">← Volver al inicio</a><div class="page-heading"><div><span class="eyebrow">HAGAMOS VISIBLE TU NEGOCIO</span><h1>Tu próxima vitrina empieza aquí.</h1><p>Cuéntanos sobre tu empresa. Nosotros damos el siguiente paso.</p></div><span class="mode-chip">${isCloud ? 'Portal de proveedores' : 'Modo de prueba'}</span></div>${notice()}<div class="form-layout"><aside><ol class="steps">${titles.map((title,i) => `<li><button class="step-button ${i===step?'active':''}" type="button" data-step="${i}" ${i===step?'aria-current="step"':''}><span>${i<step?'✓':String(i+1).padStart(2,'0')}</span>${title}</button></li>`).join('')}</ol><p class="aside-tip">No hace falta tener las palabras perfectas. Cuéntanos qué haces y qué hace especial a tu negocio.</p></aside><form id="provider-form" class="form-card">${content}<div class="form-nav"><button class="text-button" type="button" data-action="previous">← ${step===0?'Inicio':'Anterior'}</button><span class="page-number">Paso ${step+1} de 4</span><button class="button primary" id="next-button" type="submit">${step===3 ? (isCloud?'Enviar información':'Guardar prueba') : 'Continuar'} <span>→</span></button></div><p class="draft-note" id="draft-status">Los textos se guardan en este navegador. Vuelve a adjuntar las fotos si recargas.</p></form></div></div>`;
  if(step >= 2) renderPhotos();
  $('#provider-form').addEventListener('input', event => {
    const el = event.target;
    if(Object.hasOwn(draft, el.name)) {
      draft[el.name] = el.value;
      el.setCustomValidity('');
      const counter = $(`#count-${el.name}`); if(counter) counter.textContent = `${el.value.length}/${el.maxLength}`;
      persistDraft();
    }
  });
  $('#provider-form').addEventListener('submit', async event => {event.preventDefault(); if(processing || sending || !validStep()) return; if(step < 3) {step++;renderForm();focusPage();} else await submitProvider();});
  if(step === 2) {
    $('#photo-input').addEventListener('change', event => {addPhotos([...event.target.files]);event.target.value='';});
    const zone = $('#upload-zone');
    for(const name of ['dragenter','dragover']) zone.addEventListener(name, event => {event.preventDefault();zone.classList.add('dragging');});
    for(const name of ['dragleave','drop']) zone.addEventListener(name, event => {event.preventDefault();zone.classList.remove('dragging');});
    zone.addEventListener('drop', event => addPhotos([...event.dataTransfer.files]));
  }
}
function validStep() {
  for(const input of $('#provider-form').querySelectorAll('input[required]:not([type="checkbox"]),textarea[required]')) input.setCustomValidity(input.value.trim() ? '' : 'Completa este campo con información de tu empresa.');
  if(step === 1) for(const [key] of contacts.slice(1)) {const input = $(`#${key}`);input.setCustomValidity(input.value && !/^https?:\/\//i.test(input.value) ? 'Ingresa un enlace que comience con https:// o http://.' : '');}
  return $('#provider-form').reportValidity();
}
function renderPhotos() {
  const grid = $('#photo-grid'); if(!grid) return;
  grid.innerHTML = photos.map((photo,i) => `<div class="photo-tile"><img src="${photo.url}" alt="${esc(photo.name)}">${step===2?`<button type="button" data-remove="${i}" aria-label="Eliminar foto ${i+1}">×</button>`:''}<small>${esc(photo.name)}</small></div>`).join('');
  if($('#photo-count')) $('#photo-count').textContent = `${photos.length} de 10`;
}
async function addPhotos(files) {
  if(processing || !files.length) return;
  const error = $('#photo-error'); error.textContent = '';
  if(photos.length + files.length > 10) {error.textContent = `Puedes agregar hasta 10 fotos. Tienes ${photos.length}; selecciona como máximo ${10-photos.length} más.`;return;}
  processing = true;$('#next-button').disabled = true;
  const errors = [];
  try {
    for(const file of files) {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {errors.push(`${file.name}: solo se aceptan fotos JPG, PNG o WebP.`);continue;}
      if(file.size > 8*1024*1024) {errors.push(`${file.name}: supera el límite de 8 MB.`);continue;}
      if(photos.some(p => p.name===file.name && p.size===file.size && p.lastModified===file.lastModified)) {errors.push(`${file.name}: esta foto ya está agregada.`);continue;}
      const url = URL.createObjectURL(file);
      try {
        await new Promise((resolve,reject) => {const img = new Image();img.onload=resolve;img.onerror=reject;img.src=url;});
        photos.push({name:file.name, size:file.size, type:file.type, lastModified:file.lastModified, blob:file, url});
      } catch {URL.revokeObjectURL(url);errors.push(`${file.name}: no se pudo leer como imagen.`);}
    }
  } finally {processing=false;if($('#next-button')) $('#next-button').disabled=false;renderPhotos();if($('#photo-error')) $('#photo-error').textContent=errors.join(' ');}
}
async function submitProvider() {
  if(sending || !$('#consent').checked) return;
  sending=true;
  const button = $('#next-button');button.disabled=true;button.textContent='Guardando…';
  const data = {...Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,value.trim()])),photos:photos.map(({url,...photo})=>photo)};
  try {
    const id = await saveProvider(data, message => button.textContent=message);
    draft=blank();photos.forEach(photo=>URL.revokeObjectURL(photo.url));photos=[];
    try {localStorage.removeItem('vitrina-draft');} catch {}
    $('#main').innerHTML=`<div class="page"><div class="success"><div class="success-icon">✓</div><span class="eyebrow">EL PRIMER PASO YA ESTÁ DADO</span><h1>${isCloud?'¡Recibimos tu información!':'¡Tu prueba quedó guardada!'}</h1><p>${isCloud?'Gracias por compartir la esencia de tu negocio. Revisaremos tu material para comenzar a crear tu vitrina virtual.':'Puedes revisar la ficha y las fotos desde el panel de administrador en este mismo navegador. Cuando conectemos Firebase, los proveedores podrán enviar su material desde cualquier dispositivo.'}</p><p>Referencia: <strong>${esc(id.slice(0,8).toUpperCase())}</strong></p><a class="button primary" href="#">Volver al inicio <span>→</span></a></div></div>`;
    history.replaceState(null,'','#listo');focusPage();
  } catch(error) {$('#submit-error').textContent = isCloud ? (error.message.startsWith('Cierra') ? error.message : 'No pudimos enviar la información. Revisa tu conexión y la configuración de Firebase. Tus datos siguen aquí; inténtalo nuevamente.') : 'No pudimos guardar la prueba. Comprueba que el navegador permita almacenamiento y que tenga espacio disponible.';button.disabled=false;button.textContent=isCloud?'Enviar información →':'Guardar prueba →';}
  finally {sending=false;}
}
async function dashboard() {
  $('#main').innerHTML='<div class="page"><p role="status">Cargando proveedores…</p></div>';
  try {records=await listProviders();records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));if(!admin || location.hash!=='#admin')return;renderDashboard();}
  catch {$('#main').innerHTML='<div class="page"><h1>No pudimos cargar los envíos.</h1><p>Revisa la conexión y los permisos de almacenamiento.</p><button class="button primary" data-action="reload">Reintentar</button></div>';}
}
function renderDashboard() {
  $('#main').innerHTML=`<div class="page"><div class="page-heading"><div><span class="eyebrow">TU ESPACIO DE GESTIÓN</span><h1>El comienzo de nuevas vitrinas.</h1><p>Toda la información de tus proveedores, en un solo lugar.</p></div><button class="text-button" data-action="logout">Cerrar sesión ↗</button></div>${notice()}<div class="stats"><div class="stat"><span>Proveedores</span><strong>${records.length}</strong></div><div class="stat"><span>Por revisar</span><strong>${records.filter(r=>r.status==='pending').length}</strong></div><div class="stat"><span>Revisados</span><strong>${records.filter(r=>r.status==='reviewed').length}</strong></div></div><div class="toolbar"><input type="search" id="search" aria-label="Buscar proveedor" placeholder="Buscar por nombre de proveedor…" value="${esc(search)}"><div class="filters">${[['all','Todos'],['pending','Por revisar'],['reviewed','Revisados']].map(([value,label])=>`<button class="filter ${currentFilter===value?'active':''}" data-filter="${value}" aria-pressed="${currentFilter===value}">${label}</button>`).join('')}</div></div><div id="provider-list" class="provider-list"></div></div>`;
  renderList();$('#search').addEventListener('input',event=>{search=event.target.value;renderList();});
}
function renderList() {
  const filtered = records.filter(record=>(currentFilter==='all'||record.status===currentFilter)&&record.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  $('#provider-list').innerHTML=filtered.length ? filtered.map(record=>`<article class="provider-row"><div class="provider-avatar">${esc(record.name.charAt(0).toUpperCase())}</div><div class="provider-info"><h3>${esc(record.name)}</h3><p>${new Date(record.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})} · ${record.photos.length} fotografías</p></div><span class="badge ${record.status==='reviewed'?'reviewed':''}">${record.status==='reviewed'?'Revisado':'Por revisar'}</span><button class="text-button" data-detail="${esc(record.id)}">Ver información ↗</button></article>`).join('') : `<div class="empty"><span class="upload-symbol">▤</span><h3>${records.length?'No encontramos coincidencias.':'Aquí empieza tu próxima vitrina.'}</h3><p>${records.length?'Prueba con otro nombre o cambia el filtro.':'Cuando se guarde información de un proveedor, aparecerá en este espacio.'}</p>${!records.length?'<a class="button secondary" href="#proveedor">Probar el formulario →</a>':''}</div>`;
}
function clearDetail() {detailUrls.forEach(url=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);});detailUrls=[];}
async function openDetail(id) {
  const record=records.find(r=>r.id===id);if(!record||!admin)return;
  clearDetail();$('#detail-content').innerHTML=`<span class="eyebrow">FICHA DEL PROVEEDOR</span><h2>${esc(record.name)}</h2>${summary(record)}<div class="photo-heading"><strong>Fotografías (${record.photos.length})</strong></div><div id="detail-photos" class="photo-grid" role="status">Cargando fotos…</div><p class="error" id="detail-error" role="alert"></p><div class="detail-actions"><button class="button primary" data-review="${esc(id)}" ${record.status==='reviewed'?'disabled':''}>${record.status==='reviewed'?'✓ Revisado':'Marcar como revisado'}</button><button class="button secondary" data-export="${esc(id)}">Descargar información ↓</button></div>`;
  $('#detail-dialog').showModal();
  const urls=await Promise.allSettled(record.photos.map(photoUrl));
  if(!$('#detail-dialog').open) {urls.forEach(r=>{if(r.status==='fulfilled'&&r.value.startsWith('blob:'))URL.revokeObjectURL(r.value);});return;}
  $('#detail-photos').innerHTML=urls.map((result,i)=>{if(result.status==='rejected')return '<p class="error">No se pudo cargar esta foto.</p>';detailUrls.push(result.value);return `<div class="photo-tile"><a href="${esc(result.value)}" target="_blank" rel="noopener noreferrer"><img src="${esc(result.value)}" alt="Fotografía ${i+1} de ${esc(record.name)}"></a><a href="${esc(result.value)}" ${isCloud?'target="_blank" rel="noopener noreferrer"':`download="${esc(record.photos[i].name)}"`}>${isCloud?'Abrir original ↗':'Descargar foto ↓'}</a></div>`;}).join('') || '<p class="section-intro">Sin fotografías adjuntas.</p>';
}
function exportRecord(id) {const record=records.find(r=>r.id===id);if(!record||!admin)return;const {photos,...info}=record;const url=URL.createObjectURL(new Blob([JSON.stringify({...info,photos:photos.map((p,i)=>typeof p==='string'?p:p.name)},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`proveedor-${record.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openLogin() {if(admin){location.hash='admin';return;}$('#login-error').textContent='';$('#login-dialog').showModal();setTimeout(()=>$(isCloud?'#admin-email':'#admin-password').focus(),20);}
$('#email-label').hidden=!isCloud;$('#admin-email').required=isCloud;$('#demo-login').hidden=isCloud;
$('#login-form').addEventListener('submit', async event=>{
  event.preventDefault();const button=$('button[type="submit"]',event.target);button.disabled=true;$('#login-error').textContent='';
  try {await login($('#admin-email').value,$('#admin-password').value);admin=true;$('#admin-password').value='';$('#login-dialog').close();if(location.hash==='#admin')dashboard();else location.hash='admin';}
  catch(error){console.error(error);$('#login-error').textContent=isCloud?`No se pudo ingresar${error.code?` (${error.code})`:`: ${error.message}`}. Revisa tus credenciales y la configuración.`:error.message;}
  finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el)return;
  if((sending||processing) && !el.closest('dialog'))return;
  if(el.dataset.action==='login')openLogin();
  if(el.dataset.action==='close-login')$('#login-dialog').close();
  if(el.dataset.action==='close-detail')$('#detail-dialog').close();
  if(el.dataset.action==='choose-photos')$('#photo-input').click();
  if(el.dataset.action==='previous') {if(step===0)location.hash='';else{step--;renderForm();focusPage();}}
  if(el.dataset.step!==undefined) {const next=Number(el.dataset.step);if(next<=step){step=next;renderForm();}else if(validStep()){step=Math.min(step+1,next);renderForm();}}
  if(el.dataset.remove!==undefined){const [photo]=photos.splice(Number(el.dataset.remove),1);URL.revokeObjectURL(photo.url);renderPhotos();$('#photo-error').textContent='';}
  if(el.dataset.filter){currentFilter=el.dataset.filter;renderDashboard();}
  if(el.dataset.detail)openDetail(el.dataset.detail);
  if(el.dataset.export)exportRecord(el.dataset.export);
  if(el.dataset.review){el.disabled=true;try{const record=records.find(r=>r.id===el.dataset.review);await setReviewed(record);record.status='reviewed';el.textContent='✓ Revisado';renderDashboard();toast('Proveedor marcado como revisado.');}catch{el.disabled=false;$('#detail-error').textContent='No se pudo actualizar. Inténtalo nuevamente.';}}
  if(el.dataset.action==='reload'&&admin)dashboard();
  if(el.dataset.action==='logout'){try{await logout();admin=false;location.hash='';}catch{toast('No pudimos cerrar la sesión. Inténtalo nuevamente.');}}
});
$('#detail-dialog').addEventListener('close',clearDetail);
function route(){if(sending||processing)return;const hash=location.hash;if(hash==='#proveedor'){step=0;renderForm();}else if(hash==='#admin'){if(admin)dashboard();else{home();openLogin();}}else home();focusPage();}
window.addEventListener('hashchange',route);
window.addEventListener('beforeunload',event=>{if(sending||processing){event.preventDefault();event.returnValue='';}});
route();
