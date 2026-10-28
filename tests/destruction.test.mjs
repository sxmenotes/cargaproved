import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OperationError, photoPublicId, createCloudinaryAdmin} from '../server/cloudinary-admin.js';
import {destroyProvider} from '../server/destroy-provider.js';
import {createHandler} from '../api/destroy-provider.js';
import {adminUid} from '../dist/firebase-config.js';
const cloudName='zytomafs';
const url=id=>`https://res.cloudinary.com/${cloudName}/image/upload/v123/${id}.png`;
function fixture(record={id:'provider',name:'Prueba',status:'reviewed',photos:[url('one'),url('two')]},others=[]) {
  let current=structuredClone(record);
  const calls=[];
  return {calls, current:()=>current, store:{
    get:async()=>current,
    list:async()=>[current,...others],
    lock:async(id,original,assets)=>{calls.push('lock'); current.status='deleting'; current.destruction={assets, completed:current.destruction?.completed || []};},
    complete:async(id,pub)=>{calls.push('complete:'+pub);current.destruction.completed.push(pub);},
    removeOwner:async()=>{calls.push('removeOwner');},
    remove:async()=>{calls.push('remove');current=null;}
  }, cloudinary:{plan:async publicId=>({publicId,assetId:'asset-'+publicId,versionIds:[]}),destroy:async asset=>{calls.push('destroy:'+asset.publicId);}}};
}
const run=f=>destroyProvider({id:'provider',confirmation:'Prueba',cloudName,...f});
test('solo revisados, nombre exacto y referencias del servidor; sin efectos ante rechazo',async()=>{
  for(const record of [
    {id:'provider',name:'Prueba',status:'pending',photos:[url('one')]},
    {id:'provider',name:'Otro',status:'reviewed',photos:[url('one')]},
    {id:'provider',name:'Prueba',status:'reviewed',photos:['https://attacker.example/a.png']}
  ]) {
    const f=fixture(record);await assert.rejects(run(f));assert.deepEqual(f.calls,[]);
  }
});
test('bloquea una imagen usada por otro proveedor antes de borrar',async()=>{
  const f=fixture(undefined,[{id:'other',photos:[url('one')]}]);
  await assert.rejects(run(f),/compartida/);assert.deepEqual(f.calls,[]);
});
test('borra imágenes antes de la cuenta anónima y la ficha; reintenta tras fallo parcial',async()=>{
  const f=fixture();let fail=true;
  f.cloudinary.destroy=async asset=>{f.calls.push('destroy:'+asset.publicId);if(asset.publicId==='two'&&fail) throw new OperationError('Cloudinary no disponible');};
  await assert.rejects(run(f),/no disponible/);
  assert.equal(f.current().status,'deleting');assert.deepEqual(f.current().destruction.completed,['one']);
  assert.ok(!f.calls.includes('remove'));assert.ok(!f.calls.includes('removeOwner'));
  fail=false;await run(f);
  assert.equal(f.calls.filter(c=>c==='destroy:one').length,1);
  assert.deepEqual(f.calls.slice(-2),['removeOwner','remove']);assert.equal(f.current(),null);
});
test('no elimina la ficha si fallan respaldos o identificación previa',async()=>{
  const f=fixture();f.cloudinary.plan=async()=>{throw new Error('no se pueden listar respaldos');};
  await assert.rejects(run(f));assert.deepEqual(f.calls,[]);
  const g=fixture();g.cloudinary.destroy=async()=>{throw new Error('falló respaldo');};
  await assert.rejects(run(g));assert.ok(!g.calls.includes('remove'));
});
test('identifica originales y migración; rechaza otra cuenta, transformaciones y rutas ambiguas',()=>{
  assert.equal(photoPublicId(url('folder/photo'),cloudName),'folder/photo');
  assert.equal(photoPublicId('https://i.ibb.co/old.png',cloudName,{'https://i.ibb.co/old.png':'migrated'}),'migrated');
  for(const bad of [url('one').replace(cloudName,'other'),url('one').replace('/v123/','/w_100/v123/'),url('one')+'?evil=yes','not-a-url']) assert.throws(()=>photoPublicId(bad,cloudName));
});
test('Cloudinary: firma privada, invalida caché, elimina versiones y comprueba el resultado',async()=>{
  const calls=[];
  const client=createCloudinaryAdmin({cloudName,apiKey:'key',apiSecret:'secret',request:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/image/destroy')) return Response.json({result:'ok'});
    if(url.includes('/resources/backup/')) return Response.json({deleted:['version1']});
    if(calls.length===1) return Response.json({public_id:'one',asset_id:'asset1',resource_type:'image',backup_bytes:25,versions:[{version_id:'version1',restorable:true}]});
    return new Response('',{status:404});
  }});
  const asset=await client.plan('one');await client.destroy(asset);
  assert.equal(calls.length,4);
  const form=calls[1].options.body;
  assert.equal(form.get('invalidate'),'true');
  assert.equal(form.get('signature'),createHash('sha1').update(`invalidate=true&public_id=one&timestamp=${form.get('timestamp')}secret`).digest('hex'));
  assert.deepEqual(calls[2].options.body.getAll('version_ids[]'),['version1']);
});
test('Cloudinary: respuestas ambiguas o respaldos persistentes impiden declarar éxito',async()=>{
  const client=createCloudinaryAdmin({cloudName,apiKey:'key',apiSecret:'secret',request:async(url)=>url.endsWith('/image/destroy')?Response.json({result:'ok'}):Response.json({status:'deleted',backup_bytes:10,versions:[]})});
  await assert.rejects(client.destroy({publicId:'one',assetId:'asset',versionIds:[]}),/todavía conserva/);
  const bad=createCloudinaryAdmin({cloudName,apiKey:'key',apiSecret:'secret',request:async()=>Response.json({result:'unexpected'})});
  await assert.rejects(bad.destroy({publicId:'one',versionIds:[]}),/No se confirmó/);
});
function response() {return {code:null,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('endpoint rechaza token ausente, inválido, usuario ajeno y petición con imágenes inyectadas',async()=>{
  for(const [method,authorization,uid,body,expected] of [
    ['GET','Bearer token',adminUid,{},405],['POST',undefined,adminUid,{},401],
    ['POST','Bearer bad',null,{},401],['POST','Bearer token','visitor',{},403],
    ['POST','Bearer token',adminUid,{id:'provider',confirmation:'Prueba',photos:['x']},400]
  ]) {
    const handler=createHandler({services:()=>({auth:{verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(!uid)throw Error();return{uid};}},store:{}}),makeCloudinary:()=>{throw Error('no debe borrar');}});
    const res=response();await handler({method,headers:{authorization},body},res);assert.equal(res.code,expected);
  }
});
test('endpoint entrega éxito solo tras terminar la destrucción; claves nunca salen en la respuesta',async()=>{
  const f=fixture();
  const handler=createHandler({services:()=>({auth:{verifyIdToken:async()=>({uid:adminUid})},store:f.store}),makeCloudinary:()=>f.cloudinary});
  const res=response();await handler({method:'POST',headers:{authorization:'Bearer token'},body:{id:'provider',confirmation:'Prueba'}},res);
  assert.equal(res.code,200);assert.equal(res.body.deleted,true);assert.equal(f.current(),null);
});
