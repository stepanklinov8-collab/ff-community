import {backendTransport, proxyBackendUrl} from './backend-transport.ts';

/** No retry/fallback of mutations: an ambiguous upstream result must not run twice. */
export function createBackendFetch(endpoint: string, send: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if (typeof window === 'undefined' || backendTransport() !== 'proxy') return send(input, init);
    const request = new Request(input, init);
    const url = proxyBackendUrl(request.url, endpoint, window.location.origin);
    // Reconstruct a buffered body. Cloning a POST Request to a new URL turns it
    // into a streaming upload in Chromium, which requires HTTP/2 even locally.
    const body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();
    return send(url,{method:request.method,headers:request.headers,body,signal:request.signal,
      credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:request.redirect,
      referrerPolicy:request.referrerPolicy});
  };
}
