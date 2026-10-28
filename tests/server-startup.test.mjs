import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('el endpoint y su cadena Firebase/JWKS arrancan sin require de ESM, como en Vercel',()=>{
  const script = `
    import assert from 'node:assert/strict';
    import {createRequire} from 'node:module';
    import {generateKeyPairSync,createPublicKey} from 'node:crypto';
    import handler from './api/destroy-provider.js';
    const require=createRequire(import.meta.url);
    const {retrieveSigningKeys}=require('jwks-rsa/src/utils.js');
    const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
    const jwk={...publicKey.export({format:'jwk'}),kid:'regression',alg:'RS256',use:'sig'};
    const keys=await retrieveSigningKeys([jwk]);
    assert.equal(keys.length,1);
    assert.equal(createPublicKey(keys[0].getPublicKey()).export({format:'jwk'}).n,jwk.n);
    const res={code:null,setHeader(){},status(code){this.code=code;return this;},json(){return this;}};
    await handler({method:'GET',headers:{}},res);
    assert.equal(res.code,405);
    await handler({method:'POST',headers:{}},res);
    assert.equal(res.code,401);
  `;
  const result=spawnSync(process.execPath,['--no-experimental-require-module','--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr || result.error?.message);
});
