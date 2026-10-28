import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadPhoto} from '../dist/cloudinary.js';

const photo = {name:'foto.png', blob:new Blob(['photo'], {type:'image/png'})};
test('carga unsigned: multipart, URL segura y errores del servicio', async t => {
  const calls=[];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url, options});
    return new Response(JSON.stringify({secure_url:'https://res.cloudinary.com/zytomafs/image/upload/test.png'}));
  });
  assert.equal(await uploadPhoto(photo), 'https://res.cloudinary.com/zytomafs/image/upload/test.png');
  assert.equal(calls[0].url,'https://api.cloudinary.com/v1_1/zytomafs/image/upload');
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.body.get('upload_preset'),'proveedores-vitrina');
  assert.equal(calls[0].options.body.get('file').name,'foto.png');
  assert.equal(calls[0].options.body.has('api_secret'),false);
  globalThis.fetch.mock.mockImplementation(async()=>new Response(JSON.stringify({error:{message:'Upload preset not found'}}),{status:400}));
  await assert.rejects(uploadPhoto(photo),/Upload preset not found/);
  globalThis.fetch.mock.mockImplementation(async()=>new Response('<html>Unavailable</html>',{status:503}));
  await assert.rejects(uploadPhoto(photo),/No se pudo subir/);
  globalThis.fetch.mock.mockImplementation(async()=>new Response(JSON.stringify({secure_url:'http://example.com/photo.png'})));
  await assert.rejects(uploadPhoto(photo),/enlace válido/);
  globalThis.fetch.mock.mockImplementation(async()=>{throw new TypeError('offline');});
  await assert.rejects(uploadPhoto(photo),/conectar con Cloudinary/);
});
test('archivos inválidos se rechazan antes de subir',async t=>{
  const fetchMock=t.mock.method(globalThis,'fetch',()=>{throw new Error('No debe llamarse');});
  await assert.rejects(uploadPhoto({name:'test.pdf',blob:new Blob(['pdf'],{type:'application/pdf'})}),/Solo se aceptan/);
  await assert.rejects(uploadPhoto({name:'grande.png',blob:new Blob([new Uint8Array(8*1024*1024+1)],{type:'image/png'})}),/8 MB/);
  assert.equal(fetchMock.mock.callCount(),0);
});
