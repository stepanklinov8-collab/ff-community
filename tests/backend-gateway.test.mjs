import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedBackendRequest,backendTransport,backendImageUrl,proxyBackendUrl} from '../src/platform/backend-transport.ts';
import {proxyBackendRequest} from '../src/platform/backend-gateway.ts';
import {createBackendFetch} from '../src/platform/backend-fetch.ts';
const endpoint='https://project.supabase.co',origin='https://arena.example',config={endpoint,publicKey:'public-test-key'};
const request=(path,options={})=>new Request(origin+'/api/backend'+path,{...options,headers:{origin,...options.headers}});

test('gateway admits only used public auth, RLS REST and validated public media paths',()=>{
 assert.equal(backendTransport(''),'direct');assert.equal(backendTransport('proxy'),'proxy');assert.throws(()=>backendTransport('auto'));
 for(const path of ['/auth/v1/token','/auth/v1/signup','/auth/v1/verify','/auth/v1/recover','/auth/v1/resend','/auth/v1/logout'])assert.equal(allowedBackendRequest(path,'POST'),true);
 for(const path of ['/auth/v1/admin/users','/functions/v1/arbitrary','/rest/v1/../admin','/rest/v1/%2e%2e','/rest/v1/%2Fadmin','//evil.test/x','/storage/v1/object/public/unknown/x.png'])assert.equal(allowedBackendRequest(path,'GET'),false);
 assert.equal(allowedBackendRequest('/rest/v1/profiles','PATCH'),true);assert.equal(allowedBackendRequest('/rest/v1/rpc/leave_team','POST'),true);
 assert.equal(allowedBackendRequest('/storage/v1/object/public/avatars/user/file.png','GET'),true);
 assert.equal(allowedBackendRequest('/storage/v1/object/public/avatars/user/file.png','POST'),false);
 assert.equal(allowedBackendRequest('/auth/v1/user','DELETE'),false);
});

test('proxy URLs preserve encoding/query, keep cookies canonical and never rewrite foreign assets',()=>{
 assert.equal(proxyBackendUrl(endpoint+'/rest/v1/profiles?select=id%2Cnickname',endpoint,origin),origin+'/api/backend/rest/v1/profiles?select=id%2Cnickname');
 assert.throws(()=>proxyBackendUrl('https://evil.test/auth/v1/token',endpoint,origin));
 const image=endpoint+'/storage/v1/object/public/avatars/a%20b.png';
 assert.equal(backendImageUrl(image,endpoint,'proxy'),'/api/backend/storage/v1/object/public/avatars/a%20b.png');
 assert.equal(backendImageUrl(image,endpoint,'direct'),image);
 for(const src of ['/brand/logo.png','https://other.test/photo.png',endpoint+'/storage/v1/object/public/avatars.evil/x.png'])assert.equal(backendImageUrl(src,endpoint,'proxy'),src);
});

test('gateway preserves user token, methods, bodies and RLS headers; never forwards site cookies or caller API key',async()=>{
 let calls=0;
 const response=await proxyBackendRequest(request('/rest/v1/profiles?select=id',{method:'PATCH',body:JSON.stringify({nickname:'Сокол'}),headers:{authorization:'Bearer user-test-token',apikey:'untrusted-key',cookie:'private-site-cookie',prefer:'return=representation','content-type':'application/json'}}),config,async(url,options)=>{
  calls++;assert.equal(url.href,endpoint+'/rest/v1/profiles?select=id');assert.equal(options.method,'PATCH');assert.equal(options.headers.get('apikey'),config.publicKey);assert.equal(options.headers.get('authorization'),'Bearer user-test-token');assert.equal(options.headers.get('cookie'),null);assert.equal(options.headers.get('prefer'),'return=representation');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)),{nickname:'Сокол'});assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');
  return Response.json([{id:'test'}],{headers:{'Set-Cookie':'secret=bad','Content-Range':'0-0/1','Cache-Control':'public,max-age=999'}});
 });
 assert.equal(calls,1);assert.deepEqual(await response.json(),[{id:'test'}]);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('content-range'),'0-0/1');assert.match(response.headers.get('cache-control'),/private, no-store/);
});

test('public signup/refresh errors remain readable but cross-site, admin and oversized inputs never reach upstream',async()=>{
 let calls=0;const send=async()=>{calls++;return Response.json({error_code:'email_not_confirmed',msg:'Confirm email'},{status:400,headers:{'retry-after':'60'}});};
 const reply=await proxyBackendRequest(request('/auth/v1/token?grant_type=password',{method:'POST',body:'{}'}),config,send);
 assert.equal(reply.status,400);assert.equal((await reply.json()).error_code,'email_not_confirmed');assert.equal(reply.headers.get('retry-after'),'60');
 for(const r of [request('/auth/v1/admin/users'),request('/auth/v1/token',{method:'POST',headers:{origin:'https://evil.test'}}),new Request(origin+'/api/backend/auth/v1/signup',{method:'POST',body:'{}'}),request('/auth/v1/signup',{method:'POST',body:'x'.repeat(65537)}),request('/rest/v1/profiles',{headers:{'sec-fetch-site':'cross-site'}})])assert.ok([403,404,413].includes((await proxyBackendRequest(r,config,send)).status));
 assert.equal(calls,1);
 const hosted=await proxyBackendRequest(new Request('http://localhost:3106/api/backend/auth/v1/signup',{method:'POST',headers:{host:'127.0.0.1:3106',origin:'http://127.0.0.1:3106'},body:'{}'}),config,send);assert.equal(hosted.status,400);
});

test('gateway never follows redirects, retries writes, leaks upstream failures or serves active storage content',async()=>{
 let calls=0;
 const unavailable=await proxyBackendRequest(request('/auth/v1/signup',{method:'POST',body:'{}'}),config,async()=>{calls++;throw Error('PRIVATE PASSWORD TOKEN');});
 assert.equal(calls,1);assert.equal(unavailable.status,502);assert.doesNotMatch(await unavailable.text(),/PRIVATE/);
 const external=await proxyBackendRequest(request('/auth/v1/verify'),config,async()=>Response.redirect('https://evil.test/steal',302));assert.equal(external.status,502);
 const redirect=await proxyBackendRequest(request('/auth/v1/verify'),config,async()=>Response.redirect(origin+'/auth?recovery=1',302));assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),origin+'/auth?recovery=1');
 const image=await proxyBackendRequest(request('/storage/v1/object/public/avatars/a.png'),config,async()=>new Response('image',{headers:{'content-type':'image/png'}}));assert.equal(image.status,200);assert.match(image.headers.get('content-security-policy'),/sandbox/);
 const html=await proxyBackendRequest(request('/storage/v1/object/public/avatars/a.png'),config,async()=>new Response('<script>bad</script>',{headers:{'content-type':'text/html'}}));assert.equal(html.status,415);
});

test('browser transport switches without changing SDK endpoint or retrying mutation; direct/server mode stays unchanged',async()=>{
 const originalMode=process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT,originalWindow=globalThis.window;
 try{
  process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT='proxy';globalThis.window={location:{origin}};
  const calls=[];const transport=createBackendFetch(endpoint,async(input,init)=>{const r=input instanceof Request?input:new Request(input,init);calls.push({url:r.url,body:await r.text(),headers:r.headers});return Response.json({ok:true});});
  await transport(endpoint+'/auth/v1/token?grant_type=password',{method:'POST',body:'{"password":"test-only"}',headers:{authorization:'Bearer user-token'}});
  assert.equal(calls[0].url,origin+'/api/backend/auth/v1/token?grant_type=password');assert.equal(calls[0].body,'{"password":"test-only"}');assert.equal(calls[0].headers.get('authorization'),'Bearer user-token');
  process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT='direct';await transport(endpoint+'/auth/v1/user');assert.equal(calls[1].url,endpoint+'/auth/v1/user');
  process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT='proxy';delete globalThis.window;await transport(endpoint+'/auth/v1/user');assert.equal(calls[2].url,endpoint+'/auth/v1/user');
 }finally{if(originalMode===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT;else process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT=originalMode;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('versioned public pictures keep original bytes in browser/CDN cache and revalidate without credentials; errors remain private',async()=>{
 const path='/storage/v1/object/public/avatars/players/example/00000000-0000-4000-8000-000000000001.png';
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
 const response=await proxyBackendRequest(request(path,{headers:{authorization:'Bearer never-forward',cookie:'private', 'if-none-match':'"photo-v1"'}}),config,async(url,options)=>{
  assert.equal(options.headers.get('authorization'),null);assert.equal(options.headers.get('cookie'),null);assert.equal(options.headers.get('apikey'),config.publicKey);assert.equal(options.headers.get('if-none-match'),'"photo-v1"');
  return new Response(bytes,{headers:{'content-type':'image/png',etag:'"photo-v1"','last-modified':'Tue, 10 Nov 2026 12:00:00 GMT'}});
 });
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
 assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(response.headers.get('vercel-cdn-cache-control'),'public, max-age=31536000, immutable');assert.equal(response.headers.get('etag'),'"photo-v1"');
 const unchanged=await proxyBackendRequest(request(path,{headers:{'if-none-match':'"photo-v1"'}}),config,async()=>new Response(null,{status:304,headers:{etag:'"photo-v1"'}}));
 assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert.match(unchanged.headers.get('cache-control'),/immutable/);
 const legacy=await proxyBackendRequest(request('/storage/v1/object/public/avatars/legacy.png'),config,async()=>new Response(bytes,{headers:{'content-type':'image/png'}}));assert.equal(legacy.headers.get('cache-control'),'public, max-age=3600');
 for(const status of [404,500]){const error=await proxyBackendRequest(request(path),config,async()=>Response.json({error:'Unavailable'},{status}));assert.match(error.headers.get('cache-control'),/no-store/);assert.equal(error.headers.get('vercel-cdn-cache-control'),'no-store');}
 const html=await proxyBackendRequest(request(path),config,async()=>new Response('<script>unsafe</script>',{headers:{'content-type':'text/html'}}));assert.equal(html.status,415);assert.match(html.headers.get('cache-control'),/no-store/);
 const auth=await proxyBackendRequest(request('/auth/v1/user'),config,async()=>Response.json({id:'private'},{headers:{'cache-control':'public,max-age=31536000'}}));assert.match(auth.headers.get('cache-control'),/private, no-store/);
});
