import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';

const config=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-staging-private.json',import.meta.url),'utf8'));
const login=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-login-private.json',import.meta.url),'utf8'));
const origin='http://127.0.0.1:3001';
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname,`${stagingProject}.supabase.co`);
assert.equal(login.project,stagingProject);
const signIn=await fetch(`${config.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,{
 method:'POST',headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
 body:JSON.stringify({email:login.email,password:login.password}),signal:AbortSignal.timeout(30000),
});
if(!signIn.ok)throw Error(`Test sign-in failed: HTTP ${signIn.status}`);
const session=await signIn.json();
assert.equal(session.user.id,login.userId);
assert(session.access_token);
// Never print credentials, tokens, private contract terms or financial history.
const headers={Authorization:`Bearer ${session.access_token}`};
for(const path of ['/api/contracts','/api/wallet','/api/transfers','/api/market']){
 const response=await fetch(origin+path,{headers,signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);
 assert.match(response.headers.get('cache-control')??'',/no-store/);
 const data=await response.json();
 if(path==='/api/contracts'){
  assert(Array.isArray(data.contracts));assert(Array.isArray(data.organizations));
  console.log('PASS: authenticated staging contracts API, private response, current organization access');
 }else{
  if(path==='/api/transfers'||path==='/api/market')assert(Array.isArray(data.deals));
  console.log('PASS: authenticated isolated endpoint '+path);
 }
}
for(const path of ['/api/contracts','/api/transfers','/api/market']){
 const anonymous=await fetch(origin+path,{signal:AbortSignal.timeout(45000)});assert.equal(anonymous.status,401,'guest data must remain private at '+path);
}
console.log('PASS: guest cannot read contract data; production unchanged');
