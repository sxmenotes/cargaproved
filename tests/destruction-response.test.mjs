import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDestructionResponse} from '../dist/destruction-response.js';
test('diagnostica errores de Vercel sin confundirlos con reglas ni credenciales',async()=>{
  await assert.rejects(readDestructionResponse(new Response('A server error has occurred',{status:500,headers:{'x-vercel-error':'FUNCTION_INVOCATION_FAILED'}})),/no pudo arrancar/);
  await assert.rejects(readDestructionResponse(new Response('<html>Not found</html>',{status:404})),/Root Directory/);
  await assert.rejects(readDestructionResponse(new Response('timeout',{status:504})),/tiempo de ejecución/);
  await assert.rejects(readDestructionResponse(new Response('unauthorized',{status:401})),/protección del despliegue/);
  await assert.rejects(readDestructionResponse(new Response('gateway failure',{status:502})),/HTTP 502/);
  await assert.rejects(readDestructionResponse(new Response('<html>home</html>')),/sin confirmar/);
});
test('conserva el mensaje útil del servidor y exige éxito explícito',async()=>{
  await assert.rejects(readDestructionResponse(Response.json({error:'Falta configurar las credenciales privadas de Cloudinary en Vercel.'},{status:503})),/credenciales privadas/);
  await assert.rejects(readDestructionResponse(Response.json({deleted:true},{status:500})),/HTTP 500/);
  assert.deepEqual(await readDestructionResponse(Response.json({deleted:true,images:3})),{deleted:true,images:3});
});
