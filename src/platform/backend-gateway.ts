import {allowedBackendRequest, backendProxyPrefix,websiteRequestOrigin} from './backend-transport.ts';

const forwardedHeaders = ['authorization', 'accept', 'content-type', 'prefer', 'range', 'range-unit', 'accept-profile', 'content-profile', 'x-client-info', 'x-supabase-api-version'];
const returnedHeaders = ['content-type', 'content-range', 'range-unit', 'preference-applied', 'www-authenticate', 'retry-after', 'x-sb-error-code'];
const privateHeaders = {'Cache-Control':'private, no-store, max-age=0', 'CDN-Cache-Control':'no-store', 'Vercel-CDN-Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer'};
const failure = (status: number, message: string) => Response.json({message}, {status, headers:privateHeaders});

async function readBody(request: Request, max: number): Promise<Uint8Array | undefined> {
  if (['GET', 'HEAD'].includes(request.method) || !request.body) return undefined;
  if (Number(request.headers.get('content-length')) > max) throw new Error('BODY_LIMIT');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > max) throw new Error('BODY_LIMIT'); chunks.push(value); }
  } finally { await reader.cancel().catch(()=>undefined); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return bytes;
}

/** Fixed upstream and public key only. User JWT/RLS retain all existing permissions. */
export async function proxyBackendRequest(request: Request, config: {endpoint:string;publicKey:string}, send: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url), path = url.pathname.slice(backendProxyPrefix.length);
  if (!url.pathname.startsWith(backendProxyPrefix + '/') || !allowedBackendRequest(path,request.method)) return failure(404,'Backend route unavailable');
  // Next's internal URL can use localhost behind its HTTP adapter. Host is the
  // browser-facing authority; browsers cannot set this header from scripts.
  const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
  const websiteOrigin=websiteRequestOrigin(request);
  if (site === 'cross-site' || origin && origin !== websiteOrigin || !['GET','HEAD'].includes(request.method) && !origin) return failure(403,'Use the website to make this request');
  const headers = new Headers();
  for (const name of forwardedHeaders) { const value=request.headers.get(name); if (value) headers.set(name,value); }
  const media=path.startsWith('/storage/v1/');
  if (media) {
    // Public pictures are identical for everyone; never vary a shared cache by
    // user credentials. Cookies have never been forwarded by this gateway.
    headers.delete('authorization');
    for (const name of ['if-none-match','if-modified-since']) { const value=request.headers.get(name); if(value)headers.set(name,value); }
  }
  headers.set('apikey',config.publicKey);
  let body: Uint8Array | undefined;
  try { body = await readBody(request,path.startsWith('/auth/') ? 64*1024 : 1024*1024); }
  catch { return failure(413,'Request too large'); }
  try {
    const upstream = new URL(path + url.search,config.endpoint);
    const result = await send(upstream,{method:request.method,headers,body:body as BodyInit | undefined,redirect:'manual',cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(20000)])});
    const responseHeaders = new Headers(privateHeaders);
    for (const name of returnedHeaders) { const value=result.headers.get(name); if (value) responseHeaders.set(name,value); }
    if (result.status >= 300 && result.status < 400 && result.status !== 304) {
      const location=result.headers.get('location'); if (!location) return failure(502,'Invalid backend redirect');
      const destination=new URL(location,upstream);
      if (destination.origin !== websiteOrigin || !destination.pathname.startsWith('/auth')) return failure(502,'Unexpected backend redirect');
      responseHeaders.set('location',destination.href);
    }
    if (media && result.ok) {
      if (!/^image\/(jpeg|png|webp|gif|avif)(;|$)/i.test(result.headers.get('content-type')??'')) { await result.body?.cancel(); return failure(415,'Unsupported image'); }
      responseHeaders.set('Content-Security-Policy',"default-src 'none'; sandbox");
    }
    if (media && (result.ok || result.status===304)) {
      // Uploads use a fresh UUID filename on every replacement (upsert=false).
      // Only these versioned objects can be held long-term without showing an
      // old avatar after a user changes it. Legacy names revalidate in an hour.
      const versioned=/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp|gif|avif)$/i.test(path);
      responseHeaders.set('Cache-Control',versioned?'public, max-age=31536000, immutable':'public, max-age=3600');
      responseHeaders.set('CDN-Cache-Control',versioned?'public, max-age=31536000, immutable':'public, max-age=3600');
      responseHeaders.set('Vercel-CDN-Cache-Control',versioned?'public, max-age=31536000, immutable':'public, max-age=3600');
      for (const name of ['etag','last-modified']) { const value=result.headers.get(name); if(value)responseHeaders.set(name,value); }
    }
    return new Response(request.method==='HEAD'||[204,304].includes(result.status)?null:result.body,{status:result.status,headers:responseHeaders});
  } catch { return failure(502,'Backend temporarily unavailable'); }
}
